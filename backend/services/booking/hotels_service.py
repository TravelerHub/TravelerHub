import os
import httpx
from dotenv import load_dotenv

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
    Google Places Nearby Search (type=lodging).
    Returns up to 15 hotels near the given coordinates.
    Note: Google Places does not return actual nightly prices —
    price_level (1–4 scale) is shown instead.
    checkin/checkout/adults/rooms are accepted for API compatibility
    but are not sent to Google (use them to prefill the save form).
    """
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

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"data": None, "error": data.get("status", "Places API error")}

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
            })
        return {"data": hotels, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
    except Exception as e:
        return {"data": None, "error": str(e)}


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
