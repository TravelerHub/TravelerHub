"""
Shared Map Pins — collaborative real-time annotations for group travel.

Every group member can drop, view, upvote, and delete pins on the shared map.
Supabase Realtime broadcasts INSERT/UPDATE/DELETE to all connected clients so
every member sees changes in < 200 ms without any polling.

Endpoints:
  GET    /map-pins/{trip_id}          — fetch all pins for a trip
  POST   /map-pins/                   — create a new shared pin
  DELETE /map-pins/{pin_id}           — delete a pin (own pins only)
  POST   /map-pins/{pin_id}/upvote    — toggle upvote on a pin
  PATCH  /map-pins/{pin_id}           — edit title/note/emoji (own pins only)
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/map-pins", tags=["Map Pins"])

TABLE = "shared_map_pins"


# ─── Schemas ────────────────────────────────────────────────────────────────

class PinCreate(BaseModel):
    trip_id: str
    lat: float
    lng: float
    title: str
    note: Optional[str] = None
    emoji: Optional[str] = "📍"
    color: Optional[str] = "#183a37"


class PinUpdate(BaseModel):
    title: Optional[str] = None
    note: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _user_id(current_user: dict) -> str:
    return str(current_user.get("id") or current_user.get("user_id") or "")


def _username(current_user: dict) -> str:
    return current_user.get("username") or current_user.get("email") or "Member"


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/{trip_id}")
async def get_pins(
    trip_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Return all shared pins for a trip, newest first."""
    result = (
        supabase.table(TABLE)
        .select("*")
        .eq("trip_id", trip_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_pin(
    pin: PinCreate,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Drop a new pin on the shared group map."""
    row = {
        "trip_id": pin.trip_id,
        "user_id": _user_id(current_user),
        "username": _username(current_user),
        "lat": pin.lat,
        "lng": pin.lng,
        "title": pin.title,
        "note": pin.note,
        "emoji": pin.emoji or "📍",
        "color": pin.color or "#183a37",
        "upvoters": [],
    }
    result = supabase.table(TABLE).insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create pin")
    return result.data[0]


@router.patch("/{pin_id}")
async def update_pin(
    pin_id: str,
    updates: PinUpdate,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Edit a pin's title, note, emoji, or color (own pins only)."""
    user_id = _user_id(current_user)
    # Verify ownership
    existing = supabase.table(TABLE).select("user_id").eq("id", pin_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Pin not found")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot edit another member's pin")

    patch = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not patch:
        return existing.data[0]
    result = supabase.table(TABLE).update(patch).eq("id", pin_id).execute()
    return result.data[0] if result.data else {}


@router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pin(
    pin_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Remove a pin from the shared map (own pins only)."""
    user_id = _user_id(current_user)
    existing = supabase.table(TABLE).select("user_id").eq("id", pin_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Pin not found")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete another member's pin")
    supabase.table(TABLE).delete().eq("id", pin_id).execute()


@router.post("/{pin_id}/upvote")
async def upvote_pin(
    pin_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Toggle upvote on a pin. Returns updated upvoter list."""
    user_id = _user_id(current_user)
    existing = supabase.table(TABLE).select("upvoters").eq("id", pin_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Pin not found")

    upvoters: list = existing.data[0].get("upvoters") or []
    if user_id in upvoters:
        upvoters = [u for u in upvoters if u != user_id]
    else:
        upvoters = upvoters + [user_id]

    result = (
        supabase.table(TABLE)
        .update({"upvoters": upvoters})
        .eq("id", pin_id)
        .execute()
    )
    return result.data[0] if result.data else {"upvoters": upvoters}
