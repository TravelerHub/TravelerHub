from typing import Optional, Any, Dict, List
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from supabase_client import supabase, safe_single
from utils import oauth2
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)

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
    trip = safe_single(supabase.table("trips").select("id,owner_id").eq("id", trip_id))
    if not trip.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.data.get("owner_id") == user_id:
        return

    membership = (
        supabase.table("trip_members")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_at", None)
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a trip member")


# --- Routes ---

@router.get("")
@limiter.limit("60/minute")
def list_bookings(
    request: Request,
    trip_id: str = Query(...),
    current_user: dict = Depends(oauth2.get_current_user)
) -> List[Dict[str, Any]]:
    ensure_trip_member(trip_id, current_user["id"])

    res = (
        supabase.table("booking")
        .select("*")
        .eq("trip_id", trip_id)
        .order("start_time", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/{booking_id}")
@limiter.limit("60/minute")
def get_booking(
    request: Request,
    booking_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    b = safe_single(supabase.table("booking").select("*").eq("id", booking_id))
    if not b.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(b.data["trip_id"], current_user["id"])
    return b.data


@router.post("")
@limiter.limit("30/minute")
def create_booking(
    request: Request,
    body: BookingCreate,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    ensure_trip_member(body.trip_id, current_user["id"])

    payload = body.model_dump()
    # If you want to enforce created_by from userId:
    payload["created_by"] = current_user["id"]
    payload.setdefault("status", "active")

    res = supabase.table("booking").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.patch("/{booking_id}")
@limiter.limit("30/minute")
def update_booking(
    request: Request,
    booking_id: str,
    body: BookingPatch,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    current = safe_single(supabase.table("booking").select("*").eq("id", booking_id))
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], current_user["id"])

    # FIX: remove the stray "_" and filter out None values
    patch = {k: v for k, v in body.model_dump().items() if v is not None}

    if not patch:
        return current.data

    res = supabase.table("booking").update(patch).eq("id", booking_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return res.data[0]
