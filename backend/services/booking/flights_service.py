"""
flights_service.py
Kiwi Tequila API – flight offer search and details.

Credentials loaded from environment variables:
  KIWI_API_KEY    — get a free key at tequila.kiwi.com

httpx is used for async HTTP (already in requirements.txt).
"""

import os
import httpx
from datetime import datetime

TEQUILA_BASE = "https://api.tequila.kiwi.com/v2"

_CABIN_MAP = {
    "ECONOMY":          "M",
    "PREMIUM_ECONOMY":  "W",
    "BUSINESS":         "C",
    "FIRST":            "F",
}


def _api_key() -> str:
    return os.environ.get("KIWI_API_KEY", "")


def _fmt_date(iso_date: str) -> str:
    """Convert YYYY-MM-DD → DD/MM/YYYY (Tequila format)."""
    try:
        return datetime.strptime(iso_date, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return iso_date


def _parse_offer(offer: dict) -> dict:
    """Normalise a raw Kiwi Tequila flight offer into the standard TravelerHub shape."""
    routes = offer.get("route", [])
    first_leg = routes[0] if routes else {}
    last_leg  = routes[-1] if routes else {}

    airlines = [r.get("airline", "") for r in routes if r.get("airline")]
    airline = airlines[0] if airlines else ""

    stops = max(len(routes) - 1, 0)

    duration_secs = offer.get("duration", {}).get("total", 0)
    hours, mins = divmod(duration_secs // 60, 60)
    duration_str = f"{hours}h {mins}m"

    return {
        "id":             offer.get("id", ""),
        "price":          str(offer.get("price", "0")),
        "currency":       offer.get("currency", "USD"),
        "origin":         offer.get("flyFrom", first_leg.get("flyFrom", "")),
        "destination":    offer.get("flyTo",   last_leg.get("flyTo", "")),
        "departure_time": offer.get("local_departure", ""),
        "arrival_time":   offer.get("local_arrival", ""),
        "duration":       duration_str,
        "stops":          stops,
        "airline":        airline,
        "cabin_class":    "ECONOMY",
    }


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    travel_class: str = "ECONOMY",
) -> dict:
    """
    Search for flight offers via Kiwi Tequila v2 Search.

    Args:
        origin:         IATA airport or city code (e.g. "LAX")
        destination:    IATA airport or city code (e.g. "JFK")
        departure_date: ISO date "YYYY-MM-DD"
        adults:         Number of adult passengers
        travel_class:   "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"

    Returns:
        {"data": [<flight>, ...], "error": None}  on success
        {"data": [],              "error": "<msg>"} on failure
    """
    api_key = _api_key()
    if not api_key:
        return {
            "data": [],
            "error": "KIWI_API_KEY not configured. Get a free key at tequila.kiwi.com",
        }

    params = {
        "fly_from":        origin.upper(),
        "fly_to":          destination.upper(),
        "date_from":       _fmt_date(departure_date),
        "date_to":         _fmt_date(departure_date),
        "adults":          adults,
        "selected_cabins": _CABIN_MAP.get(travel_class.upper(), "M"),
        "curr":            "USD",
        "limit":           20,
        "sort":            "price",
    }
    headers = {"apikey": api_key}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{TEQUILA_BASE}/search", params=params, headers=headers)
            resp.raise_for_status()
            body = resp.json()
        flights = [_parse_offer(o) for o in (body.get("data") or [])]
        return {"data": flights, "error": None}
    except httpx.HTTPStatusError as e:
        return {
            "data": [],
            "error": f"Kiwi API error {e.response.status_code}: {e.response.text[:200]}",
        }
    except Exception as e:
        return {"data": [], "error": str(e)}


async def get_flight_details(offer_id: str) -> dict:
    """
    Kiwi Tequila does not provide a stateful offer-by-ID endpoint.
    Return a note so the frontend knows to use the search result data directly.
    """
    return {
        "data": {
            "id":   offer_id,
            "note": "Re-run search_flights to get full details for this offer.",
        },
        "error": None,
    }
