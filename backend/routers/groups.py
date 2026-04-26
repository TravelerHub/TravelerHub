import asyncio
import time
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from utils import oauth2
from supabase_client import supabase, async_safe_single
from utils.logger import get_logger
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)

# ---- Membership cache (READ-only, 30-second TTL) ----
# Avoids redundant DB round-trips for the hot membership-check path.
_membership_cache: dict = {}  # {(trip_id, user_id): (is_member: bool, expires: float)}
_CACHE_TTL = 30  # seconds


async def _check_membership_cached(trip_id: str, user_id: str) -> bool:
    """Return True if user is an active member of trip_id. Result is cached for 30 s."""
    key = (trip_id, user_id)
    cached = _membership_cache.get(key)
    if cached is not None:
        result, expires = cached
        if time.time() < expires:
            return result
    members = await _get_trip_members(trip_id)
    is_member = any(m.get("user_id") == user_id for m in members)
    _membership_cache[key] = (is_member, time.time() + _CACHE_TTL)
    return is_member


def _invalidate_membership_cache(trip_id: str, user_id: str) -> None:
    """Remove a specific entry from the cache (call after any write that changes membership)."""
    _membership_cache.pop((trip_id, user_id), None)


# ---- Schemas ----

class TripCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    role: str  # 'leader' or 'member'


# ---- Helpers ----

async def _get_trip_members(group_id: str) -> List[dict]:
    """Read group membership rows from trip_members first, then legacy group_member."""
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("trip_members")
            .select("user_id, role, joined_at")
            .eq("trip_id", group_id)
            .is_("left_at", None)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.warning("[_get_trip_members] trip_members query failed for group=%s: %s", group_id, e, exc_info=True)

    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("group_member")
            .select("user_id, role, join_datetime")
            .eq("group_id", group_id)
            .is_("left_datetime", None)
            .execute()
        )
        rows = res.data or []
        return [{
            "user_id": r.get("user_id"),
            "role": r.get("role", "member"),
            "joined_at": r.get("join_datetime"),
        } for r in rows]
    except Exception as e:
        logger.warning("[_get_trip_members] group_member fallback failed for group=%s: %s", group_id, e, exc_info=True)
        return []


async def _is_trip_member(group_id: str, user_id: str) -> bool:
    return await _check_membership_cached(group_id, user_id)


async def _is_trip_leader(group_id: str, user_id: str) -> bool:
    members = await _get_trip_members(group_id)
    return any(m.get("user_id") == user_id and m.get("role") == "leader" for m in members)


async def _insert_trip_member(group_id: str, user_id: str, role: str) -> bool:
    """Insert membership into trip_members. Falls back to group_member only with a conversation."""
    now_iso = datetime.utcnow().isoformat()

    # Primary path: trip_members table (the correct table for group membership)
    try:
        await asyncio.to_thread(
            lambda: supabase.table("trip_members").insert({
                "trip_id": group_id,
                "user_id": user_id,
                "role": role,
                "joined_at": now_iso,
            }).execute()
        )
        _invalidate_membership_cache(group_id, user_id)
        return True
    except Exception as e:
        logger.warning("[_insert_trip_member] trip_members insert failed for trip=%s, user=%s: %s", group_id, user_id, e, exc_info=True)

    # Fallback: group_member requires a conversation_id (it's part of the PK).
    # Create or find a conversation for this trip first.
    try:
        # Check if a conversation already exists for this trip
        conv_res = await asyncio.to_thread(
            lambda: supabase.table("conversation")
            .select("conversation_id")
            .eq("trip_id", group_id)
            .limit(1)
            .execute()
        )
        if conv_res.data:
            conv_id = conv_res.data[0]["conversation_id"]
        else:
            # Create a conversation for this trip
            conv_insert = await asyncio.to_thread(
                lambda: supabase.table("conversation").insert({
                    "conversation_name": "Group Chat",
                    "trip_id": group_id,
                }).execute()
            )
            if not conv_insert.data:
                logger.error("[_insert_trip_member] failed to create conversation for trip=%s", group_id)
                return False
            conv_id = conv_insert.data[0]["conversation_id"]

        await asyncio.to_thread(
            lambda: supabase.table("group_member").insert({
                "conversation_id": conv_id,
                "group_id": group_id,
                "user_id": user_id,
                "role": role,
                "join_datetime": now_iso,
            }).execute()
        )
        _invalidate_membership_cache(group_id, user_id)
        return True
    except Exception as e:
        logger.error("[_insert_trip_member] group_member fallback insert failed for trip=%s, user=%s: %s", group_id, user_id, e, exc_info=True)
        return False

