import os
from typing import List, Optional, Literal, Dict, Any

import requests
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from supabase_client import supabase
from services.poi_ranker import POIRanker


router = APIRouter(prefix="/suggestions", tags=["Suggestions"])


# -------------------------
# Request / Response Models
# -------------------------

BudgetType = Literal["low", "medium", "high"]


class SuggestionsRequest(BaseModel):
    interests: List[str] = Field(default_factory=list)
    budget: BudgetType = "medium"
    radius_km: float = Field(default=10, ge=1, le=50)


class SuggestionCard(BaseModel):
    title: str
    description: str
    category: str
    rating: Optional[float] = None
    lat: float
    lng: float
    place_id: Optional[str] = None
    source: str = "google_places"


# -------------------------
# Google Places Config
# -------------------------

GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_KEY")

PRICE_MAP = {
    "low": 0,
    "medium": 2,
    "high": 4
}


def fetch_places(query: str, budget: str) -> List[Dict[str, Any]]:
    if not GOOGLE_PLACES_KEY:
        raise RuntimeError("GOOGLE_PLACES_KEY not set")

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    params = {
        "query": query,
        "key": GOOGLE_PLACES_KEY,
        "minprice": PRICE_MAP.get(budget)
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()
    return data.get("results", [])


def format_places(results: List[Dict[str, Any]]) -> List[SuggestionCard]:
    suggestions = []

    for place in results:
        location = place.get("geometry", {}).get("location", {})
        lat = location.get("lat")
        lng = location.get("lng")

        if lat is None or lng is None:
            continue

        types = place.get("types", [])
        category = types[0] if types else "activity"

        suggestions.append(
            SuggestionCard(
                title=place.get("name", "Unknown"),
                description=place.get("formatted_address")
                or place.get("vicinity")
                or "Popular local spot",
                category=category,
                rating=place.get("rating"),
                lat=float(lat),
                lng=float(lng),
                place_id=place.get("place_id")
            )
        )

    return suggestions


# -------------------------
# Rank Request / Response
# -------------------------

class RankCandidate(BaseModel):
    name: str
    place_type: str
    # allow any extra fields to pass through
    class Config:
        extra = "allow"


class RankRequest(BaseModel):
    trip_id: str
    candidates: List[RankCandidate]


# -------------------------
# Endpoints
# -------------------------

@router.post("/rank")
def rank_suggestions(body: RankRequest):
    """
    Rank candidate POIs by collaborative filtering on the group's nomination/upvote history.

    Body: { "trip_id": str, "candidates": [{"name": str, "place_type": str, ...}] }

    Returns candidates sorted by rank_score descending.
    """
    trip_id = body.trip_id

    # 1. Fetch this trip's upvoted nominations from supabase
    #    An upvote is a place_vote with vote=1
    try:
        nominations_res = (
            supabase.table("place_nominations")
            .select("id, category, group_id")
            .eq("trip_id", trip_id)
            .execute()
        )
        nominations = nominations_res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching nominations: {e}")

    # Get nomination IDs for this trip
    nom_ids = [n["id"] for n in nominations]
    nom_category_map = {n["id"]: n.get("category", "") for n in nominations}
    # Collect all unique group IDs for fetching other groups' history
    all_group_ids = list(set(n["group_id"] for n in nominations if n.get("group_id")))

    # 2. Get upvoted nomination IDs for this trip
    group_upvoted_types: List[str] = []
    if nom_ids:
        try:
            votes_res = (
                supabase.table("place_votes")
                .select("nomination_id, vote")
                .in_("nomination_id", nom_ids)
                .eq("vote", 1)
                .execute()
            )
            for v in (votes_res.data or []):
                category = nom_category_map.get(v["nomination_id"], "")
                if category:
                    group_upvoted_types.append(category)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching votes: {e}")

    # 3. Fetch other groups' nomination history for collaborative filtering
    all_groups_history: List[List[str]] = []
    try:
        # Get all nominations across all groups (for history — limit to recent 200)
        all_noms_res = (
            supabase.table("place_nominations")
            .select("id, category, group_id, trip_id")
            .not_.is_("group_id", "null")
            .not_.is_("category", "null")
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        all_noms = all_noms_res.data or []

        if all_noms:
            # Get all upvoted nomination IDs from that set
            all_nom_ids = [n["id"] for n in all_noms]
            all_votes_res = (
                supabase.table("place_votes")
                .select("nomination_id")
                .in_("nomination_id", all_nom_ids)
                .eq("vote", 1)
                .execute()
            )
            upvoted_ids = set(v["nomination_id"] for v in (all_votes_res.data or []))

            # Group upvoted categories by (group_id, trip_id)
            group_trip_types: Dict[str, List[str]] = {}
            for n in all_noms:
                if n["id"] in upvoted_ids and n.get("category"):
                    key = f"{n['group_id']}::{n['trip_id']}"
                    if key not in group_trip_types:
                        group_trip_types[key] = []
                    group_trip_types[key].append(n["category"])

            all_groups_history = list(group_trip_types.values())
    except Exception:
        # Non-fatal: fall back to simple dot product
        all_groups_history = []

    # 4. Run POIRanker
    ranker = POIRanker()
    candidates = [c.model_dump() for c in body.candidates]
    ranked = ranker.rank_candidates(
        group_upvoted_types=group_upvoted_types,
        candidates=candidates,
        all_groups_history=all_groups_history if all_groups_history else None,
    )

    return {"ranked_candidates": ranked}
