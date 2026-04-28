import os
import httpx
from dotenv import load_dotenv

from services.discovery_overpass import search_hotels_osm
from services.discovery_wikipedia import enrich_with_wikipedia

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Maps Google price_level (0–4) to a rough USD label shown in the UI
_PRICE_LABEL = {
    0: "Free",
    1: "Inexpensive",
    2: "Moderate",
    3: "Expensive",
    4: "Very Expensive",
}


async def _osm_fallback(lat: float, lng: float, limit: int = 30) -> dict:
    """OSM-backed hotel search, used as a fallback when Google is unavailable
    or returns nothing. Wikipedia enrichment is best-effort — failures don't
    block the response."""
    osm = await search_hotels_osm(lat=lat, lng=lng, radius_m=10_000, limit=limit)
    if osm.get("data"):
        try:
            await enrich_with_wikipedia(osm["data"], title_key="name")
        except Exception:
            # Enrichment is bonus content — never block on it.
            pass
    return osm


async def search_city(city_name: str) -> dict:
    """
    Google Geocoding API — resolve a city name to lat/lng.
    Returns up to 5 results. Each result includes lat, lng, and country.
    Used by both hotel search and activity search in the frontend.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                GEOCODE_URL,
                params={"address": city_name, "key": GOOGLE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"data": None, "error": data.get("status", "Geocoding error")}

        cities = []
        for r in data.get("results", [])[:5]:
            loc = r["geometry"]["location"]
            country = next(
                (c["short_name"] for c in r.get("address_components", [])
                 if "country" in c.get("types", [])),
                None,
            )
            cities.append({
                "name": r.get("formatted_address"),
                "iata_code": None,   # Google doesn't return IATA codes
                "country": country,
                "lat": loc["lat"],
                "lng": loc["lng"],
            })
        return {"data": cities, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
    except Exception as e:
        return {"data": None, "error": str(e)}


async def search_hotels(
    lat: float,
    lng: float,
    checkin: str,
    checkout: str,
    adults: int,
    rooms: int = 1,
) -> dict:
    """
    Google Places Nearby Search (type=lodging) with OSM Overpass fallback.

    Tries Google first when configured, falls back to OSM Overpass on quota
    errors, network failures, zero results, or a missing API key. OSM is
    free and unlimited, so it's both a backstop for Google's $200/month
    free quota and the *only* source for self-hosted deploys without a
    Google key.

    Note: Google Places does not return actual nightly prices —
    price_level (1–4 scale) is shown instead. OSM has no price data either,
    but ships richer name + address + contact info.

    checkin/checkout/adults/rooms are accepted for API compatibility but
    are not sent to either source (use them to prefill the save form).
    """
    # If we don't have a Google key configured, skip straight to OSM.
    if not GOOGLE_API_KEY:
        return await _osm_fallback(lat, lng)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                NEARBY_URL,
                params={
                    "location": f"{lat},{lng}",
                    "radius": 10000,       # 10 km
                    "type": "lodging",
                    "key": GOOGLE_API_KEY,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        # OVER_QUERY_LIMIT / REQUEST_DENIED → fall back to OSM rather than
        # surface a vendor-specific error message to the user.
        google_status = data.get("status")
        if google_status not in ("OK", "ZERO_RESULTS"):
            return await _osm_fallback(lat, lng)

        hotels = []
        for p in data.get("results", [])[:15]:
            loc = p.get("geometry", {}).get("location", {})
            price_level = p.get("price_level")
            hotels.append({
                "hotel_id": p.get("place_id"),
                "name": p.get("name"),
                "address": p.get("vicinity"),
                "rating": p.get("rating"),
                "price_level": price_level,
                "price_label": _PRICE_LABEL.get(price_level) if price_level is not None else None,
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "offer_id": p.get("place_id"),   # reuse place_id as offer reference
                "price": None,                    # actual nightly price not available
                "currency": "USD",
                "room_type": None,
                "beds": None,
                "source": "google_places",
            })

        # Google found nothing in this area — Overpass usually has more
        # coverage in smaller cities, so try it before giving up.
        if not hotels:
            return await _osm_fallback(lat, lng)

        return {"data": hotels, "error": None}
    except httpx.HTTPError:
        return await _osm_fallback(lat, lng)
    except Exception:
        return await _osm_fallback(lat, lng)


async def get_hotel_offer(place_id: str) -> dict:
    """
    Google Places Details — fetch full details for a specific place.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "name,formatted_address,rating,price_level,geometry,url",
                    "key": GOOGLE_API_KEY,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return {"data": data.get("result"), "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
    except Exception as e:
        return {"data": None, "error": str(e)}
