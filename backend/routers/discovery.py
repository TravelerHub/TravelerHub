"""
Discovery Layer API — social map overlays powered by existing data.

Endpoints:
  GET /discovery/group-activity/{group_id}  — friend activity + preference heatmap
  GET /discovery/vibes/{group_id}           — vibe overlay (mood-based filtering)
  GET /discovery/expense-markers            — geo-tagged expense markers for map
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from utils import oauth2
from supabase_client import supabase

router = APIRouter(
    prefix="/discovery",
    tags=["Discovery"]
)


# ---- Helpers ----

def _parse_point(point_str) -> List[float]:
    """Convert PostgreSQL POINT '(lng,lat)' → [lng, lat]"""
    if isinstance(point_str, str):
        clean = point_str.strip("()")
        parts = clean.split(",")
        return [float(parts[0]), float(parts[1])]
    return [0.0, 0.0]


def _get_group_member_ids(group_id: str, current_user_id: str) -> List[str]:
    """Return user_ids of all active members in a group. Verifies requester is a member."""
    members_res = (
        supabase.table("group_member")
        .select("user_id")
        .eq("group_id", group_id)
        .is_("left_datetime", None)
        .execute()
    )
    member_ids = [m["user_id"] for m in (members_res.data or [])]

    if current_user_id not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    return member_ids


# ---- Endpoints ----

@router.get("/group-activity/{group_id}")
def get_group_activity(
    group_id: str,
    category: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get favorite places saved by all group members — powers the friend-activity
    markers and preference heatmap on the map.

    Returns each place with who saved it, their category, rating, and coordinates.
    Filter by category to build heatmap layers (e.g. "restaurant", "museum").
    """
    try:
        user_id = current_user["id"]
        member_ids = _get_group_member_ids(group_id, user_id)

        # Fetch favorites for all group members
        query = (
            supabase.table("favorite_places")
            .select("id, user_id, place_id, place_name, place_address, coordinates, category, rating, photos, created_at")
            .in_("user_id", member_ids)
        )
        if category:
            query = query.eq("category", category)

        favorites_res = query.order("created_at", desc=True).execute()

        # Get usernames for display
        users_res = (
            supabase.table("users")
            .select("id, username")
            .in_("id", member_ids)
            .execute()
        )
        user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

        # Format response
        places = []
        for fav in (favorites_res.data or []):
            places.append({
                "id": fav["id"],
                "place_id": fav["place_id"],
                "place_name": fav["place_name"],
                "place_address": fav.get("place_address"),
                "coordinates": _parse_point(fav.get("coordinates", "(0,0)")),
                "category": fav.get("category"),
                "rating": float(fav["rating"]) if fav.get("rating") else None,
                "photos": fav.get("photos"),
                "saved_by": user_map.get(fav["user_id"], "Unknown"),
                "saved_by_id": fav["user_id"],
                "is_mine": fav["user_id"] == user_id,
                "created_at": str(fav.get("created_at", "")),
            })

        # Build category summary for heatmap legend
        category_counts = {}
        for p in places:
            cat = p["category"] or "other"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {
            "places": places,
            "category_summary": category_counts,
            "member_count": len(member_ids),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching group activity: {e}")
        raise HTTPException(status_code=500, detail="Error fetching group activity")


@router.get("/vibes/{group_id}")
def get_group_vibes(
    group_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get aggregated preferences for all group members — powers the "Vibe Overlay"
    filter on the map.

    Combines each member's interests, preferred_categories, and price_preference
    to determine what the group collectively wants.
    """
    try:
        user_id = current_user["id"]
        member_ids = _get_group_member_ids(group_id, user_id)

        # Fetch preferences for all members
        prefs_res = (
            supabase.table("user_preferences")
            .select("user_id, preferred_categories, price_preference, interests, avoid_types")
            .in_("user_id", member_ids)
            .execute()
        )

        prefs = prefs_res.data or []

        # Get usernames
        users_res = (
            supabase.table("users")
            .select("id, username")
            .in_("id", member_ids)
            .execute()
        )
        user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

        # Aggregate interests across the group
        interest_counts = {}
        category_counts = {}
        price_votes = {}
        avoid_set = set()

        for pref in prefs:
            for interest in (pref.get("interests") or []):
                interest_counts[interest] = interest_counts.get(interest, 0) + 1
            for cat in (pref.get("preferred_categories") or []):
                category_counts[cat] = category_counts.get(cat, 0) + 1
            price = pref.get("price_preference", "moderate")
            price_votes[price] = price_votes.get(price, 0) + 1
            for avoid in (pref.get("avoid_types") or []):
                avoid_set.add(avoid)

        # Sort by popularity
        top_interests = sorted(interest_counts.items(), key=lambda x: -x[1])
        top_categories = sorted(category_counts.items(), key=lambda x: -x[1])
        group_price = max(price_votes, key=price_votes.get) if price_votes else "moderate"

        # Per-member breakdown (so UI can show "Sarah likes Foodie, Mike likes Adventure")
        member_vibes = []
        for pref in prefs:
            member_vibes.append({
                "user_id": pref["user_id"],
                "username": user_map.get(pref["user_id"], "Unknown"),
                "interests": pref.get("interests") or [],
                "categories": pref.get("preferred_categories") or [],
                "price": pref.get("price_preference", "moderate"),
            })

        return {
            "group_interests": [{"name": k, "count": v} for k, v in top_interests],
            "group_categories": [{"name": k, "count": v} for k, v in top_categories],
            "group_price_preference": group_price,
            "avoid_types": list(avoid_set),
            "member_vibes": member_vibes,
            "members_with_preferences": len(prefs),
            "total_members": len(member_ids),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching group vibes: {e}")
        raise HTTPException(status_code=500, detail="Error fetching group vibes")


@router.get("/expense-markers")
def get_expense_markers(
    trip_id: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get geo-tagged expenses for map overlay (price-point markers).
    Only returns expenses that have lat/lng coordinates.
    """
    try:
        user_id = current_user["id"]

        query = (
            supabase.table("expenses")
            .select("id, merchant_name, total, currency, category, lat, lng, created_at")
            .eq("user_id", user_id)
            .not_.is_("lat", "null")
            .not_.is_("lng", "null")
        )

        if trip_id:
            query = query.eq("trip_id", trip_id)

        expenses_res = query.order("created_at", desc=True).limit(100).execute()

        markers = []
        for exp in (expenses_res.data or []):
            markers.append({
                "id": exp["id"],
                "merchant_name": exp.get("merchant_name", "Unknown"),
                "total": float(exp["total"]) if exp.get("total") else 0,
                "currency": exp.get("currency", "USD"),
                "category": exp.get("category"),
                "coordinates": [exp["lng"], exp["lat"]],
                "created_at": str(exp.get("created_at", "")),
            })

        return {"markers": markers}

    except Exception as e:
        print(f"Error fetching expense markers: {e}")
        raise HTTPException(status_code=500, detail="Error fetching expense markers")


@router.get("/group-expense-summary/{group_id}")
def get_group_expense_summary(
    group_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get spending summary by category for all group members — for "Wallet" integration.
    Shows average spend at places visited by the group.
    """
    try:
        user_id = current_user["id"]
        member_ids = _get_group_member_ids(group_id, user_id)

        expenses_res = (
            supabase.table("expenses")
            .select("merchant_name, total, currency, category, lat, lng")
            .in_("user_id", member_ids)
            .execute()
        )

        expenses = expenses_res.data or []

        # Aggregate by merchant
        merchant_stats = {}
        category_totals = {}

        for exp in expenses:
            merchant = exp.get("merchant_name") or "Unknown"
            total = float(exp["total"]) if exp.get("total") else 0

            if merchant not in merchant_stats:
                merchant_stats[merchant] = {"count": 0, "total_spent": 0, "lat": exp.get("lat"), "lng": exp.get("lng")}
            merchant_stats[merchant]["count"] += 1
            merchant_stats[merchant]["total_spent"] += total

            cat = exp.get("category") or "Other"
            category_totals[cat] = category_totals.get(cat, 0) + total

        # Calculate averages
        wallet_data = []
        for merchant, stats in merchant_stats.items():
            wallet_data.append({
                "merchant_name": merchant,
                "visit_count": stats["count"],
                "total_spent": round(stats["total_spent"], 2),
                "avg_per_visit": round(stats["total_spent"] / stats["count"], 2),
                "coordinates": [stats["lng"], stats["lat"]] if stats["lat"] and stats["lng"] else None,
            })

        return {
            "wallet_data": sorted(wallet_data, key=lambda x: -x["total_spent"]),
            "category_breakdown": category_totals,
            "total_group_spend": round(sum(category_totals.values()), 2),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching group expense summary: {e}")
        raise HTTPException(status_code=500, detail="Error fetching group expense summary")
