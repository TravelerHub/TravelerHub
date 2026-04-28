"""
OSM Overpass discovery — free, unlimited POI source backing the booking and
suggestion features. Acts as a fallback when Google Places is rate-limited,
unavailable, or returns zero results, and as the *primary* source for any
deploy that doesn't have a Google Places API key set.

Why Overpass:
  - Free, no API key, no quota, ~unlimited query volume against the public
    instances. We use the main `overpass-api.de` endpoint with a 25 s timeout.
  - Same coverage as OpenStreetMap (extremely broad globally, denser than
    Google in many smaller cities and rural regions).
  - Returns structured tags: `name`, `addr:*`, `phone`, `website`,
    `opening_hours`, `cuisine`, etc.

Tradeoffs:
  - No price information whatsoever — Booking.com / Expedia keep that locked
    behind paid APIs anyway, so we don't lose much vs. Google's `price_level`
    which was already a 1–4 hint.
  - No standardized photos. Wikipedia enrichment (separate service) covers
    most major attractions; hotels show a generic placeholder.
  - Tag completeness varies wildly by region. Mitigated by trying Google
    first when configured.
"""

import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_TIMEOUT_S = 25.0
RESULT_LIMIT_DEFAULT = 30


def _build_overpass_query(filters: list[str], lat: float, lng: float, radius_m: int, limit: int) -> str:
    """Compose an Overpass QL query that returns nodes + ways + relations matching `filters`.

    `filters` is a list of OSM tag selectors like `'["tourism"="hotel"]'`. The
    query returns up to `limit` results per filter, with `out center` so ways
    and relations include a representative coordinate.
    """
    blocks = []
    for f in filters:
        blocks.append(f'  node{f}(around:{radius_m},{lat},{lng});')
        blocks.append(f'  way{f}(around:{radius_m},{lat},{lng});')
        blocks.append(f'  relation{f}(around:{radius_m},{lat},{lng});')
    body = "\n".join(blocks)
    # `out center` gives us a single (lat,lng) for ways/relations instead of
    # the whole geometry — that's all we need for a list view.
    return (
        f"[out:json][timeout:{int(DEFAULT_TIMEOUT_S)}];\n"
        f"(\n{body}\n);\n"
        f"out center {limit};\n"
    )


def _coord_of(element: dict) -> tuple[Optional[float], Optional[float]]:
    """Pull (lat, lng) off any element shape Overpass returns."""
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    center = element.get("center") or {}
    return center.get("lat"), center.get("lon")


def _normalize_address(tags: dict) -> Optional[str]:
    """Reconstruct a single-line address from the addr:* tag family."""
    parts = []
    for key in ("addr:housenumber", "addr:street"):
        v = tags.get(key)
        if v:
            parts.append(v)
    line1 = " ".join(parts) if parts else None

    line2_parts = []
    for key in ("addr:city", "addr:state", "addr:postcode", "addr:country"):
        v = tags.get(key)
        if v:
            line2_parts.append(v)
    line2 = ", ".join(line2_parts) if line2_parts else None

    if line1 and line2:
        return f"{line1}, {line2}"
    return line1 or line2


def _hotel_to_card(element: dict) -> Optional[dict]:
    tags = element.get("tags") or {}
    name = tags.get("name")
    if not name:
        return None  # Skip nameless rows — they're noise on a list view.
    lat, lng = _coord_of(element)
    if lat is None or lng is None:
        return None

    osm_id = element.get("id")
    osm_type = element.get("type")  # "node" | "way" | "relation"

    return {
        "hotel_id": f"osm:{osm_type}:{osm_id}",
        "name": name,
        "address": _normalize_address(tags),
        "rating": None,           # OSM doesn't carry ratings
        "price_level": None,
        "price_label": None,
        "lat": lat,
        "lng": lng,
        "offer_id": f"osm:{osm_type}:{osm_id}",
        "price": None,
        "currency": "USD",
        "room_type": None,
        "beds": None,
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "website": tags.get("website") or tags.get("contact:website"),
        "stars": tags.get("stars"),
        "source": "osm",
    }


