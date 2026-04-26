import asyncio
import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from supabase_client import supabase
from utils.oauth2 import get_current_user
from utils.logger import get_logger
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = get_logger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    read: bool
    trip_id: Optional[str] = None
    created_at: str


def create_notification(user_id: str, type: str, title: str, body: str, trip_id: Optional[str] = None):
    """Helper to insert a notification row. Call this from other routers."""
    try:
        supabase.table("notifications").insert({
            "user_id": user_id,
            "type": type,
            "title": title,
            "body": body,
            "read": False,
            "trip_id": trip_id,
        }).execute()
    except Exception as e:
        logger.warning("[create_notification] failed: %s", e, exc_info=True)  # non-fatal


@router.get("", response_model=List[NotificationOut])
@limiter.limit("60/minute")
async def get_notifications(request: Request, current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    res = await asyncio.to_thread(
        lambda: supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data or []


@router.get("/unread-count")
@limiter.limit("60/minute")
async def get_unread_count(request: Request, current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    res = await asyncio.to_thread(
        lambda: supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("read", False)
        .execute()
    )
    return {"count": res.count or 0}


@router.post("/{notification_id}/read")
@limiter.limit("60/minute")
async def mark_read(request: Request, notification_id: str, current_user=Depends(get_current_user)):
    await asyncio.to_thread(
        lambda: supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    await asyncio.to_thread(
        lambda: supabase.table("notifications").update({"read": True}).eq("user_id", user_id).execute()
    )
    return {"ok": True}
