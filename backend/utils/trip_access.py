"""Shared trip-access guards.

Used by routers that expose trip-scoped resources (activity feed, gallery,
media comments, etc.) to enforce that the caller is a member or owner of
the trip before reading or writing.
"""
from fastapi import HTTPException

from supabase_client import supabase, async_safe_single, safe_single


async def require_trip_member(trip_id: str, user_id: str) -> None:
    """Raise 403 if the user is not an active member or owner of the trip.

    Async variant — use from `async def` route handlers.
    """
    member = await async_safe_single(
        supabase.table("trip_members")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_at", None)
    )
    if member and member.data:
        return

    owner = await async_safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
    )
    if owner and owner.data:
        return

    raise HTTPException(status_code=403, detail="Not a member of this trip")


def require_trip_member_sync(trip_id: str, user_id: str) -> None:
    """Sync variant of `require_trip_member` for use in non-async handlers."""
    member = safe_single(
        supabase.table("trip_members")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_at", None)
    )
    if member and member.data:
        return

    owner = safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
    )
    if owner and owner.data:
        return

    raise HTTPException(status_code=403, detail="Not a member of this trip")
