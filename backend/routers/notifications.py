import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase_client import supabase
from utils.oauth2 import get_current_user

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
    except Exception:
        pass  # non-fatal


@router.get("", response_model=List[NotificationOut])
def get_notifications(current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    res = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data or []


@router.get("/unread-count")
def get_unread_count(current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    res = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("read", False)
        .execute()
    )
    return {"count": res.count or 0}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, current_user=Depends(get_current_user)):
    supabase.table("notifications").update({"read": True}).eq("id", notification_id).execute()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    supabase.table("notifications").update({"read": True}).eq("user_id", user_id).execute()
    return {"ok": True}
