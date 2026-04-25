"""
flights_service.py
Google Flights data via fast-flights — no API key, no sign-up, completely free.

pip install fast-flights  (already in requirements.txt)

fast-flights decodes Google Flights Protobuf responses directly. It requires
no credentials and is maintained as of early 2025. The tradeoff is that it
can break if Google changes their internal API — wrap calls defensively.
"""

import asyncio
from fast_flights import FlightData, Passengers, get_flights

_SEAT_MAP = {
    "ECONOMY":         "economy",
    "PREMIUM_ECONOMY": "premium-economy",
    "BUSINESS":        "business",
    "FIRST":           "first",
}


def _parse_flight(flight, origin: str, destination: str, departure_date: str) -> dict:
    """Normalise a fast-flights Flight object into the TravelerHub flight shape."""
    price_str = ""
    if flight.price:
        # price is a string like "$250" or "250 USD" — strip currency symbols
        price_str = flight.price.replace("$", "").replace("USD", "").replace(",", "").strip()

    return {
        "id":             f"{origin}-{destination}-{flight.name}-{flight.departure}".replace(" ", "_"),
        "price":          price_str or "0",
        "currency":       "USD",
        "origin":         origin.upper(),
        "destination":    destination.upper(),
        "departure_time": f"{departure_date}T{flight.departure}" if flight.departure else departure_date,
        "arrival_time":   f"{departure_date}T{flight.arrival}" if flight.arrival else departure_date,
        "duration":       flight.duration or "",
        "stops":          flight.stops if isinstance(flight.stops, int) else (0 if flight.stops == "Nonstop" else 1),
        "airline":        flight.name or "",
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
    Search for flights via fast-flights (no API key required).

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
    seat = _SEAT_MAP.get(travel_class.upper(), "economy")

    try:
        result = await asyncio.to_thread(
            get_flights,
            flight_data=[FlightData(date=departure_date, from_airport=origin.upper(), to_airport=destination.upper())],
            trip="one-way",
            seat=seat,
            passengers=Passengers(adults=adults),
            fetch_mode="fallback",
        )

        if not result or not result.flights:
            return {"data": [], "error": "No flights found for this route and date."}

        flights = [
            _parse_flight(f, origin, destination, departure_date)
            for f in result.flights[:20]
        ]
        return {"data": flights, "error": None}

    except Exception as e:
        return {"data": [], "error": f"Flight search unavailable: {str(e)}"}


async def get_flight_details(offer_id: str) -> dict:
    """
    fast-flights does not store offer state — clients use search result data directly.
    """
    return {
        "data": {
            "id":   offer_id,
            "note": "Re-run search_flights to get full details for this offer.",
        },
        "error": None,
    }
