"""
Trip invite-link system.

Required SQL (run once in Supabase):

-- CREATE TABLE trip_invites (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
--   token text UNIQUE NOT NULL,
--   created_by uuid REFERENCES users(id),
--   expires_at timestamptz NOT NULL,
--   max_uses integer DEFAULT 50,
--   use_count integer DEFAULT 0,
--   is_active boolean DEFAULT true,
--   created_at timestamptz DEFAULT now()
-- );
"""

import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from utils import oauth2
from supabase_client import supabase, safe_single

# Reuse membership helpers from groups router
from routers.groups import (
    _is_trip_member,
    _insert_trip_member,
    require_leader,
)

router = APIRouter(
    prefix="/groups",
    tags=["Invites"],
)

INVITE_BASE_URL = os.getenv("INVITE_BASE_URL", "https://travelhub.fozhan.dev/join")


# ---------------------------------------------------------------------------
# POST /groups/{group_id}/invite-link  — leader only
# ---------------------------------------------------------------------------

@router.post("/{group_id}/invite-link")
def create_invite_link(
    group_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Generate a shareable invite link for a trip. Leader only."""
    require_leader(group_id, current_user["id"])

    token = secrets.token_urlsafe(16)
    expires_at = (datetime.utcnow() + timedelta(days=7)).isoformat()

    try:
        res = supabase.table("trip_invites").insert({
            "trip_id": group_id,
            "token": token,
            "created_by": current_user["id"],
            "expires_at": expires_at,
            "max_uses": 50,
            "use_count": 0,
            "is_active": True,
        }).execute()
    except Exception as e:
        print(f"Failed to insert trip_invite: {e}")
        raise HTTPException(status_code=500, detail="Could not create invite link")

    if not res.data:
        raise HTTPException(status_code=500, detail="Could not create invite link")

    return {
        "invite_url": f"{INVITE_BASE_URL}/{token}",
        "token": token,
        "expires_at": expires_at,
    }


# ---------------------------------------------------------------------------
# GET /groups/invite/{token}  — no auth required (preview only)
# ---------------------------------------------------------------------------

@router.get("/invite/{token}")
def preview_invite(token: str):
    """Return a trip preview for a valid invite token. Does not join the trip."""
    invite = _get_valid_invite(token)

    trip_id = invite["trip_id"]

    # Fetch trip info
    try:
        trip_res = safe_single(
            supabase.table("trips")
            .select("id, name, owner_id")
            .eq("id", trip_id)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error fetching trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = trip_res.data

    # Member count
    try:
        members_res = (
            supabase.table("trip_members")
            .select("user_id")
            .eq("trip_id", trip_id)
            .is_("left_at", None)
            .execute()
        )
        member_count = len(members_res.data or [])
    except Exception:
        member_count = 0

    # Creator name
    created_by_name = None
    try:
        creator_res = safe_single(
            supabase.table("users")
            .select("username, email")
            .eq("id", invite["created_by"])
        )
        if creator_res.data:
            created_by_name = creator_res.data.get("username") or creator_res.data.get("email")
    except Exception:
        pass

    return {
        "trip_name": trip["name"],
        "member_count": member_count,
        "created_by_name": created_by_name,
        "expires_at": invite["expires_at"],
    }


# ---------------------------------------------------------------------------
# POST /groups/invite/{token}/join  — auth required
# ---------------------------------------------------------------------------

@router.post("/invite/{token}/join")
def join_via_invite(
    token: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Join a trip using a valid invite token."""
    invite = _get_valid_invite(token)

    trip_id = invite["trip_id"]

    # Fetch trip name for response
    try:
        trip_res = safe_single(
            supabase.table("trips")
            .select("id, name")
            .eq("id", trip_id)
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Error fetching trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = trip_res.data

    # Already a member?
    if _is_trip_member(trip_id, current_user["id"]):
        raise HTTPException(status_code=409, detail="You are already a member of this trip")

    # Insert membership (reuses the exact same helper as add_group_member)
    ok = _insert_trip_member(trip_id, current_user["id"], "member")
    if not ok:
        raise HTTPException(
            status_code=500,
            detail="Could not join trip. Please try again later.",
        )

    # Increment use_count
    try:
        supabase.table("trip_invites").update({
            "use_count": invite["use_count"] + 1,
        }).eq("token", token).execute()
    except Exception as e:
        print(f"Warning: failed to increment use_count for token={token}: {e}")

    return {
        "group_id": trip_id,
        "trip_name": trip["name"],
        "message": f"You joined {trip['name']}!",
    }


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _get_valid_invite(token: str) -> dict:
    """Fetch a trip_invite row and validate it. Raises 404 on any failure."""
    try:
        res = safe_single(
            supabase.table("trip_invites")
            .select("*")
            .eq("token", token)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error looking up invite")

    if not res.data:
        raise HTTPException(status_code=404, detail="Invite link not found or invalid")

    invite = res.data

    if not invite.get("is_active"):
        raise HTTPException(status_code=404, detail="Invite link has been deactivated")

    # Check expiry
    expires_at_str = invite.get("expires_at", "")
    try:
        # Supabase returns ISO strings; strip timezone for naive comparison
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        now = datetime.now(expires_at.tzinfo)
        if now > expires_at:
            raise HTTPException(status_code=404, detail="Invite link has expired")
    except HTTPException:
        raise
    except Exception:
        pass  # If we can't parse, let it through (better UX than hard failure)

    # Check use_count
    use_count = invite.get("use_count", 0)
    max_uses = invite.get("max_uses", 50)
    if use_count >= max_uses:
        raise HTTPException(status_code=404, detail="Invite link has reached its maximum uses")

    return invite
