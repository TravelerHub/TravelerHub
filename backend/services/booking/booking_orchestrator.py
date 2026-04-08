"""
booking_orchestrator.py
Combines Amadeus API search results with Supabase persistence
via booking_repository.
"""

from services.booking.booking_repository import (
    create_booking,
    get_bookings_by_trip,
    add_participants,
)


# ── Hotels ────────────────────────────────────────────────────────────────────

async def save_hotel_booking(
    trip_id: str,
    created_by: str,
    hotel_data: dict,
    checkin: str,
    checkout: str,
    adults: int,
    price: float | None = None,
    currency: str = "USD",
    participants: list = [],
) -> dict:
    # Google Places shape: hotel_id (place_id), name, address, rating, price_level, lat, lng
    title = hotel_data.get("name") or "Hotel"
    details = {
        "hotel_id": hotel_data.get("hotel_id"),
        "hotel_name": title,
        "address": hotel_data.get("address"),
        "check_in": checkin,
        "check_out": checkout,
        "adults": adults,
        "rating": hotel_data.get("rating"),
        "price_level": hotel_data.get("price_level"),
        "price_label": hotel_data.get("price_label"),
        "lat": hotel_data.get("lat"),
        "lng": hotel_data.get("lng"),
    }
    resolved_price = price or (float(hotel_data["price"]) if hotel_data.get("price") else None)
    resolved_currency = currency or hotel_data.get("currency", "USD")

    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="hotel",
        title=title,
        vendor=title,
        source="manual",
        external_id=str(hotel_data.get("hotel_id") or ""),
        start_time=f"{checkin}T00:00:00",
        end_time=f"{checkout}T00:00:00",
        price=resolved_price,
        currency=resolved_currency,
        details=details,
    )
    if result["data"] and participants:
        await add_participants(result["data"]["id"], participants)
    return result


# ── Cars ──────────────────────────────────────────────────────────────────────

async def save_car_booking(
    trip_id: str,
    created_by: str,
    car_data: dict,
    pickup_datetime: str,
    dropoff_datetime: str,
    price: float | None = None,
    currency: str = "USD",
    participants: list = [],
) -> dict:
    title = car_data.get("title") or car_data.get("name") or "Car Rental"
    details = {
        "pickup_datetime": pickup_datetime,
        "dropoff_datetime": dropoff_datetime,
    }
    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="car_rental",
        title=title,
        vendor=car_data.get("vendor") or None,
        source="manual",
        start_time=pickup_datetime,
        end_time=dropoff_datetime,
        price=price,
        currency=currency,
        details=details,
    )
    if result["data"] and participants:
        await add_participants(result["data"]["id"], participants)
    return result


# ── Attractions ───────────────────────────────────────────────────────────────

async def save_attraction_booking(
    trip_id: str,
    created_by: str,
    attraction_data: dict,
    visit_date: str,
    visitor_count: int,
    price: float | None = None,
    currency: str = "USD",
    participants: list = [],
) -> dict:
    # Amadeus normalized shape: id, name, description, price, currency, pictures, booking_link
    title = attraction_data.get("name") or attraction_data.get("title") or "Attraction"
    details = {
        "activity_id": attraction_data.get("id"),
        "name": title,
        "description": attraction_data.get("description"),
        "date": visit_date,
        "visitor_count": visitor_count,
        "lat": attraction_data.get("lat"),
        "lng": attraction_data.get("lng"),
        "pictures": attraction_data.get("pictures", []),
        "booking_link": attraction_data.get("booking_link"),
    }
    resolved_price = price or (float(attraction_data["price"]) if attraction_data.get("price") else None)
    resolved_currency = currency or attraction_data.get("currency", "USD")

    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="attraction",
        title=title,
        vendor=None,
        source="manual",
        external_id=str(attraction_data.get("id") or ""),
        booking_url=attraction_data.get("booking_link"),
        start_time=f"{visit_date}T00:00:00",
        end_time=f"{visit_date}T23:59:59",
        price=resolved_price,
        currency=resolved_currency,
        details=details,
    )
    if result["data"] and participants:
        await add_participants(result["data"]["id"], participants)
    return result


# ── Trip summary ──────────────────────────────────────────────────────────────

async def get_trip_bookings_summary(trip_id: str) -> dict:
    result = await get_bookings_by_trip(trip_id)
    if result["error"]:
        return result
    grouped = {"hotels": [], "cars": [], "attractions": [], "flights": []}
    type_map = {
        "hotel": "hotels",
        "car_rental": "cars",
        "attraction": "attractions",
        "flight": "flights",
    }
    for booking in result["data"]:
        key = type_map.get(booking.get("type"), "hotels")
        grouped[key].append(booking)
    return {"data": grouped, "error": None}
