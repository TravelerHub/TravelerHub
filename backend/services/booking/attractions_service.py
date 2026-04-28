import os
import httpx
from dotenv import load_dotenv

from services.discovery_overpass import search_attractions_osm
from services.discovery_wikipedia import enrich_with_wikipedia

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


async def _osm_fallback(lat: float, lng: float, radius_km: float) -> dict:
    """OSM-backed attraction search with Wikipedia enrichment.

    Used as a fallback when Google is unavailable / rate-limited and as the
    primary source on deploys without a Google Places API key. Wikipedia
    enrichment is best-effort — failures don't block the response.
    Output is reshaped to match the Google response surface so the frontend
    doesn't need to branch on `source`.
    """
    osm = await search_attractions_osm(lat=lat, lng=lng, radius_km=radius_km)
    items = osm.get("data") or []

    if items:
        try:
            await enrich_with_wikipedia(items, title_key="name")
        except Exception:
            pass

    # Reshape into the same key set Google returns so the Booking modal can
    # render either source identically.
    activities = []
    for it in items:
        wiki = it.get("wikipedia") if isinstance(it.get("wikipedia"), dict) else None
        thumb = wiki.get("thumbnail") if wiki else None
        description = (wiki.get("extract") if wiki else None) or it.get("description")
        activities.append({
            "id": it.get("id"),
            "name": it.get("name"),
            "description": description,
            "address": it.get("address"),
            "lat": it.get("lat"),
            "lng": it.get("lng"),
            "rating": it.get("rating"),
            "price": None,
            "currency": "USD",
            "pictures": [thumb] if thumb else [],
            # Deep-link to OSM; the frontend keeps the field name from Google.
            "booking_link": (wiki or {}).get("url") or f"https://www.openstreetmap.org/?mlat={it.get('lat')}&mlon={it.get('lng')}#map=17/{it.get('lat')}/{it.get('lng')}",
            "source": "osm",
        })
    return {"data": activities, "error": osm.get("error")}


async def search_activities(lat: float, lng: float, radius: int = 5) -> dict:
    """
    Attraction search with OSM Overpass + Wikipedia fallback.

    Tries Google Places (type=tourist_attraction) first when configured,
    then falls back to OSM Overpass on quota errors, network failures,
    zero results, or a missing API key. OSM cards are enriched with
    Wikipedia summaries + thumbnails when available.

    radius is in km (converted to metres for Google Places).
    """
    if not GOOGLE_API_KEY:
        return await _osm_fallback(lat, lng, float(radius))

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                NEARBY_URL,
                params={
                    "location": f"{lat},{lng}",
                    "radius": radius * 1000,   # km → metres
                    "type": "tourist_attraction",
                    "key": GOOGLE_API_KEY,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        google_status = data.get("status")
        if google_status not in ("OK", "ZERO_RESULTS"):
            return await _osm_fallback(lat, lng, float(radius))

        activities = []
        for p in data.get("results", [])[:15]:
            loc = p.get("geometry", {}).get("location", {})
            photos = p.get("photos", [])
            activities.append({
                "id": p.get("place_id"),
                "name": p.get("name"),
                "description": p.get("editorial_summary", {}).get("overview"),
                "address": p.get("vicinity"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "rating": p.get("rating"),
                "price": None,          # Google Places does not return ticket prices
                "currency": "USD",
                "pictures": [
                    f"https://maps.googleapis.com/maps/api/place/photo"
                    f"?maxwidth=400&photo_reference={photos[0]['photo_reference']}&key={GOOGLE_API_KEY}"
                ] if photos else [],
                "booking_link": f"https://www.google.com/maps/place/?q=place_id:{p.get('place_id')}",
                "source": "google_places",
            })

        if not activities:
            return await _osm_fallback(lat, lng, float(radius))

        return {"data": activities, "error": None}
    except httpx.HTTPError:
        return await _osm_fallback(lat, lng, float(radius))
    except Exception:
        return await _osm_fallback(lat, lng, float(radius))


async def get_activity_details(activity_id: str) -> dict:
    """
    Google Places Details for a specific place_id.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": activity_id,
                    "fields": "name,formatted_address,rating,geometry,editorial_summary,url,photos",
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