def _attraction_to_card(element: dict) -> Optional[dict]:
    tags = element.get("tags") or {}
    name = tags.get("name")
    if not name:
        return None
    lat, lng = _coord_of(element)
    if lat is None or lng is None:
        return None

    osm_id = element.get("id")
    osm_type = element.get("type")

    # Pick the most descriptive category tag we can find. Order matters:
    # `tourism` is most specific, then `historic`, then `leisure`.
    place_type = (
        tags.get("tourism")
        or tags.get("historic")
        or tags.get("leisure")
        or tags.get("amenity")
        or "attraction"
    )

    return {
        "id": f"osm:{osm_type}:{osm_id}",
        "name": name,
        "place_id": f"osm:{osm_type}:{osm_id}",
        "address": _normalize_address(tags),
        "description": tags.get("description"),
        "lat": lat,
        "lng": lng,
        "place_type": place_type,
        "rating": None,
        "price": None,
        "currency": "USD",
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "website": tags.get("website") or tags.get("contact:website"),
        "wikipedia": tags.get("wikipedia"),  # used by the Wikipedia enricher
        "source": "osm",
    }


async def _query_overpass(query: str) -> list[dict]:
    """POST a query to Overpass and return the raw `elements` list.

    Sets a descriptive User-Agent — the public Overpass instances rate-limit
    or reject requests with a generic Python-httpx UA, especially from
    shared cloud IPs.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
        resp = await client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={
                "User-Agent": "TravelerHub/1.0 (https://travelhub.fozhan.dev)",
                "Accept": "application/json",
            },
        )
        resp.raise_for_status()
        payload = resp.json()
    return payload.get("elements") or []


# ── Public API ────────────────────────────────────────────────────────────────

async def search_hotels_osm(
    lat: float,
    lng: float,
    radius_m: int = 10_000,
    limit: int = RESULT_LIMIT_DEFAULT,
) -> dict:
    """OSM-backed hotel search. Same response shape as `hotels_service.search_hotels`.

    Returns up to `limit` hotels within `radius_m` meters of (lat, lng).
    """
    # `tourism=hotel` is the canonical tag; we also catch `tourism=hostel` and
    # `tourism=guest_house` so the list isn't empty in cities with few large
    # hotels.
    filters = [
        '["tourism"="hotel"]',
        '["tourism"="hostel"]',
        '["tourism"="guest_house"]',
    ]
    query = _build_overpass_query(filters, lat, lng, radius_m, limit)

    try:
        elements = await _query_overpass(query)
    except httpx.HTTPError as e:
        logger.warning("Overpass HTTP error: %s", e)
        return {"data": [], "error": f"Overpass unavailable: {e}"}
    except Exception as e:
        logger.warning("Overpass query failed: %s", e, exc_info=True)
        return {"data": [], "error": str(e)}

    hotels = []
    for el in elements:
        card = _hotel_to_card(el)
        if card:
            hotels.append(card)
        if len(hotels) >= limit:
            break
    return {"data": hotels, "error": None}


async def search_attractions_osm(
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = RESULT_LIMIT_DEFAULT,
) -> dict:
    """OSM-backed attraction search. Same response shape as
    `attractions_service.search_activities`.
    """
    radius_m = int(radius_km * 1000)
    # Wide net across the categories TravelerHub already groups under
    # "attractions": tourism POIs, historic sites, leisure venues. Skip
    # `amenity=*` to avoid swamping the list with banks / parking.
    filters = [
        '["tourism"="attraction"]',
        '["tourism"="museum"]',
        '["tourism"="viewpoint"]',
        '["tourism"="zoo"]',
        '["tourism"="theme_park"]',
        '["tourism"="aquarium"]',
        '["tourism"="gallery"]',
        '["historic"~"^(monument|memorial|castle|ruins|archaeological_site)$"]',
        '["leisure"~"^(park|garden|nature_reserve)$"]',
    ]
    query = _build_overpass_query(filters, lat, lng, radius_m, limit)

    try:
        elements = await _query_overpass(query)
    except httpx.HTTPError as e:
        logger.warning("Overpass HTTP error: %s", e)
        return {"data": [], "error": f"Overpass unavailable: {e}"}
    except Exception as e:
        logger.warning("Overpass query failed: %s", e, exc_info=True)
        return {"data": [], "error": str(e)}

    attractions = []
    for el in elements:
        card = _attraction_to_card(el)
        if card:
            attractions.append(card)
        if len(attractions) >= limit:
            break
    return {"data": attractions, "error": None}
