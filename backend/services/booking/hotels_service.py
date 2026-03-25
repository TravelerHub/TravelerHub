import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BOOKING_API_KEY = os.getenv("BOOKING_API_KEY", "")
BOOKING_AFFILIATE_ID = os.getenv("BOOKING_AFFILIATE_ID", "")
BOOKING_BASE_URL = os.getenv("BOOKING_BASE_URL", "https://demandapi-sandbox.booking.com/3.1")

HEADERS = {
    "Authorization": f"Bearer {BOOKING_API_KEY}",
    "X-Affiliate-Id": BOOKING_AFFILIATE_ID,
    "Content-Type": "application/json",
}


async def get_city_id(city_name: str) -> dict:
    """
    POST /common/locations/cities
    Returns first 5 city results for the given name.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BOOKING_BASE_URL}/common/locations/cities",
                headers=HEADERS,
                json={"name": city_name, "languages": ["en-gb"]},
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("data", data) if isinstance(data, dict) else data
            if isinstance(results, list):
                results = results[:5]
            return {"data": results, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}


async def search_hotels(
    city_id: int,
    checkin: str,
    checkout: str,
    adults: int,
    rooms: int = 1,
) -> dict:
    """
    POST /accommodations/search
    Returns list of hotels for city + dates.
    """
    body = {
        "booker": {"country": "us", "platform": "mobile"},
        "checkin": checkin,
        "checkout": checkout,
        "city": city_id,
        "guests": {"number_of_adults": adults, "number_of_rooms": rooms},
        "extras": ["products"],
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BOOKING_BASE_URL}/accommodations/search",
                headers=HEADERS,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            hotels = data.get("data", data) if isinstance(data, dict) else data
            return {"data": hotels, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}


async def get_hotel_availability(
    accommodation_id: int,
    checkin: str,
    checkout: str,
    adults: int,
) -> dict:
    """
    POST /accommodations/availability
    Returns room availability and pricing for a specific hotel.
    """
    body = {
        "accommodation": accommodation_id,
        "booker": {"country": "us", "platform": "mobile"},
        "checkin": checkin,
        "checkout": checkout,
        "extras": ["extra_charges"],
        "guests": {"number_of_adults": adults, "number_of_rooms": 1},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BOOKING_BASE_URL}/accommodations/availability",
                headers=HEADERS,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            availability = data.get("data", data) if isinstance(data, dict) else data
            return {"data": availability, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
