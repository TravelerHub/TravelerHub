"""
Google Places-powered booking routes + Supabase persistence.
Prefix: /api/bookings  (registered BEFORE booking.py wildcard routes in main.py)

City / geocode lookup:
  GET  /api/bookings/hotels/city        — city name → lat/lng (Google Geocoding)

Hotel Search (Google Places Nearby Search):
  GET  /api/bookings/hotels/search      — search hotels by lat/lng
  GET  /api/bookings/hotels/{place_id}  — hotel place details

Activity Search (Google Places Nearby Search):
  GET  /api/bookings/attractions/search — search tourist attractions by lat/lng
  GET  /api/bookings/attractions/{id}   — activity details

Car Rentals:
  GET  /api/bookings/cars/search        — stub (add manually)

Persistence:
  POST /api/bookings/hotels/save
  POST /api/bookings/cars/save
  POST /api/bookings/attractions/save

Trip queries:
  GET   /api/bookings/trips/{trip_id}/summary
  PATCH /api/bookings/{booking_id}/status

All responses: { "data": ..., "error": ... }
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from services.booking.hotels_service import search_city, search_hotels, get_hotel_offer
from services.booking.cars_service import search_cars, get_car_details
from services.booking.attractions_service import search_activities, get_activity_details
from services.booking.booking_orchestrator import (
    save_hotel_booking,
    save_car_booking,
    save_attraction_booking,
    get_trip_bookings_summary,
)
from services.booking.booking_repository import update_booking_status

router = APIRouter(prefix="/api/bookings", tags=["bookings-search"])


# ── City lookup (Google Geocoding) ─────────────────────────────────────────────

@router.get("/hotels/city")
async def hotels_city(name: str = Query(..., description="City name, e.g. 'Los Angeles'")):
    """Resolve a city name to lat/lng via Google Geocoding API."""
    return await search_city(name)


# ── Search: Hotels ─────────────────────────────────────────────────────────────

@router.get("/hotels/search")
async def hotels_search(
    lat: float = Query(..., description="Latitude from city lookup"),
    lng: float = Query(..., description="Longitude from city lookup"),
    checkin: str = Query(..., description="YYYY-MM-DD"),
    checkout: str = Query(..., description="YYYY-MM-DD"),
    adults: int = Query(..., ge=1),
    rooms: int = Query(1, ge=1),
):
    return await search_hotels(lat, lng, checkin, checkout, adults, rooms)


@router.get("/hotels/{place_id}")
async def hotels_details(place_id: str):
    return await get_hotel_offer(place_id)


# ── Search: Cars (stub) ────────────────────────────────────────────────────────

@router.get("/cars/search")
async def cars_search(
    airport: str = Query(...),
    pickup: str = Query(...),
    dropoff: str = Query(...),
    driver_age: int = Query(25, ge=18),
):
    return await search_cars(airport, pickup, dropoff, driver_age)


@router.get("/cars/{car_id}")
async def cars_details(car_id: str):
    return await get_car_details(car_id)


# ── Search: Activities ─────────────────────────────────────────────────────────

@router.get("/attractions/search")
async def attractions_search(
    lat: float = Query(..., description="Latitude of the city centre"),
    lng: float = Query(..., description="Longitude of the city centre"),
    radius: int = Query(5, ge=1, le=20, description="Search radius in km"),
):
    return await search_activities(lat, lng, radius)


@router.get("/attractions/{activity_id}")
async def attractions_details(activity_id: str):
    return await get_activity_details(activity_id)


# ── Save: Hotels ───────────────────────────────────────────────────────────────

class HotelSaveBody(BaseModel):
    trip_id: str
    created_by: str
    hotel_data: Dict[str, Any]
    checkin: str
    checkout: str
    adults: int
    price: Optional[float] = None
    currency: str = "USD"
    participants: List[str] = []


@router.post("/hotels/save")
async def hotels_save(body: HotelSaveBody):
    return await save_hotel_booking(
        trip_id=body.trip_id,
        created_by=body.created_by,
        hotel_data=body.hotel_data,
        checkin=body.checkin,
        checkout=body.checkout,
        adults=body.adults,
        price=body.price,
        currency=body.currency,
        participants=body.participants,
    )


# ── Save: Cars ─────────────────────────────────────────────────────────────────

class CarSaveBody(BaseModel):
    trip_id: str
    created_by: str
    car_data: Dict[str, Any]
    pickup_datetime: str
    dropoff_datetime: str
    price: Optional[float] = None
    currency: str = "USD"
    participants: List[str] = []


@router.post("/cars/save")
async def cars_save(body: CarSaveBody):
    return await save_car_booking(
        trip_id=body.trip_id,
        created_by=body.created_by,
        car_data=body.car_data,
        pickup_datetime=body.pickup_datetime,
        dropoff_datetime=body.dropoff_datetime,
        price=body.price,
        currency=body.currency,
        participants=body.participants,
    )


# ── Save: Attractions ──────────────────────────────────────────────────────────

class AttractionSaveBody(BaseModel):
    trip_id: str
    created_by: str
    attraction_data: Dict[str, Any]
    visit_date: str
    visitor_count: int
    price: Optional[float] = None
    currency: str = "USD"
    participants: List[str] = []


@router.post("/attractions/save")
async def attractions_save(body: AttractionSaveBody):
    return await save_attraction_booking(
        trip_id=body.trip_id,
        created_by=body.created_by,
        attraction_data=body.attraction_data,
        visit_date=body.visit_date,
        visitor_count=body.visitor_count,
        price=body.price,
        currency=body.currency,
        participants=body.participants,
    )


# ── Trip summary ───────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/summary")
async def trip_bookings_summary(trip_id: str):
    return await get_trip_bookings_summary(trip_id)


# ── Status update ──────────────────────────────────────────────────────────────

class StatusBody(BaseModel):
    status: str  # "pending" | "confirmed" | "cancelled"


@router.patch("/{booking_id}/status")
async def booking_status_update(booking_id: str, body: StatusBody):
    return await update_booking_status(booking_id, body.status)
