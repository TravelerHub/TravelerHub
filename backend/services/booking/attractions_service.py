import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BOOKING_API_KEY = os.getenv("BOOKING_API_KEY", "")
BOOKING_AFFILIATE_ID = os.getenv("BOOKING_AFFILIATE_ID", "")

# Attractions uses v3.2 Beta endpoint
ATTRACTIONS_BASE_URL = "https://demandapi-sandbox.booking.com/3.2"

HEADERS = {
    "Authorization": f"Bearer {BOOKING_API_KEY}",
    "X-Affiliate-Id": BOOKING_AFFILIATE_ID,
    "Content-Type": "application/json",
}


async def search_attractions(
    city_id: int,
    start_date: str,
    end_date: str,
    currency: str = "USD",
) -> dict:
    """
    POST /attractions/search (v3.2 Beta)
    Returns list of attractions for city + date range.
    Handles 403 gracefully (beta access not granted).
    """
    body = {
        "city": [city_id],
        "currency": currency,
        "date_range": {"start": start_date, "end": end_date},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{ATTRACTIONS_BASE_URL}/attractions/search",
                headers=HEADERS,
                json=body,
            )
            if resp.status_code == 403:
                return {"data": [], "error": "Attractions API requires beta access"}
            resp.raise_for_status()
            data = resp.json()
            attractions = data.get("data", data) if isinstance(data, dict) else data
            return {"data": attractions, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}


async def get_attraction_details(attraction_ids: list) -> dict:
    """
    POST /attractions/details (v3.2 Beta)
    Returns details for one or more attractions.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{ATTRACTIONS_BASE_URL}/attractions/details",
                headers=HEADERS,
                json={"attractions": attraction_ids, "languages": ["en-gb"]},
            )
            if resp.status_code == 403:
                return {"data": [], "error": "Attractions API requires beta access"}
            resp.raise_for_status()
            data = resp.json()
            details = data.get("data", data) if isinstance(data, dict) else data
            return {"data": details, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
