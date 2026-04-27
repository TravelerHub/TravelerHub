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

Flight Search (Amadeus):
  GET  /api/bookings/flights/search     — search flight offers
  GET  /api/bookings/flights/{offer_id} — flight offer details

Persistence:
  POST /api/bookings/hotels/save
  POST /api/bookings/cars/save
  POST /api/bookings/attractions/save
  POST /api/bookings/flights/save

Trip queries:
  GET   /api/bookings/trips/{trip_id}/summary
  PATCH /api/bookings/{booking_id}/status

All responses: { "data": ..., "error": ... }
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from utils import oauth2
from utils.trip_access import require_trip_member
from supabase_client import supabase, async_safe_single

limiter = Limiter(key_func=get_remote_address)

from services.booking.hotels_service import search_city, search_hotels, get_hotel_offer
from services.booking.cars_service import search_cars, get_car_details
from services.booking.attractions_service import search_activities, get_activity_details
from services.booking.flights_service import search_flights, get_flight_details
from services.booking.booking_orchestrator import (
    save_hotel_booking,
    save_car_booking,
    save_attraction_booking,
    get_trip_bookings_summary,
)
from services.booking.booking_repository import update_booking_status, create_booking, add_participants

router = APIRouter(prefix="/api/bookings", tags=["bookings-search"])


def _user_id(current_user) -> str:
    uid = current_user.get("id") or current_user.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return uid


# ── City lookup (Google Geocoding) ─────────────────────────────────────────────

@router.get("/hotels/city")
async def hotels_city(
    name: str = Query(..., description="City name, e.g. 'Los Angeles'"),
    current_user=Depends(oauth2.get_current_user),
):
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
    current_user=Depends(oauth2.get_current_user),
):
    return await search_hotels(lat, lng, checkin, checkout, adults, rooms)


@router.get("/hotels/{place_id}")
async def hotels_details(
    place_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    return await get_hotel_offer(place_id)


# ── Search: Cars (stub) ────────────────────────────────────────────────────────

@router.get("/cars/search")
async def cars_search(
    airport: str = Query(...),
    pickup: str = Query(...),
    dropoff: str = Query(...),
    driver_age: int = Query(25, ge=18),
    current_user=Depends(oauth2.get_current_user),
):
    return await search_cars(airport, pickup, dropoff, driver_age)


@router.get("/cars/{car_id}")
async def cars_details(
    car_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    return await get_car_details(car_id)


# ── Search: Activities ─────────────────────────────────────────────────────────

@router.get("/attractions/search")
async def attractions_search(
    lat: float = Query(..., description="Latitude of the city centre"),
    lng: float = Query(..., description="Longitude of the city centre"),
    radius: int = Query(5, ge=1, le=20, description="Search radius in km"),
    current_user=Depends(oauth2.get_current_user),
):
    return await search_activities(lat, lng, radius)


@router.get("/attractions/{activity_id}")
async def attractions_details(
    activity_id: str,
    current_user=Depends(oauth2.get_current_user),
):
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
async def hotels_save(
    body: HotelSaveBody,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    await require_trip_member(body.trip_id, uid)
    return await save_hotel_booking(
        trip_id=body.trip_id,
        created_by=uid,
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
async def cars_save(
    body: CarSaveBody,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    await require_trip_member(body.trip_id, uid)
    return await save_car_booking(
        trip_id=body.trip_id,
        created_by=uid,
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
async def attractions_save(
    body: AttractionSaveBody,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    await require_trip_member(body.trip_id, uid)
    return await save_attraction_booking(
        trip_id=body.trip_id,
        created_by=uid,
        attraction_data=body.attraction_data,
        visit_date=body.visit_date,
        visitor_count=body.visitor_count,
        price=body.price,
        currency=body.currency,
        participants=body.participants,
    )


# ── Search: Flights ───────────────────────────────────────────────────────────

@router.get("/flights/search")
@limiter.limit("30/minute")
async def flights_search(
    request: Request,
    origin: str = Query(..., description="Origin airport IATA code, e.g. LAX"),
    destination: str = Query(..., description="Destination airport IATA code, e.g. JFK"),
    date: str = Query(..., description="Departure date YYYY-MM-DD"),
    adults: int = Query(1, ge=1),
    cabin_class: str = Query("ECONOMY", description="ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST"),
    current_user=Depends(oauth2.get_current_user),
):
    return await search_flights(
        origin=origin,
        destination=destination,
        departure_date=date,
        adults=adults,
        travel_class=cabin_class,
    )


@router.get("/flights/{offer_id}")
async def flights_details(
    offer_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    return await get_flight_details(offer_id)


# ── Save: Flights ──────────────────────────────────────────────────────────────

class FlightSaveBody(BaseModel):
    trip_id: str
    created_by: str
    flight_data: Dict[str, Any]
    departure_date: str
    arrival_date: str
    adults: int = 1
    price: Optional[float] = None
    currency: str = "USD"
    participants: List[str] = []


@router.post("/flights/save")
async def flights_save(
    body: FlightSaveBody,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    await require_trip_member(body.trip_id, uid)
    flight = body.flight_data
    title = (
        f"{flight.get('airline', '')} {flight.get('origin', '')} → {flight.get('destination', '')}"
    ).strip() or "Flight"
    details = {
        "flight_id":      flight.get("id"),
        "origin":         flight.get("origin"),
        "destination":    flight.get("destination"),
        "departure_time": flight.get("departure_time"),
        "arrival_time":   flight.get("arrival_time"),
        "duration":       flight.get("duration"),
        "stops":          flight.get("stops"),
        "airline":        flight.get("airline"),
        "cabin_class":    flight.get("cabin_class"),
        "adults":         body.adults,
    }
    resolved_price = body.price or (float(flight["price"]) if flight.get("price") else None)
    resolved_currency = body.currency or flight.get("currency", "USD")

    result = await create_booking(
        trip_id=body.trip_id,
        created_by=uid,
        type="flight",
        title=title,
        vendor=flight.get("airline") or None,
        source="google_flights",
        external_id=str(flight.get("id") or ""),
        start_time=body.departure_date if "T" in body.departure_date else f"{body.departure_date}T00:00:00",
        end_time=body.arrival_date if "T" in body.arrival_date else f"{body.arrival_date}T23:59:59",
        price=resolved_price,
        currency=resolved_currency,
        details=details,
    )
    if result["data"] and body.participants:
        await add_participants(result["data"]["id"], body.participants)
    return result


# ── Trip summary ───────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/summary")
async def trip_bookings_summary(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    await require_trip_member(trip_id, uid)
    return await get_trip_bookings_summary(trip_id)


# ── Status update ──────────────────────────────────────────────────────────────

class StatusBody(BaseModel):
    status: str  # "pending" | "confirmed" | "cancelled"


@router.patch("/{booking_id}/status")
async def booking_status_update(
    booking_id: str,
    body: StatusBody,
    current_user=Depends(oauth2.get_current_user),
):
    uid = _user_id(current_user)
    booking = await async_safe_single(
        supabase.table("booking").select("trip_id").eq("id", booking_id)
    )
    if not booking or not booking.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    await require_trip_member(booking.data["trip_id"], uid)
    return await update_booking_status(booking_id, body.status)
