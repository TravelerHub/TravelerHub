"""
booking_orchestrator.py
Single entry point that combines Booking.com API search results with
saving to Supabase via booking_repository.
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
    title = hotel_data.get("name") or hotel_data.get("hotel_name") or "Hotel"
    details = {
        "accommodation_id": hotel_data.get("accommodation_id") or hotel_data.get("hotel_id"),
        "hotel_name": title,
        "address": hotel_data.get("address"),
        "check_in": checkin,
        "check_out": checkout,
        "adults": adults,
        "meal_plan": hotel_data.get("meal_plan"),
        "cancellation": hotel_data.get("free_cancellation"),
        "thumbnail": hotel_data.get("thumbnail") or hotel_data.get("main_photo_url"),
    }
    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="hotel",
        title=title,
        vendor=hotel_data.get("chain_name") or hotel_data.get("hotel_name"),
        source="booking.com",
        external_id=str(hotel_data.get("accommodation_id") or hotel_data.get("hotel_id") or ""),
        start_time=f"{checkin}T00:00:00",
        end_time=f"{checkout}T00:00:00",
        price=price,
        currency=currency,
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
    vehicle = car_data.get("vehicle", {}) or {}
    supplier = car_data.get("vendor", {}) or car_data.get("supplier", {}) or {}
    vehicle_name = vehicle.get("name") or car_data.get("car_name") or car_data.get("name") or "Car"
    supplier_name = supplier.get("name") or car_data.get("supplier_name") or ""
    title = f"{vehicle_name} — {supplier_name}".strip(" —") if supplier_name else vehicle_name

    redirect_url = (
        car_data.get("redirect_url")
        or car_data.get("booking_url")
        or car_data.get("url")
    )
    details = {
        "car_id": car_data.get("id") or car_data.get("car_id"),
        "vehicle_name": vehicle_name,
        "supplier": supplier_name,
        "pickup_datetime": pickup_datetime,
        "dropoff_datetime": dropoff_datetime,
        "category": vehicle.get("category") or car_data.get("category"),
        "seats": vehicle.get("seats") or car_data.get("seats"),
        "booking_token": car_data.get("booking_token"),
        "redirect_url": redirect_url,
    }
    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="car_rental",
        title=title,
        vendor=supplier_name or None,
        source="booking.com",
        external_id=str(car_data.get("id") or car_data.get("car_id") or ""),
        booking_url=redirect_url,
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
    title = attraction_data.get("name") or attraction_data.get("title") or "Attraction"
    details = {
        "attraction_id": attraction_data.get("id") or attraction_data.get("attraction_id"),
        "name": title,
        "address": attraction_data.get("address"),
        "date": visit_date,
        "duration_minutes": attraction_data.get("duration_minutes"),
        "visitor_count": visitor_count,
        "category": attraction_data.get("category"),
        "thumbnail": attraction_data.get("thumbnail") or attraction_data.get("image_url"),
    }
    result = await create_booking(
        trip_id=trip_id,
        created_by=created_by,
        type="attraction",
        title=title,
        vendor=attraction_data.get("operator") or attraction_data.get("supplier"),
        source="booking.com",
        external_id=str(attraction_data.get("id") or attraction_data.get("attraction_id") or ""),
        start_time=f"{visit_date}T00:00:00",
        end_time=f"{visit_date}T23:59:59",
        price=price,
        currency=currency,
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
