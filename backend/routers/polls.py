import os
import uuid
from typing import Optional, List
import requests as req

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/polls", tags=["Polls"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PollCreate(BaseModel):
    trip_id: str
    poll_type: str          # length_of_stay | location | activity
    title: str


class OptionCreate(BaseModel):
    label: str
    value: Optional[dict] = None
    ai_suggested: bool = False


class VoteCreate(BaseModel):
    option_id: str


class RankedVoteCreate(BaseModel):
    """Borda Count ranked-choice vote — user submits rankings for multiple options."""
    rankings: list  # [{"option_id": "...", "rank": 1}, {"option_id": "...", "rank": 2}, ...]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_trip(trip_id: str) -> dict:
    res = (
        supabase.table("trips")
        .select("id, name, owner_id")
        .eq("id", trip_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Trip not found")
    return res.data[0]


def _get_poll(poll_id: str) -> dict:
    res = (
        supabase.table("polls")
        .select("*")
        .eq("id", poll_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Poll not found")
    return res.data[0]


def _poll_with_options(poll_id: str, user_id: str) -> dict:
    poll = _get_poll(poll_id)

    opts_res = (
        supabase.table("poll_options")
        .select("*")
        .eq("poll_id", poll_id)
        .order("vote_count", desc=True)
        .execute()
    )
    options = opts_res.data or []
    for opt in options:
        opt["label"] = opt.get("text") or opt.get("label", "")

    vote_res = (
        supabase.table("poll_votes")
        .select("option_id")
        .eq("poll_id", poll_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    my_vote = vote_res.data[0]["option_id"] if vote_res.data else None

    total_votes = sum(o.get("vote_count", 0) for o in options)

    poll["options"] = options
    poll["my_vote"] = my_vote
    poll["total_votes"] = total_votes
    poll["is_leader"] = poll["created_by"] == user_id
    return poll


def _location_suggestions(trip_name: str) -> list:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        return [
            {"label": "Downtown Hotel District", "value": {"type": "hotel"}},
            {"label": "Beachfront Resort Area",  "value": {"type": "hotel"}},
            {"label": "Mountain Lodge Area",      "value": {"type": "hotel"}},
            {"label": "City Center Apartments",   "value": {"type": "hotel"}},
        ]
    try:
        resp = req.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={"query": f"hotels in {trip_name}", "key": key},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])[:6]
        return [
            {
                "label": r.get("name", "Unknown"),
                "value": {
                    "place_id": r.get("place_id"),
                    "address": r.get("formatted_address"),
                },
            }
            for r in results
        ]
    except Exception:
        return [
            {"label": "Downtown Hotel",    "value": {"type": "hotel"}},
            {"label": "Airport Area Hotel","value": {"type": "hotel"}},
        ]


def _activity_suggestions(trip_name: str) -> list:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        return [
            {"label": "City Sightseeing Tour",  "value": {"type": "activity"}},
            {"label": "Museum Visit",            "value": {"type": "activity"}},
            {"label": "Local Food Tour",         "value": {"type": "activity"}},
            {"label": "Hiking / Nature Walk",    "value": {"type": "activity"}},
            {"label": "Shopping District",       "value": {"type": "activity"}},
        ]
    try:
        resp = req.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={"query": f"top attractions things to do in {trip_name}", "key": key},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])[:6]
        return [
            {
                "label": r.get("name", "Unknown"),
                "value": {
                    "place_id": r.get("place_id"),
                    "address": r.get("formatted_address"),
                },
            }
            for r in results
        ]
    except Exception:
        return [
            {"label": "City Tour",        "value": {"type": "activity"}},
            {"label": "Local Food Tour",  "value": {"type": "activity"}},
        ]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def create_poll(body: PollCreate, current_user=Depends(oauth2.get_current_user)):
    """Create a new poll. Only the trip owner (leader) can create polls."""
    if body.poll_type not in ("length_of_stay", "location", "activity", "other", "ranked_choice"):
        raise HTTPException(status_code=400, detail="Invalid poll_type")

    trip = _get_trip(body.trip_id)
    if trip["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the trip leader can create polls",
        )

    res = supabase.table("polls").insert({
        "id": str(uuid.uuid4()),
        "trip_id": body.trip_id,
        "created_by": current_user["id"],
        "poll_type": body.poll_type,
        "title": body.title,
        "status": "open",
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create poll")
    return res.data[0]


@router.get("/trip/{trip_id}")
def list_polls(trip_id: str, current_user=Depends(oauth2.get_current_user)):
    """List all polls for a trip."""
    _get_trip(trip_id)   # validates trip exists

    res = (
        supabase.table("polls")
        .select("*")
        .eq("trip_id", trip_id)
        .order("created_at", desc=True)
        .execute()
    )
    polls = res.data or []

    # Attach option count + total vote count to each poll summary
    for poll in polls:
        opts = (
            supabase.table("poll_options")
            .select("id, vote_count")
            .eq("poll_id", poll["id"])
            .execute()
        )
        opts_data = opts.data or []
        poll["option_count"] = len(opts_data)
        poll["total_votes"] = sum(o.get("vote_count", 0) for o in opts_data)

    return polls


@router.get("/{poll_id}")
def get_poll(poll_id: str, current_user=Depends(oauth2.get_current_user)):
    """Get a single poll with all options and the caller's current vote."""
    return _poll_with_options(poll_id, current_user["id"])


@router.post("/{poll_id}/options")
def add_option(
    poll_id: str,
    body: OptionCreate,
    current_user=Depends(oauth2.get_current_user),
):
    """Add an option to an open poll. Any trip member can add options."""
    poll = _get_poll(poll_id)
    if poll["status"] != "open":
        raise HTTPException(status_code=400, detail="Cannot add options to a closed poll")

    _get_trip(poll["trip_id"])   # validate trip exists

    res = supabase.table("poll_options").insert({
        "id": str(uuid.uuid4()),
        "poll_id": poll_id,
        "created_by": current_user["id"],
        "text": body.label.strip(),
        "value": body.value or {},
        "vote_count": 0,
        "ai_suggested": body.ai_suggested,
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add option")
    return res.data[0]


@router.delete("/{poll_id}/options/{option_id}")
def remove_option(
    poll_id: str,
    option_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Remove an option. Owner of the option or the poll leader can remove."""
    poll = _get_poll(poll_id)
    if poll["status"] != "open":
        raise HTTPException(status_code=400, detail="Poll is closed")

    opt_res = (
        supabase.table("poll_options")
        .select("*")
        .eq("id", option_id)
        .eq("poll_id", poll_id)
        .limit(1)
        .execute()
    )
    if not opt_res.data:
        raise HTTPException(status_code=404, detail="Option not found")

    opt = opt_res.data[0]
    is_leader = poll["created_by"] == current_user["id"]
    is_owner  = opt["created_by"]  == current_user["id"]
    if not (is_leader or is_owner):
        raise HTTPException(status_code=403, detail="Cannot remove this option")

    supabase.table("poll_votes").delete().eq("option_id", option_id).execute()
    supabase.table("poll_options").delete().eq("id", option_id).execute()
    return {"success": True}


@router.post("/{poll_id}/vote")
def cast_vote(
    poll_id: str,
    body: VoteCreate,
    current_user=Depends(oauth2.get_current_user),
):
    """Cast or change a vote. One vote per user per poll."""
    poll = _get_poll(poll_id)
    if poll["status"] != "open":
        raise HTTPException(status_code=400, detail="Poll is closed")

    # Verify option belongs to this poll
    opt_res = (
        supabase.table("poll_options")
        .select("id, vote_count")
        .eq("id", body.option_id)
        .eq("poll_id", poll_id)
        .limit(1)
        .execute()
    )
    if not opt_res.data:
        raise HTTPException(status_code=404, detail="Option not found in this poll")

    existing = (
        supabase.table("poll_votes")
        .select("*")
        .eq("poll_id", poll_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute()
    )

    if existing.data:
        old_option_id = existing.data[0]["option_id"]
        if old_option_id == body.option_id:
            return {"success": True, "message": "Already voted for this option"}

        # Decrement old option
        old_opt = (
            supabase.table("poll_options")
            .select("vote_count")
            .eq("id", old_option_id)
            .limit(1)
            .execute()
        )
        if old_opt.data:
            supabase.table("poll_options").update(
                {"vote_count": max(0, old_opt.data[0]["vote_count"] - 1)}
            ).eq("id", old_option_id).execute()

        # Update existing vote record
        supabase.table("poll_votes").update(
            {"option_id": body.option_id}
        ).eq("id", existing.data[0]["id"]).execute()

    else:
        supabase.table("poll_votes").insert({
            "id": str(uuid.uuid4()),
            "poll_id": poll_id,
            "option_id": body.option_id,
            "user_id": current_user["id"],
        }).execute()

    # Increment new option
    supabase.table("poll_options").update(
        {"vote_count": opt_res.data[0]["vote_count"] + 1}
    ).eq("id", body.option_id).execute()

    return {"success": True}


@router.delete("/{poll_id}/vote")
def remove_vote(poll_id: str, current_user=Depends(oauth2.get_current_user)):
    """Retract the current user's vote."""
    poll = _get_poll(poll_id)
    if poll["status"] != "open":
        raise HTTPException(status_code=400, detail="Poll is closed")

    existing = (
        supabase.table("poll_votes")
        .select("*")
        .eq("poll_id", poll_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute()
    )
    if not existing.data:
        return {"success": True, "message": "No vote to remove"}

    old_option_id = existing.data[0]["option_id"]
    old_opt = (
        supabase.table("poll_options")
        .select("vote_count")
        .eq("id", old_option_id)
        .limit(1)
        .execute()
    )
    if old_opt.data:
        supabase.table("poll_options").update(
            {"vote_count": max(0, old_opt.data[0]["vote_count"] - 1)}
        ).eq("id", old_option_id).execute()

    supabase.table("poll_votes").delete().eq("id", existing.data[0]["id"]).execute()
    return {"success": True}


@router.post("/{poll_id}/close")
def close_poll(poll_id: str, current_user=Depends(oauth2.get_current_user)):
    """Close the poll and determine the winner (highest vote count)."""
    poll = _get_poll(poll_id)
    if poll["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the poll creator can close it")
    if poll["status"] == "closed":
        raise HTTPException(status_code=400, detail="Poll is already closed")

    opts_res = (
        supabase.table("poll_options")
        .select("id, vote_count")
        .eq("poll_id", poll_id)
        .order("vote_count", desc=True)
        .execute()
    )
    options = opts_res.data or []
    winner_id = options[0]["id"] if options else None

    supabase.table("polls").update({
        "status": "closed",
        "winner_option_id": winner_id,
    }).eq("id", poll_id).execute()

    return _poll_with_options(poll_id, current_user["id"])


@router.post("/{poll_id}/reopen")
def reopen_poll(poll_id: str, current_user=Depends(oauth2.get_current_user)):
    """Reopen a closed poll (Retry flow from the activity diagram)."""
    poll = _get_poll(poll_id)
    if poll["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the poll creator can reopen it")

    supabase.table("polls").update({
        "status": "open",
        "winner_option_id": None,
    }).eq("id", poll_id).execute()

    return {"success": True}


@router.get("/{poll_id}/suggestions")
def get_suggestions(poll_id: str, current_user=Depends(oauth2.get_current_user)):
    """Return AI/system suggestions for the poll's category."""
    poll = _get_poll(poll_id)
    trip = _get_trip(poll["trip_id"])
    trip_name = trip.get("name", "your trip")

    poll_type = poll["poll_type"]
    if poll_type == "length_of_stay":
        suggestions = [
            {"label": "Weekend Getaway (2–3 days)",  "value": {"days": 3}},
            {"label": "Short Trip (4–5 days)",       "value": {"days": 5}},
            {"label": "One Week",                    "value": {"days": 7}},
            {"label": "Extended Stay (10 days)",     "value": {"days": 10}},
            {"label": "Two Weeks",                   "value": {"days": 14}},
        ]
    elif poll_type == "location":
        suggestions = _location_suggestions(trip_name)
    elif poll_type == "activity":
        suggestions = _activity_suggestions(trip_name)
    else:  # other
        suggestions = []

    return {"suggestions": suggestions, "poll_type": poll_type}


# ── Ranked-Choice (Borda Count) Voting ───────────────────────────────────────

@router.post("/{poll_id}/ranked-vote")
def cast_ranked_vote(
    poll_id: str,
    body: RankedVoteCreate,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Cast a Borda Count ranked-choice vote.
    User ranks options: 1st = N points, 2nd = N-1, ... last = 1 point.
    """
    poll = _get_poll(poll_id)
    if poll["status"] != "open":
        raise HTTPException(status_code=400, detail="Poll is closed")
    if poll.get("poll_type") != "ranked_choice":
        raise HTTPException(status_code=400, detail="This poll is not ranked-choice. Use /vote instead.")

    user_id = current_user["id"]

    # Validate all option_ids belong to this poll
    opts_res = (
        supabase.table("poll_options")
        .select("id")
        .eq("poll_id", poll_id)
        .execute()
    )
    valid_ids = {o["id"] for o in (opts_res.data or [])}
    for r in body.rankings:
        if r["option_id"] not in valid_ids:
            raise HTTPException(status_code=400, detail=f"Option {r['option_id']} not in this poll")

    # Clear any previous ranked votes from this user
    supabase.table("ranked_votes").delete().eq("poll_id", poll_id).eq("user_id", user_id).execute()

    # Insert new rankings
    for r in body.rankings:
        supabase.table("ranked_votes").insert({
            "id": str(uuid.uuid4()),
            "poll_id": poll_id,
            "user_id": user_id,
            "option_id": r["option_id"],
            "rank": r["rank"],
        }).execute()

    return {"success": True, "rankings_submitted": len(body.rankings)}


@router.get("/{poll_id}/borda-results")
def get_borda_results(
    poll_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Compute Borda Count scores for a ranked-choice poll.
    With N options: rank 1 = N points, rank 2 = N-1, ..., rank N = 1 point.
    """
    poll = _get_poll(poll_id)
    if poll.get("poll_type") != "ranked_choice":
        raise HTTPException(status_code=400, detail="Not a ranked-choice poll")

    # Get all options
    opts_res = (
        supabase.table("poll_options")
        .select("id, text, value")
        .eq("poll_id", poll_id)
        .execute()
    )
    options = opts_res.data or []
    n_options = len(options)

    # Get all ranked votes
    votes_res = (
        supabase.table("ranked_votes")
        .select("user_id, option_id, rank")
        .eq("poll_id", poll_id)
        .execute()
    )
    votes = votes_res.data or []

    # Compute Borda scores: rank 1 = N points, rank 2 = N-1, etc.
    scores = {o["id"]: 0 for o in options}
    voters = set()
    for v in votes:
        voters.add(v["user_id"])
        points = max(0, n_options - v["rank"] + 1)
        scores[v["option_id"]] = scores.get(v["option_id"], 0) + points

    # Build sorted results
    results = []
    for o in options:
        results.append({
            "option_id": o["id"],
            "label": o.get("text") or o.get("label", ""),
            "value": o.get("value"),
            "borda_score": scores.get(o["id"], 0),
        })
    results.sort(key=lambda x: -x["borda_score"])

    return {
        "poll_id": poll_id,
        "total_voters": len(voters),
        "n_options": n_options,
        "results": results,
        "winner": results[0] if results else None,
    }


@router.post("/{poll_id}/close-ranked")
def close_ranked_poll(
    poll_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Close a ranked-choice poll: compute Borda winner, record vote_history
    for the Frustration Index, and update the poll.
    """
    poll = _get_poll(poll_id)
    if poll["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the poll creator can close it")
    if poll["status"] == "closed":
        raise HTTPException(status_code=400, detail="Poll is already closed")

    # Get Borda results
    borda = get_borda_results(poll_id, current_user)
    winner = borda.get("winner")
    winner_id = winner["option_id"] if winner else None

    # Update poll
    supabase.table("polls").update({
        "status": "closed",
        "winner_option_id": winner_id,
    }).eq("id", poll_id).execute()

    # Record vote_history for Frustration Index
    votes_res = (
        supabase.table("ranked_votes")
        .select("user_id, option_id, rank")
        .eq("poll_id", poll_id)
        .execute()
    )
    # Group by user — check if their #1 pick was the winner
    user_first_picks = {}
    for v in (votes_res.data or []):
        if v["rank"] == 1:
            user_first_picks[v["user_id"]] = v["option_id"]

    for uid, first_pick in user_first_picks.items():
        supabase.table("vote_history").insert({
            "id": str(uuid.uuid4()),
            "trip_id": poll["trip_id"],
            "poll_id": poll_id,
            "user_id": uid,
            "voted_for_winner": first_pick == winner_id,
        }).execute()

    return {
        "success": True,
        "winner": winner,
        "borda_results": borda["results"],
    }


# ── Frustration Index ────────────────────────────────────────────────────────

@router.get("/frustration-index/{trip_id}")
def get_frustration_index(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Calculate the "Group Frustration Index" for each member.

    If User A has lost the last 3 votes, their frustration is high.
    The AI should weight their preference higher in the next GCS round
    to ensure group harmony (the "Mentor" approach).

    Returns a weight multiplier per user: 1.0 = neutral, up to 2.0 = high frustration.
    """
    # Get all vote_history for this trip
    history_res = (
        supabase.table("vote_history")
        .select("user_id, voted_for_winner, created_at")
        .eq("trip_id", trip_id)
        .order("created_at", desc=True)
        .execute()
    )
    records = history_res.data or []

    if not records:
        return {"trip_id": trip_id, "members": [], "message": "No vote history yet"}

    # Group by user
    user_records = {}
    for r in records:
        uid = r["user_id"]
        if uid not in user_records:
            user_records[uid] = []
        user_records[uid].append(r["voted_for_winner"])

    # Get usernames
    all_uids = list(user_records.keys())
    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", all_uids)
        .execute()
    )
    name_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    # Calculate frustration: look at last 5 votes
    members = []
    for uid, votes in user_records.items():
        recent = votes[:5]  # already sorted desc by created_at
        losses = sum(1 for v in recent if not v)
        total = len(recent)
        win_rate = (total - losses) / total if total > 0 else 0.5

        # Frustration weight: 1.0 if 50%+ wins, scaling up to 2.0 if 0% wins
        # Formula: weight = 1.0 + (1.0 - win_rate) capped at 2.0
        weight = min(2.0, 1.0 + (1.0 - win_rate))

        # Consecutive loss streak
        streak = 0
        for v in recent:
            if not v:
                streak += 1
            else:
                break

        members.append({
            "user_id": uid,
            "username": name_map.get(uid, "Unknown"),
            "total_votes": total,
            "wins": total - losses,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "consecutive_losses": streak,
            "preference_weight": round(weight, 2),
            "needs_boost": streak >= 3,
        })

    members.sort(key=lambda m: -m["preference_weight"])

    return {
        "trip_id": trip_id,
        "members": members,
    }
