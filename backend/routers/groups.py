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
    """Raise 403 if the user is not the owner of the trip."""
    res = (
        supabase.table("trips")
        .select("id")
        .eq("id", group_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
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
        trip_res = supabase.table("trips").insert({
            "name": body.name,
            "owner_id": current_user["id"],
        }).execute()

        if not trip_res.data:
            raise HTTPException(status_code=500, detail="Failed to create trip")

        trip = trip_res.data[0]

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
    List all trips the current user created.
    """
    try:
        trips_res = (
            supabase.table("trips")
            .select("*")
            .eq("owner_id", current_user["id"])
            .execute()
        )

        trips = trips_res.data or []
        for trip in trips:
            trip["my_role"] = "leader"

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
        # Verify the requester is the creator of this trip
        require_leader(group_id, current_user["id"])

        # Return only the creator as leader (no separate membership table for groups)
        user_res = (
            supabase.table("users")
            .select("id, username, email")
            .eq("id", current_user["id"])
            .maybe_single()
            .execute()
        )
        user_info = user_res.data or {}

        return [{
            "user_id": current_user["id"],
            "username": user_info.get("username"),
            "email": user_info.get("email"),
            "role": "leader",
            "join_datetime": None,
        }]

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

        # No separate group membership table — adding members not yet supported
        raise HTTPException(status_code=501, detail="Group member management not yet supported")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding member: {e}")
        raise HTTPException(status_code=500, detail="Error adding member")
