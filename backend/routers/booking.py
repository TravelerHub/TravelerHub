from typing import Optional, Any, Dict, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from supabase_client import supabase

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

# --- Pydantic models ---

class BookingCreate(BaseModel):
    trip_id: str
    title: str
    vendor: Optional[str] = None
    type: str = Field(default="other")  # hotel|flight|car|activity|other
    start_time: Optional[str] = None    # ISO string
    end_time: Optional[str] = None      # ISO string
    confirmation_code: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = "USD"
    notes: Optional[str] = None
    created_by: Optional[str] = None    # set this from auth if you have it

class BookingPatch(BaseModel):
    title: Optional[str] = None
    vendor: Optional[str] = None
    type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    confirmation_code: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None        # active|cancelled

class CancelBody(BaseModel):
    reason: Optional[str] = None


# --- Helpers (membership check) ---

def ensure_trip_member(trip_id: str, user_id: str) -> None:
    """
    Rename tables/columns to match your schema.
    Option A: you have trip_member table (trip_id, user_id)
    Option B: trip -> group_id, and group_member table (group_id, user_id)
    """
    # Example assumes: trips table has id, group_id
    trip = supabase.table("trip").select("id,group_id").eq("id", trip_id).maybe_single().execute()
    if not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    group_id = trip.data["group_id"]

    # Example assumes: group_member has group_id, user_id
    membership = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a trip member")


# --- Routes ---

@router.get("")
def list_bookings(
    tripId: str = Query(...),
    userId: str = Query(...),
) -> List[Dict[str, Any]]:
    ensure_trip_member(tripId, userId)

    res = (
        supabase.table("booking")
        .select("*")
        .eq("trip_id", tripId)
        .order("start_time", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/{booking_id}")
def get_booking(booking_id: str, userId: str = Query(...)) -> Dict[str, Any]:
    b = supabase.table("booking").select("*").eq("id", booking_id).maybe_single().execute()
    if not b.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(b.data["trip_id"], userId)
    return b.data


@router.post("")
def create_booking(body: BookingCreate, userId: str = Query(...)) -> Dict[str, Any]:
    ensure_trip_member(body.trip_id, userId)

    payload = body.model_dump()
    # If you want to enforce created_by from userId:
    payload["created_by"] = userId
    payload.setdefault("status", "active")

    res = supabase.table("booking").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.patch("/{booking_id}")
def update_booking(
    booking_id: str,
    body: BookingPatch,
    userId: str = Query(...),
) -> Dict[str, Any]:
    current = (
        supabase.table("booking")
        .select("*")
        .eq("id", booking_id)
        .maybe_single()
        .execute()
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], userId)

    # FIX: remove the stray "_" and filter out None values
    patch = {k: v for k, v in body.model_dump().items() if v is not None}

    if not patch:
        return current.data

    res = supabase.table("booking").update(patch).eq("id", booking_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return res.data[0]
