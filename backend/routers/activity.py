from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/activity", tags=["Activity Feed"])


class ActivityCreate(BaseModel):
    trip_id: str
    action: str       # 'voted', 'added_photo', 'checked_task', 'added_expense', 'pinned_location', 'joined', 'commented'
    subject: Optional[str] = None
    meta: Optional[dict] = {}


@router.post("/", status_code=201)
def log_activity(body: ActivityCreate, current_user=Depends(oauth2.get_current_user)):
    """Log a social activity event for a trip."""
    user_id = current_user["id"]

    result = supabase.table("trip_activity").insert({
        "trip_id": body.trip_id,
        "user_id": user_id,
        "action": body.action,
        "subject": body.subject,
        "meta": body.meta or {},
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to log activity")
    return result.data[0]


@router.get("/{trip_id}")
def get_activity(
    trip_id: str,
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0),
    current_user=Depends(oauth2.get_current_user),
):
    """Get the activity feed for a trip, newest first, with author display name."""
    result = (
        supabase.table("trip_activity")
        .select("*, users!trip_activity_user_id_fkey(id, username, full_name, profile_picture_url)")
        .eq("trip_id", trip_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []
