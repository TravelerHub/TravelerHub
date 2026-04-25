"""
flights_service.py
SerpApi Google Flights – real-time flight search via Google Flights data.

Environment variable required:
  SERPAPI_KEY   — free key (250 req/month) at serpapi.com

httpx is used for async HTTP (already in requirements.txt).
"""

import os
import httpx

SERPAPI_BASE = "https://serpapi.com/search"


def _api_key() -> str:
    return os.environ.get("SERPAPI_KEY", "")


def _parse_flight_group(flights_list: list) -> list:
    """Parse best_flights or other_flights arrays from SerpApi response."""
    results = []
    for option in flights_list:
        legs = option.get("flights", [])
        if not legs:
            continue

        first_leg = legs[0]
        last_leg  = legs[-1]

        dep_airport = first_leg.get("departure_airport", {})
        arr_airport = last_leg.get("arrival_airport", {})

        airlines = [leg.get("airline", "") for leg in legs if leg.get("airline")]
        airline  = airlines[0] if airlines else ""

        stops = max(len(legs) - 1, 0)

        total_minutes = option.get("total_duration", 0)
        hours, mins   = divmod(total_minutes, 60)
        duration_str  = f"{hours}h {mins}m"

        results.append({
            "id":             option.get("booking_token", f"{dep_airport.get('id','')}-{arr_airport.get('id','')}"),
            "price":          str(option.get("price", "0")),
            "currency":       "USD",
            "origin":         dep_airport.get("id", ""),
            "destination":    arr_airport.get("id", ""),
            "departure_time": dep_airport.get("time", ""),
            "arrival_time":   arr_airport.get("time", ""),
            "duration":       duration_str,
            "stops":          stops,
            "airline":        airline,
            "cabin_class":    option.get("travel_class", "ECONOMY"),
        })
    return results


async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    travel_class: str = "ECONOMY",
) -> dict:
    """
    Search for flight offers via SerpApi Google Flights.

    Args:
        origin:         IATA airport code (e.g. "LAX")
        destination:    IATA airport code (e.g. "JFK")
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
            "error": "SERPAPI_KEY not configured. Get a free key (250 req/mo) at serpapi.com",
        }

    travel_class_map = {
        "ECONOMY": 1, "PREMIUM_ECONOMY": 2, "BUSINESS": 3, "FIRST": 4,
    }

    params = {
        "engine":         "google_flights",
        "departure_id":   origin.upper(),
        "arrival_id":     destination.upper(),
        "outbound_date":  departure_date,
        "adults":         adults,
        "travel_class":   travel_class_map.get(travel_class.upper(), 1),
        "currency":       "USD",
        "hl":             "en",
        "api_key":        api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(SERPAPI_BASE, params=params)
            resp.raise_for_status()
            body = resp.json()

        flights = (
            _parse_flight_group(body.get("best_flights", []))
            + _parse_flight_group(body.get("other_flights", []))
        )
        return {"data": flights[:20], "error": None}

    except httpx.HTTPStatusError as e:
        return {"data": [], "error": f"SerpApi error {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"data": [], "error": str(e)}


async def get_flight_details(offer_id: str) -> dict:
    """
    SerpApi does not have a stateful offer-by-ID endpoint.
    Clients should use the data returned directly from search_flights.
    """
    return {
        "data": {
            "id":   offer_id,
            "note": "Re-run search_flights to get full details for this offer.",
        },
        "error": None,
    }
