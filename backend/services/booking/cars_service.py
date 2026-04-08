"""
cars_service.py
Car rental search is not supported by the Amadeus free-tier API.
These stubs return a clear message so the frontend can direct users
to add car bookings manually via the Add Booking form.
"""

_NOT_AVAILABLE = "Car rental search is unavailable. Please add car bookings manually using the + Add Booking button."


async def search_cars(
    pickup_airport: str,
    pickup_datetime: str,
    dropoff_datetime: str,
    driver_age: int = 25,
) -> dict:
    return {"data": [], "error": None, "message": _NOT_AVAILABLE}


async def get_car_details(car_id: str) -> dict:
    return {"data": None, "error": _NOT_AVAILABLE}
