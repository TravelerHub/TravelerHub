"""
booking_repository.py
Raw Supabase CRUD for public.bookings and public.booking_participants.
All functions are async-compatible but the Supabase Python client is sync
(no await needed on its calls).
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from supabase_client import supabase


# ── bookings ──────────────────────────────────────────────────────────────────

async def create_booking(
    trip_id: str,
    created_by: str,
    type: str,
    title: str,
    vendor: str | None = None,
    source: str = "manual",
    external_id: str | None = None,
    external_ref: str | None = None,
    booking_url: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    price: float | None = None,
    currency: str = "USD",
    details: dict | None = None,
) -> dict:
    try:
        payload = {
            "trip_id": trip_id,
            "created_by": created_by,
            "type": type,
            "title": title,
            "vendor": vendor,
            "source": source,
            "external_id": external_id,
            "external_ref": external_ref,
            "booking_url": booking_url,
            "start_time": start_time,
            "end_time": end_time,
            "price": price,
            "currency": currency,
            "details": details or {},
        }
        # strip None values so Supabase uses column defaults where applicable
        payload = {k: v for k, v in payload.items() if v is not None}
        res = supabase.table("bookings").insert(payload).execute()
        if not res.data:
            return {"data": None, "error": "Insert returned no data"}
        return {"data": res.data[0], "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}


async def get_bookings_by_trip(trip_id: str) -> dict:
    try:
        res = (
            supabase.table("bookings")
            .select("*")
            .eq("trip_id", trip_id)
            .order("start_time", desc=False)
            .execute()
        )
        return {"data": res.data or [], "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}


async def get_booking(booking_id: str) -> dict:
    try:
        res = (
            supabase.table("bookings")
            .select("*")
            .eq("id", booking_id)
            .maybe_single()
            .execute()
        )
        return {"data": res.data, "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}


async def update_booking_status(booking_id: str, status: str) -> dict:
    try:
        res = (
            supabase.table("bookings")
            .update({"status": status})
            .eq("id", booking_id)
            .execute()
        )
        if not res.data:
            return {"data": None, "error": "Booking not found or update failed"}
        return {"data": res.data[0], "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}


async def cancel_booking(booking_id: str) -> dict:
    return await update_booking_status(booking_id, "cancelled")


# ── booking_participants ───────────────────────────────────────────────────────

async def add_participants(booking_id: str, user_ids: list) -> dict:
    if not user_ids:
        return {"data": [], "error": None}
    try:
        rows = [{"booking_id": booking_id, "user_id": uid} for uid in user_ids]
        res = supabase.table("booking_participants").insert(rows).execute()
        return {"data": res.data or [], "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}
