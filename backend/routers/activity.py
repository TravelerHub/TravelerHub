import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from utils import oauth2
from supabase_client import supabase
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/activity", tags=["Activity Feed"])


class ActivityCreate(BaseModel):
    trip_id: str
    action: str       # 'voted', 'added_photo', 'checked_task', 'added_expense', 'pinned_location', 'joined', 'commented'
    subject: Optional[str] = None
    meta: Optional[dict] = {}


@router.post("/", status_code=201)
@limiter.limit("30/minute")
async def log_activity(request: Request, body: ActivityCreate, current_user=Depends(oauth2.get_current_user)):
    """Log a social activity event for a trip."""
    user_id = current_user["id"]

    result = await asyncio.to_thread(
        lambda: supabase.table("trip_activity").insert({
            "trip_id": body.trip_id,
            "user_id": user_id,
            "action": body.action,
            "subject": body.subject,
            "meta": body.meta or {},
        }).execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to log activity")
    return result.data[0]


@router.get("/{trip_id}")
@limiter.limit("60/minute")
async def get_activity(
    request: Request,
    trip_id: str,
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0),
    current_user=Depends(oauth2.get_current_user),
):
    """Get the activity feed for a trip, newest first, with author display name."""
    result = await asyncio.to_thread(
        lambda: supabase.table("trip_activity")
        .select("*, users!trip_activity_user_id_fkey(id, username, full_name, profile_picture_url)")
        .eq("trip_id", trip_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []
