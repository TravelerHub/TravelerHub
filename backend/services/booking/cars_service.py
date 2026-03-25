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


async def search_cars(
    pickup_airport: str,
    pickup_datetime: str,
    dropoff_datetime: str,
    driver_age: int = 25,
) -> dict:
    """
    POST /cars/search
    Returns first 10 car rental results for airport + dates.
    """
    body = {
        "booker": {"country": "us"},
        "currency": "USD",
        "driver": {"age": driver_age},
        "route": {
            "pickup": {
                "datetime": pickup_datetime,
                "location": {"airport": pickup_airport},
            },
            "dropoff": {
                "datetime": dropoff_datetime,
                "location": {"airport": pickup_airport},
            },
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BOOKING_BASE_URL}/cars/search",
                headers=HEADERS,
                json=body,
            )
            resp.raise_for_status()
            result = resp.json()
            data = result.get("data", result) if isinstance(result, dict) else result
            cars = data[:10] if isinstance(data, list) else data
            booking_token = None
            if isinstance(result, dict):
                meta = result.get("metadata", {})
                booking_token = meta.get("booking_token") if isinstance(meta, dict) else None
            return {"data": cars, "booking_token": booking_token, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "booking_token": None, "error": str(e)}


async def get_car_details(car_id: str) -> dict:
    """
    POST /cars/details
    Returns details for a specific car offer.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BOOKING_BASE_URL}/cars/details",
                headers=HEADERS,
                json={"car": car_id},
            )
            resp.raise_for_status()
            data = resp.json()
            details = data.get("data", data) if isinstance(data, dict) else data
            return {"data": details, "error": None}
    except httpx.HTTPError as e:
        return {"data": None, "error": str(e)}
