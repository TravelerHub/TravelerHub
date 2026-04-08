import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


async def search_activities(lat: float, lng: float, radius: int = 5) -> dict:
    """
    Google Places Nearby Search (type=tourist_attraction).
    radius is in km (converted to metres for the API).
    Returns up to 15 activities near the given coordinates.
    """
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

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"data": None, "error": data.get("status", "Places API error")}

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
            })
        return {"data": activities, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
    except Exception as e:
        return {"data": None, "error": str(e)}


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
