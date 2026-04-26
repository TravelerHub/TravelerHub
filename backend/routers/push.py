"""
Web Push subscription management.
Frontend subscribes → stores in DB → backend sends pushes via notifications.
"""
# SQL to run in Supabase:
# CREATE TABLE IF NOT EXISTS push_subscriptions (
#   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
#   user_id uuid REFERENCES auth.users NOT NULL,
#   endpoint text UNIQUE NOT NULL,
#   p256dh text NOT NULL,
#   auth text NOT NULL,
#   user_agent text,
#   created_at timestamptz DEFAULT now()
# );
# ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
# CREATE POLICY "Users manage own subscriptions"
#   ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from supabase_client import supabase
from utils.oauth2 import get_current_user
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/push", tags=["Push"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # { "p256dh": "...", "auth": "..." }
    user_agent: Optional[str] = None


@router.post("/subscribe")
@limiter.limit("30/minute")
def save_subscription(request: Request, sub: PushSubscription, current_user=Depends(get_current_user)):
    """Store a browser push subscription for the current user."""
    user_id = current_user["id"]
    try:
        # Upsert so re-subscribing on the same browser doesn't duplicate
        supabase.table("push_subscriptions").upsert({
            "user_id": user_id,
            "endpoint": sub.endpoint,
            "p256dh": sub.keys.get("p256dh"),
            "auth": sub.keys.get("auth"),
            "user_agent": sub.user_agent,
        }, on_conflict="endpoint").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True}


@router.delete("/subscribe")
@limiter.limit("30/minute")
def remove_subscription(request: Request, endpoint: str, current_user=Depends(get_current_user)):
    """Unsubscribe (called when user revokes permission)."""
    supabase.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
    return {"ok": True}
