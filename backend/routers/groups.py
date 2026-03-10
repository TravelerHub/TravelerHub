import uuid
from typing import Optional, List
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

def require_leader(group_id: str, user_id: str) -> None:
    """Raise 403 if the user is not the leader of the group."""
    res = (
        supabase.table("group_member")
        .select("role")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if not res.data or res.data.get("role") != "leader":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can perform this action"
        )


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
        group_id = str(uuid.uuid4())

        # Create the trip
        trip_res = supabase.table("trip").insert({
            "group_id": group_id,
            "name": body.name,
            "description": body.description,
            "created_by": current_user["id"],
        }).execute()

        if not trip_res.data:
            raise HTTPException(status_code=500, detail="Failed to create trip")

        trip = trip_res.data[0]

        # Add creator as leader
        member_res = supabase.table("group_member").insert({
            "group_id": group_id,
            "user_id": current_user["id"],
            "role": "leader",
        }).execute()

        if not member_res.data:
            raise HTTPException(status_code=500, detail="Failed to add group member")

        return {
            "trip": trip,
            "group_id": group_id,
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
    List all groups (trips) the current user belongs to, with their role in each.
    """
    try:
        # Get all group memberships for this user
        memberships_res = (
            supabase.table("group_member")
            .select("group_id, role, join_datetime")
            .eq("user_id", current_user["id"])
            .is_("left_datetime", None)
            .execute()
        )

        if not memberships_res.data:
            return []

        group_ids = [m["group_id"] for m in memberships_res.data]
        role_by_group = {m["group_id"]: m["role"] for m in memberships_res.data}

        # Get all trips for those group_ids
        trips_res = (
            supabase.table("trip")
            .select("*")
            .in_("group_id", group_ids)
            .execute()
        )

        trips = trips_res.data or []

        # Attach the user's role to each trip
        for trip in trips:
            trip["my_role"] = role_by_group.get(trip["group_id"], "member")

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
        # Verify the requester is a member of this group
        membership = (
            supabase.table("group_member")
            .select("id")
            .eq("group_id", group_id)
            .eq("user_id", current_user["id"])
            .is_("left_datetime", None)
            .maybe_single()
            .execute()
        )
        if not membership.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        members_res = (
            supabase.table("group_member")
            .select("user_id, role, join_datetime")
            .eq("group_id", group_id)
            .is_("left_datetime", None)
            .execute()
        )

        if not members_res.data:
            return []

        # Enrich with username from users table
        user_ids = [m["user_id"] for m in members_res.data]
        users_res = (
            supabase.table("users")
            .select("id, username, email")
            .in_("id", user_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in (users_res.data or [])}

        result = []
        for member in members_res.data:
            user_info = user_map.get(member["user_id"], {})
            result.append({
                "user_id": member["user_id"],
                "username": user_info.get("username"),
                "email": user_info.get("email"),
                "role": member["role"],
                "join_datetime": member["join_datetime"],
            })

        return result

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

        res = (
            supabase.table("group_member")
            .update({"role": body.role})
            .eq("group_id", group_id)
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="Member not found in this group")

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

        # Check if already a member
        existing = (
            supabase.table("group_member")
            .select("id")
            .eq("group_id", group_id)
            .eq("user_id", new_user_id)
            .is_("left_datetime", None)
            .maybe_single()
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="User is already a member of this group")

        res = supabase.table("group_member").insert({
            "group_id": group_id,
            "user_id": new_user_id,
            "role": "member",
        }).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to add member")

        return {"success": True, "group_id": group_id, "user_id": new_user_id, "role": "member"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding member: {e}")
        raise HTTPException(status_code=500, detail="Error adding member")
