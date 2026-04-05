from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from utils import oauth2
from supabase_client import supabase

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)


# ---- Schemas ----

class TripCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    role: str  # 'leader' or 'member'


# ---- Helpers ----

def _get_trip_members(group_id: str) -> List[dict]:
    """Read group membership rows from trip_members first, then legacy group_member."""
    try:
        res = (
            supabase.table("trip_members")
            .select("user_id, role, joined_at")
            .eq("trip_id", group_id)
            .is_("left_at", None)
            .execute()
        )
        return res.data or []
    except Exception:
        pass

    try:
        res = (
            supabase.table("group_member")
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
    except Exception:
        return []


def _is_trip_member(group_id: str, user_id: str) -> bool:
    members = _get_trip_members(group_id)
    return any(m.get("user_id") == user_id for m in members)


def _is_trip_leader(group_id: str, user_id: str) -> bool:
    members = _get_trip_members(group_id)
    return any(m.get("user_id") == user_id and m.get("role") == "leader" for m in members)


def _insert_trip_member(group_id: str, user_id: str, role: str) -> bool:
    """Insert membership into trip_members first; fallback to legacy group_member."""
    now_iso = datetime.utcnow().isoformat()

    try:
        supabase.table("trip_members").insert({
            "trip_id": group_id,
            "user_id": user_id,
            "role": role,
            "joined_at": now_iso,
            "left_at": None,
        }).execute()
        return True
    except Exception:
        pass

    try:
        supabase.table("group_member").insert({
            "group_id": group_id,
            "user_id": user_id,
            "role": role,
            "join_datetime": now_iso,
            "left_datetime": None,
        }).execute()
        return True
    except Exception:
        return False

def require_leader(group_id: str, user_id: str) -> None:
    """Raise 403 if the user is not leader of the group."""
    if _is_trip_leader(group_id, user_id):
        return

    # Backward-compatible fallback for old trips without group_member rows.
    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not owner.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can perform this action"
        )


def require_group_member(group_id: str, user_id: str) -> None:
    """Raise 403 if user is not an active member of this group."""
    if _is_trip_member(group_id, user_id):
        return

    # Backward-compatible fallback for old owner-only trips.
    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not owner.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


# ---- Endpoints ----

@router.post("/")
def create_group(
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
            trip_res = supabase.table("trips").insert(trip_payload).execute()
        except Exception:
            # Fallback for deployments where trips.description is not present.
            trip_res = supabase.table("trips").insert({
                "name": body.name,
                "owner_id": current_user["id"],
            }).execute()

        if not trip_res.data:
            raise HTTPException(status_code=500, detail="Failed to create trip")

        trip = trip_res.data[0]

        # Ensure creator is represented as an active group leader when schema supports it.
        try:
            if not _is_trip_member(trip["id"], current_user["id"]):
                ok = _insert_trip_member(trip["id"], current_user["id"], "leader")
                if not ok:
                    print("Group membership bootstrap skipped: no supported membership table")
        except Exception as member_err:
            # Don't block group creation on legacy schemas.
            print(f"Group membership bootstrap skipped: {member_err}")

        return {
            "trip": trip,
            "group_id": trip["id"],
            "role": "leader"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail="Error creating group")


@router.get("/me")
def get_my_groups(current_user=Depends(oauth2.get_current_user)):
    """
    List all groups where current user is an active member.
    """
    try:
        membership_map = {}
        try:
            memberships_res = (
                supabase.table("trip_members")
                .select("trip_id, role")
                .eq("user_id", current_user["id"])
                .is_("left_at", None)
                .execute()
            )
            membership_rows = memberships_res.data or []
            membership_map = {m["trip_id"]: m.get("role", "member") for m in membership_rows if m.get("trip_id")}
        except Exception:
            try:
                memberships_res = (
                    supabase.table("group_member")
                    .select("group_id, role")
                    .eq("user_id", current_user["id"])
                    .is_("left_datetime", None)
                    .execute()
                )
                membership_rows = memberships_res.data or []
                membership_map = {m["group_id"]: m.get("role", "member") for m in membership_rows if m.get("group_id")}
            except Exception:
                membership_map = {}

        # Backfill older data where creator has no explicit membership row yet.
        owner_trips_res = (
            supabase.table("trips")
            .select("*")
            .eq("owner_id", current_user["id"])
            .execute()
        )

        for trip in (owner_trips_res.data or []):
            membership_map.setdefault(trip["id"], "leader")

        group_ids = list(membership_map.keys())
        if not group_ids:
            return []

        trips_res = (
            supabase.table("trips")
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
        print(f"Error fetching groups: {e}")
        raise HTTPException(status_code=500, detail="Error fetching groups")


@router.get("/{group_id}/members")
def get_group_members(
    group_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """List all active members of a group with their roles."""
    try:
        require_group_member(group_id, current_user["id"])

        members = _get_trip_members(group_id)
        if not members:
            members = [{
                "user_id": current_user["id"],
                "role": "leader",
                "joined_at": None,
            }]

        user_ids = [m["user_id"] for m in members if m.get("user_id")]
        users_res = (
            supabase.table("users")
            .select("id, username, email")
            .in_("id", user_ids)
            .execute()
        ) if user_ids else None
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
        print(f"Error fetching members: {e}")
        raise HTTPException(status_code=500, detail="Error fetching members")


@router.put("/{group_id}/members/{user_id}/role")
def update_member_role(
    group_id: str,
    user_id: str,
    body: RoleUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    """Change a member's role. Only the current leader can do this."""
    if body.role not in ("leader", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'leader' or 'member'")

    try:
        require_leader(group_id, current_user["id"])

        # No separate group membership table — role updates not supported
        raise HTTPException(status_code=501, detail="Role management not yet supported")

        return {"success": True, "user_id": user_id, "new_role": body.role}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail="Error updating role")


@router.post("/{group_id}/members")
def add_group_member(
    group_id: str,
    body: dict,
    current_user=Depends(oauth2.get_current_user)
):
    """Add a new member to a group. Only the leader can do this."""
    try:
        require_leader(group_id, current_user["id"])

        new_user_id = body.get("user_id")
        if not new_user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        # Ensure target user exists
        target_user = (
            supabase.table("users")
            .select("id")
            .eq("id", new_user_id)
            .maybe_single()
            .execute()
        )
        if not target_user.data:
            raise HTTPException(status_code=404, detail="User not found")

        if _is_trip_member(group_id, new_user_id):
            return {"success": True, "message": "User is already a member"}

        ok = _insert_trip_member(group_id, new_user_id, "member")
        if not ok:
            raise HTTPException(
                status_code=500,
                detail="Group membership schema not ready. Run migration 012_trip_members.sql"
            )

        return {"success": True, "message": "Member added"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding member: {e}")
        raise HTTPException(status_code=500, detail="Error adding member")
