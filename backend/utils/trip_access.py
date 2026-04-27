"""Shared trip-access guards.

Used by routers that expose trip-scoped resources (activity feed, gallery,
media comments, finance, routes, etc.) to enforce that the caller is a
member or owner of the trip before reading or writing.

Membership is resolved against three sources, in order:
  1. `trip_members` (current schema, with `left_at` soft-delete)
  2. `group_member` (legacy schema, with `left_datetime` soft-delete)
  3. `trips.owner_id` (the trip owner is always considered a member)

The fallback to `group_member` is intentional — older trips may only have
rows in the legacy table.
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

    legacy = await async_safe_single(
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
    )
    if legacy and legacy.data:
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

    legacy = safe_single(
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
    )
    if legacy and legacy.data:
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


async def is_trip_leader(trip_id: str, user_id: str) -> bool:
    """Return True if the user is a leader/owner of the trip."""
    member = await async_safe_single(
        supabase.table("trip_members")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_at", None)
    )
    if member and member.data:
        return True

    legacy = await async_safe_single(
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_datetime", None)
    )
    if legacy and legacy.data:
        return True

    owner = await async_safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
    )
    return bool(owner and owner.data)


def is_trip_leader_sync(trip_id: str, user_id: str) -> bool:
    """Sync variant of `is_trip_leader`."""
    member = safe_single(
        supabase.table("trip_members")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_at", None)
    )
    if member and member.data:
        return True

    legacy = safe_single(
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_datetime", None)
    )
    if legacy and legacy.data:
        return True

    owner = safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
    )
    return bool(owner and owner.data)
