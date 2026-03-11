"""
Collaborative Decision-Making API — place nominations and voting.

Endpoints:
  POST /nominations/{group_id}/nominate     — nominate a place
  POST /nominations/{group_id}/vote         — vote on a nomination
  GET  /nominations/{group_id}/shortlist    — get all nominations with vote tallies
  DELETE /nominations/{nomination_id}       — remove a nomination (author or leader)
  GET  /nominations/{group_id}/conflicts    — detect scheduling conflicts between approved spots
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from utils import oauth2
from supabase_client import supabase
import math

router = APIRouter(
    prefix="/nominations",
    tags=["Nominations"]
)


# ---- Schemas ----

class NominationCreate(BaseModel):
    trip_id: str
    place_name: str
    place_address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    category: Optional[str] = None
    note: Optional[str] = None


class VoteCreate(BaseModel):
    nomination_id: str
    vote: int  # 1 = upvote, -1 = downvote


# ---- Helpers ----

def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Calculate distance in km between two coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _verify_membership(group_id: str, user_id: str) -> None:
    """Raise 403 if user is not in the group."""
    res = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _get_member_count(group_id: str) -> int:
    """Get total active members in a group."""
    res = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", group_id)
        .is_("left_datetime", None)
        .execute()
    )
    return len(res.data or [])


# ---- Endpoints ----

@router.post("/{group_id}/nominate", status_code=status.HTTP_201_CREATED)
def nominate_place(
    group_id: str,
    body: NominationCreate,
    current_user=Depends(oauth2.get_current_user),
):
    """Nominate a place for the group to consider visiting."""
    user_id = current_user["id"]
    _verify_membership(group_id, user_id)

    try:
        data = {
            "trip_id": body.trip_id,
            "group_id": group_id,
            "nominated_by": user_id,
            "place_name": body.place_name,
            "place_address": body.place_address,
            "lat": body.lat,
            "lng": body.lng,
            "category": body.category,
            "note": body.note,
        }

        res = supabase.table("place_nominations").insert(data).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create nomination")

        # Auto-upvote by the nominator
        supabase.table("place_votes").insert({
            "nomination_id": res.data[0]["id"],
            "user_id": user_id,
            "vote": 1,
        }).execute()

        return res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating nomination: {e}")
        raise HTTPException(status_code=500, detail="Error creating nomination")


@router.post("/{group_id}/vote")
def vote_on_nomination(
    group_id: str,
    body: VoteCreate,
    current_user=Depends(oauth2.get_current_user),
):
    """Vote on a place nomination. vote: 1 (upvote) or -1 (downvote)."""
    user_id = current_user["id"]
    _verify_membership(group_id, user_id)

    if body.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="Vote must be 1 or -1")

    try:
        # Upsert — update if already voted, insert if not
        existing = (
            supabase.table("place_votes")
            .select("id")
            .eq("nomination_id", body.nomination_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if existing.data:
            supabase.table("place_votes").update({"vote": body.vote}).eq("id", existing.data["id"]).execute()
        else:
            supabase.table("place_votes").insert({
                "nomination_id": body.nomination_id,
                "user_id": user_id,
                "vote": body.vote,
            }).execute()

        # Check if nomination should auto-approve (majority upvotes)
        member_count = _get_member_count(group_id)
        votes_res = (
            supabase.table("place_votes")
            .select("vote")
            .eq("nomination_id", body.nomination_id)
            .execute()
        )
        upvotes = sum(1 for v in (votes_res.data or []) if v["vote"] == 1)

        if upvotes > member_count / 2:
            supabase.table("place_nominations").update({"status": "approved"}).eq("id", body.nomination_id).execute()

        return {"success": True, "upvotes": upvotes, "total_votes": len(votes_res.data or [])}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error voting: {e}")
        raise HTTPException(status_code=500, detail="Error recording vote")


@router.get("/{group_id}/shortlist")
def get_shortlist(
    group_id: str,
    trip_id: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get all nominations for the group with vote tallies.
    Sorted by net votes (upvotes - downvotes) descending.
    """
    user_id = current_user["id"]
    _verify_membership(group_id, user_id)

    try:
        query = (
            supabase.table("place_nominations")
            .select("*")
            .eq("group_id", group_id)
        )
        if trip_id:
            query = query.eq("trip_id", trip_id)

        nominations_res = query.order("created_at", desc=True).execute()
        nominations = nominations_res.data or []

        if not nominations:
            return {"shortlist": [], "member_count": _get_member_count(group_id)}

        # Get all votes for these nominations
        nom_ids = [n["id"] for n in nominations]
        votes_res = (
            supabase.table("place_votes")
            .select("nomination_id, user_id, vote")
            .in_("nomination_id", nom_ids)
            .execute()
        )

        # Build vote tallies
        vote_map = {}  # nomination_id → { upvotes, downvotes, user_vote }
        for v in (votes_res.data or []):
            nid = v["nomination_id"]
            if nid not in vote_map:
                vote_map[nid] = {"upvotes": 0, "downvotes": 0, "my_vote": 0}
            if v["vote"] == 1:
                vote_map[nid]["upvotes"] += 1
            else:
                vote_map[nid]["downvotes"] += 1
            if v["user_id"] == user_id:
                vote_map[nid]["my_vote"] = v["vote"]

        # Get nominator usernames
        nominator_ids = list(set(n["nominated_by"] for n in nominations))
        users_res = (
            supabase.table("users")
            .select("id, username")
            .in_("id", nominator_ids)
            .execute()
        )
        user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

        # Build response
        shortlist = []
        for n in nominations:
            votes = vote_map.get(n["id"], {"upvotes": 0, "downvotes": 0, "my_vote": 0})
            shortlist.append({
                "id": n["id"],
                "place_name": n["place_name"],
                "place_address": n.get("place_address"),
                "lat": n.get("lat"),
                "lng": n.get("lng"),
                "category": n.get("category"),
                "note": n.get("note"),
                "status": n.get("status", "pending"),
                "nominated_by": user_map.get(n["nominated_by"], "Unknown"),
                "nominated_by_id": n["nominated_by"],
                "upvotes": votes["upvotes"],
                "downvotes": votes["downvotes"],
                "net_votes": votes["upvotes"] - votes["downvotes"],
                "my_vote": votes["my_vote"],
                "created_at": str(n.get("created_at", "")),
            })

        # Sort by net votes descending
        shortlist.sort(key=lambda x: -x["net_votes"])

        return {
            "shortlist": shortlist,
            "member_count": _get_member_count(group_id),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching shortlist: {e}")
        raise HTTPException(status_code=500, detail="Error fetching shortlist")


@router.delete("/{nomination_id}")
def delete_nomination(
    nomination_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Delete a nomination. Only the nominator or group leader can do this."""
    user_id = current_user["id"]

    try:
        # Get the nomination
        nom_res = (
            supabase.table("place_nominations")
            .select("id, nominated_by, group_id")
            .eq("id", nomination_id)
            .maybe_single()
            .execute()
        )

        if not nom_res.data:
            raise HTTPException(status_code=404, detail="Nomination not found")

        nom = nom_res.data

        # Check permission: must be nominator or group leader
        if nom["nominated_by"] != user_id:
            leader_check = (
                supabase.table("group_member")
                .select("role")
                .eq("group_id", nom["group_id"])
                .eq("user_id", user_id)
                .is_("left_datetime", None)
                .maybe_single()
                .execute()
            )
            if not leader_check.data or leader_check.data.get("role") != "leader":
                raise HTTPException(status_code=403, detail="Only the nominator or group leader can delete")

        # Delete (cascade removes votes)
        supabase.table("place_nominations").delete().eq("id", nomination_id).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting nomination: {e}")
        raise HTTPException(status_code=500, detail="Error deleting nomination")


@router.get("/{group_id}/conflicts")
def detect_conflicts(
    group_id: str,
    trip_id: Optional[str] = None,
    max_distance_km: float = 50,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Detect conflict pairs among approved/pending nominations.
    Two spots are "conflicting" if they are farther apart than max_distance_km,
    making them hard to visit in the same day.
    """
    user_id = current_user["id"]
    _verify_membership(group_id, user_id)

    try:
        query = (
            supabase.table("place_nominations")
            .select("id, place_name, lat, lng, status")
            .eq("group_id", group_id)
            .not_.is_("lat", "null")
            .not_.is_("lng", "null")
        )
        if trip_id:
            query = query.eq("trip_id", trip_id)

        noms_res = query.execute()
        noms = noms_res.data or []

        conflicts = []
        for i in range(len(noms)):
            for j in range(i + 1, len(noms)):
                a, b = noms[i], noms[j]
                dist = _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
                if dist > max_distance_km:
                    conflicts.append({
                        "place_a": {"id": a["id"], "name": a["place_name"], "coordinates": [a["lng"], a["lat"]]},
                        "place_b": {"id": b["id"], "name": b["place_name"], "coordinates": [b["lng"], b["lat"]]},
                        "distance_km": round(dist, 1),
                        "suggestion": f"{a['place_name']} and {b['place_name']} are {dist:.0f}km apart — consider visiting on different days.",
                    })

        return {"conflicts": conflicts, "max_distance_km": max_distance_km}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error detecting conflicts: {e}")
        raise HTTPException(status_code=500, detail="Error detecting conflicts")
