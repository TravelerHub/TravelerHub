"""
flights_service.py
Amadeus Self-Service API – flight offer search and details.

Credentials are loaded from environment variables:
  AMADEUS_API_KEY
  AMADEUS_API_SECRET

Install dependency: pip install amadeus
"""

import os
from amadeus import Client, ResponseError

# ── Amadeus client (lazy singleton) ──────────────────────────────────────────

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(
            client_id=os.environ.get("AMADEUS_API_KEY", ""),
            client_secret=os.environ.get("AMADEUS_API_SECRET", ""),
        )
    return _client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_offer(offer: dict) -> dict:
    """Normalise a raw Amadeus flight-offer into the standard TravelerHub shape."""
    itineraries = offer.get("itineraries", [])
    price_info = offer.get("price", {})

    # First itinerary / first segment for the headline fields
    first_seg = {}
    total_stops = 0
    total_duration = ""
    if itineraries:
        first_it = itineraries[0]
        segments = first_it.get("segments", [])
        total_stops = max(len(segments) - 1, 0)
        total_duration = first_it.get("duration", "")
        if segments:
            first_seg = segments[0]

    departure = first_seg.get("departure", {})
    arrival_seg = itineraries[0].get("segments", [{}])[-1].get("arrival", {}) if itineraries else {}

    # Carrier: prefer marketing carrier code
    carrier_code = first_seg.get("carrierCode", "")
    operating = first_seg.get("operating", {})
    airline = operating.get("carrierCode", carrier_code) or carrier_code

    # Cabin class from traveler pricings
    cabin_class = "ECONOMY"
    traveler_pricings = offer.get("travelerPricings", [])
    if traveler_pricings:
        fare_details = traveler_pricings[0].get("fareDetailsBySegment", [])
        if fare_details:
            cabin_class = fare_details[0].get("cabin", "ECONOMY")

    return {
        "id":             offer.get("id", ""),
        "price":          price_info.get("total", "0"),
        "currency":       price_info.get("currency", "USD"),
        "origin":         departure.get("iataCode", ""),
        "destination":    arrival_seg.get("iataCode", ""),
        "departure_time": departure.get("at", ""),
        "arrival_time":   arrival_seg.get("at", ""),
        "duration":       total_duration,
        "stops":          total_stops,
        "airline":        airline,
        "cabin_class":    cabin_class,
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def search_flights(
    origin: str,
    destination: str,
    departure_date: str,
    adults: int = 1,
    travel_class: str = "ECONOMY",
) -> dict:
    """
    Search for flight offers via Amadeus Flight Offers Search.

    Args:
        origin:         IATA code of the origin airport (e.g. "LAX")
        destination:    IATA code of the destination airport (e.g. "JFK")
        departure_date: ISO date string "YYYY-MM-DD"
        adults:         Number of adult passengers (≥1)
        travel_class:   "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"

    Returns:
        {"data": [<flight>, ...], "error": None}  on success
        {"data": [],              "error": "<msg>"} on failure
    """
    try:
        client = _get_client()
        response = client.shopping.flight_offers_search.get(
            originLocationCode=origin.upper(),
            destinationLocationCode=destination.upper(),
            departureDate=departure_date,
            adults=adults,
            travelClass=travel_class.upper(),
            max=20,
        )
        flights = [_parse_offer(o) for o in (response.data or [])]
        return {"data": flights, "error": None}
    except ResponseError as e:
        return {"data": [], "error": str(e)}
    except Exception as e:
        return {"data": [], "error": str(e)}


async def get_flight_details(offer_id: str) -> dict:
    """
    Retrieve the cached details for a specific flight offer.

    The Amadeus free-tier does not expose a single-offer GET endpoint;
    this function returns a placeholder that instructs the caller to
    use the offer data already returned by search_flights.

    Args:
        offer_id: The flight offer ID returned by search_flights.

    Returns:
        {"data": {"id": offer_id, "note": "..."}, "error": None}
    """
    # Amadeus Self-Service does not provide a stateful offer-by-ID endpoint
    # on the free tier.  The offer payload from the search response is the
    # authoritative source; clients should cache it client-side or re-run
    # the search to reprice.
    return {
        "data": {
            "id": offer_id,
            "note": (
                "Full offer details are only available within the original "
                "search response. Re-run search_flights to reprice this offer."
            ),
        },
        "error": None,
    }