async def require_leader(group_id: str, user_id: str) -> None:
    """Raise 403 if the user is not leader of the group."""
    if await _is_trip_leader(group_id, user_id):
        return

    # Backward-compatible fallback for old trips without group_member rows.
    owner = await async_safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
    )
    if not owner.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can perform this action"
        )


async def require_group_member(group_id: str, user_id: str) -> None:
    """Raise 403 if user is not an active member of this group."""
    if await _is_trip_member(group_id, user_id):
        return

    # Backward-compatible fallback for old owner-only trips.
    owner = await async_safe_single(
        supabase.table("trips")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
    )
    if not owner.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


# ---- Endpoints ----

@router.post("/")
@limiter.limit("30/minute")
async def create_group(
    request: Request,
    body: TripCreate,
    current_user=Depends(oauth2.get_current_user)
):
    """
    Create a new trip + group. The creator is automatically set as leader.
    Returns the created trip and group_id.
    """
    try:
        # Create the trip. Try storing description if the column exists.
        trip_payload = {
            "name": body.name,
            "owner_id": current_user["id"],
        }
        if body.description:
            trip_payload["description"] = body.description

        try:
            trip_res = await asyncio.to_thread(lambda: supabase.table("trips").insert(trip_payload).execute())
        except Exception as e:
            # Fallback for deployments where trips.description is not present.
            logger.warning("[create_group] trips insert with description failed (schema compat fallback): %s", e)
            trip_res = await asyncio.to_thread(
                lambda: supabase.table("trips").insert({
                    "name": body.name,
                    "owner_id": current_user["id"],
                }).execute()
            )

        if not trip_res.data:
            raise HTTPException(status_code=500, detail="Failed to create trip")

        trip = trip_res.data[0]

        # Add the creator as the leader of the group.
        if not await _is_trip_member(trip["id"], current_user["id"]):
            ok = await _insert_trip_member(trip["id"], current_user["id"], "leader")
            if not ok:
                logger.warning("[create_group] group %s created but leader membership insert failed — owner_id fallback will still grant access", trip["id"])

        return {
            "trip": trip,
            "group_id": trip["id"],
            "role": "leader"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[create_group] unexpected error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error creating group")


@router.get("/me")
@limiter.limit("60/minute")
async def get_my_groups(request: Request, current_user=Depends(oauth2.get_current_user)):
    """
    List all groups where current user is an active member.
    """
    try:
        membership_map = {}
        try:
            memberships_res = await asyncio.to_thread(
                lambda: supabase.table("trip_members")
                .select("trip_id, role")
                .eq("user_id", current_user["id"])
                .is_("left_at", None)
                .execute()
            )
            membership_rows = memberships_res.data or []
            membership_map = {m["trip_id"]: m.get("role", "member") for m in membership_rows if m.get("trip_id")}
        except Exception as e:
            logger.warning("[get_my_groups] trip_members query failed for user=%s: %s", current_user["id"], e, exc_info=True)
            try:
                memberships_res = await asyncio.to_thread(
                    lambda: supabase.table("group_member")
                    .select("group_id, role")
                    .eq("user_id", current_user["id"])
                    .is_("left_datetime", None)
                    .execute()
                )
                membership_rows = memberships_res.data or []
                membership_map = {m["group_id"]: m.get("role", "member") for m in membership_rows if m.get("group_id")}
            except Exception as e2:
                logger.warning("[get_my_groups] group_member fallback also failed for user=%s: %s", current_user["id"], e2, exc_info=True)
                membership_map = {}

        # Backfill older data where creator has no explicit membership row yet.
        owner_trips_res = await asyncio.to_thread(
            lambda: supabase.table("trips")
            .select("*")
            .eq("owner_id", current_user["id"])
            .execute()
        )

        for trip in (owner_trips_res.data or []):
            membership_map.setdefault(trip["id"], "leader")

        group_ids = list(membership_map.keys())
        if not group_ids:
            return []

        trips_res = await asyncio.to_thread(
            lambda: supabase.table("trips")
            .select("*")
            .in_("id", group_ids)
            .execute()
        )

        trips = trips_res.data or []
        for trip in trips:
            trip["group_id"] = trip.get("id")
            trip["my_role"] = membership_map.get(trip.get("id"), "member")

        return trips

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[get_my_groups] unexpected error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching groups")


@router.get("/{group_id}/members")
@limiter.limit("60/minute")
async def get_group_members(
    request: Request,
    group_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """List all active members of a group with their roles."""
    try:
        await require_group_member(group_id, current_user["id"])

        members = await _get_trip_members(group_id)
        if not members:
            members = [{
                "user_id": current_user["id"],
                "role": "leader",
                "joined_at": None,
            }]

        user_ids = [m["user_id"] for m in members if m.get("user_id")]
        if user_ids:
            users_res = await asyncio.to_thread(
                lambda: supabase.table("users")
                .select("id, username, email")
                .in_("id", user_ids)
                .execute()
            )
        else:
            users_res = None
        user_map = {u["id"]: u for u in ((users_res.data or []) if users_res else [])}

        return [{
            "user_id": m.get("user_id"),
            "username": user_map.get(m.get("user_id"), {}).get("username"),
            "email": user_map.get(m.get("user_id"), {}).get("email"),
            "role": m.get("role", "member"),
            "join_datetime": m.get("joined_at"),
        } for m in members]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[get_group_members] unexpected error for group=%s: %s", group_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching members")


@router.put("/{group_id}/members/{user_id}/role")
@limiter.limit("30/minute")
async def update_member_role(
    request: Request,
    group_id: str,
    user_id: str,
    body: RoleUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    """Change a member's role. Only the current leader can do this."""
    if body.role not in ("leader", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'leader' or 'member'")

    try:
        await require_leader(group_id, current_user["id"])

        # No separate group membership table — role updates not supported
        raise HTTPException(status_code=501, detail="Role management not yet supported")

        return {"success": True, "user_id": user_id, "new_role": body.role}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[update_member_role] unexpected error for group=%s: %s", group_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error updating role")


@router.post("/{group_id}/members")
@limiter.limit("30/minute")
async def add_group_member(
    request: Request,
    group_id: str,
    body: dict,
    current_user=Depends(oauth2.get_current_user)
):
    """Add a new member to a group. Only the leader can do this."""
    try:
        await require_leader(group_id, current_user["id"])

        new_user_id = body.get("user_id")
        if not new_user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        # Ensure target user exists
        target_user = await async_safe_single(
            supabase.table("users")
            .select("id")
            .eq("id", new_user_id)
        )
        if not target_user.data:
            raise HTTPException(status_code=404, detail="User not found")

        if await _is_trip_member(group_id, new_user_id):
            return {"success": True, "message": "User is already a member"}

        ok = await _insert_trip_member(group_id, new_user_id, "member")
        if not ok:
            raise HTTPException(
                status_code=500,
                detail="Group membership schema not ready. Run migration 012_trip_members.sql"
            )

        return {"success": True, "message": "Member added"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[add_group_member] unexpected error for group=%s: %s", group_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error adding member")
