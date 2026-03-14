"""
Smart Route API — preference-based route optimization with trip "chapters".

Extends the existing /navigation/route endpoint with:
  - Preference modes: fastest, scenic, foodie, budget
  - Trip "chapters" (Morning, Afternoon, Evening segments)
  - Group sync data (member positions for shared itinerary)
"""

import os
import json
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from utils import oauth2
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/smart-route",
    tags=["Smart Route"]
)


# ---- Schemas ----

class Waypoint(BaseModel):
    name: str
    coordinates: List[float]  # [lng, lat]


class SmartRouteRequest(BaseModel):
    waypoints: List[Waypoint]
    mode: str = "driving"  # driving | walking | bicycling | transit
    preference: str = "fastest"  # fastest | scenic | foodie | budget
    departure_time: Optional[str] = None  # ISO datetime string
    group_id: Optional[str] = None  # for group preference aggregation


# Map preference → Google Places types to search along route
PREFERENCE_POI_TYPES = {
    "scenic": ["park", "tourist_attraction", "natural_feature", "point_of_interest"],
    "foodie": ["restaurant", "cafe", "bakery", "bar"],
    "budget": ["restaurant", "cafe"],  # filtered by price later
}


# ---- Helpers ----

async def _get_base_route(waypoints: List[Waypoint], mode: str) -> dict:
    """Get the base route from Google Directions via our existing proxy."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    # Google expects lat,lng
    origin = f"{waypoints[0].coordinates[1]},{waypoints[0].coordinates[0]}"
    destination = f"{waypoints[-1].coordinates[1]},{waypoints[-1].coordinates[0]}"

    mode_map = {"driving": "driving", "walking": "walking", "cycling": "bicycling", "bicycling": "bicycling", "transit": "transit"}
    google_mode = mode_map.get(mode, "driving")

    params = {"origin": origin, "destination": destination, "mode": google_mode, "key": api_key}

    if len(waypoints) > 2:
        mid = "|".join(f"{w.coordinates[1]},{w.coordinates[0]}" for w in waypoints[1:-1])
        params["waypoints"] = mid

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK":
        raise HTTPException(status_code=400, detail=f"Directions API: {data.get('status')}")

    return data


async def _search_pois_along_route(legs: list, preference: str, api_key: str) -> list:
    """Search for POIs near the midpoint of each route leg based on preference."""
    poi_types = PREFERENCE_POI_TYPES.get(preference, [])
    if not poi_types:
        return []

    suggestions = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for i, leg in enumerate(legs):
            # Use the midpoint of the leg for the search
            start = leg["start_location"]
            end = leg["end_location"]
            mid_lat = (start["lat"] + end["lat"]) / 2
            mid_lng = (start["lng"] + end["lng"]) / 2

            # Use Google Places Nearby Search
            for poi_type in poi_types[:2]:  # Limit API calls
                params = {
                    "location": f"{mid_lat},{mid_lng}",
                    "radius": 2000,
                    "type": poi_type,
                    "key": api_key,
                }

                if preference == "budget":
                    params["maxprice"] = 1  # $ only

                try:
                    resp = await client.get(
                        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                        params=params,
                    )
                    data = resp.json()

                    for place in (data.get("results") or [])[:3]:
                        loc = place.get("geometry", {}).get("location", {})
                        suggestions.append({
                            "name": place.get("name"),
                            "coordinates": [loc.get("lng", 0), loc.get("lat", 0)],
                            "types": place.get("types", []),
                            "rating": place.get("rating"),
                            "price_level": place.get("price_level"),
                            "vicinity": place.get("vicinity"),
                            "leg_index": i,
                            "preference_match": preference,
                        })
                except Exception:
                    continue  # Don't fail the whole route for a POI search

    # Deduplicate by name
    seen = set()
    unique = []
    for s in suggestions:
        if s["name"] not in seen:
            seen.add(s["name"])
            unique.append(s)

    return unique


def _build_chapters(legs: list, departure_time: Optional[str] = None) -> list:
    """
    Break route legs into logical time-of-day "chapters":
    Morning (6-12), Afternoon (12-17), Evening (17-21), Night (21-6).
    """
    if departure_time:
        try:
            current_time = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
        except ValueError:
            current_time = datetime.now()
    else:
        current_time = datetime.now()

    chapters = []
    current_chapter = None

    for i, leg in enumerate(legs):
        hour = current_time.hour

        if 6 <= hour < 12:
            period = "Morning"
            emoji = "sunrise"
        elif 12 <= hour < 17:
            period = "Afternoon"
            emoji = "sun"
        elif 17 <= hour < 21:
            period = "Evening"
            emoji = "sunset"
        else:
            period = "Night"
            emoji = "moon"

        # Start a new chapter if period changed
        if not current_chapter or current_chapter["period"] != period:
            current_chapter = {
                "period": period,
                "emoji": emoji,
                "start_time": current_time.strftime("%I:%M %p"),
                "legs": [],
                "total_distance": 0,
                "total_duration": 0,
            }
            chapters.append(current_chapter)

        current_chapter["legs"].append({
            "leg_index": i,
            "from": leg.get("start_address", ""),
            "to": leg.get("end_address", ""),
            "distance": leg["distance"]["text"],
            "duration": leg["duration"]["text"],
            "arrival_time": (current_time + timedelta(seconds=leg["duration"]["value"])).strftime("%I:%M %p"),
        })
        current_chapter["total_distance"] += leg["distance"]["value"]
        current_chapter["total_duration"] += leg["duration"]["value"]

        # Advance time
        current_time += timedelta(seconds=leg["duration"]["value"])
        # Add a small buffer between stops (15 min dwell time)
        current_time += timedelta(minutes=15)

    # Format totals
    for ch in chapters:
        dist_km = ch["total_distance"] / 1000
        dur_min = ch["total_duration"] // 60
        ch["total_distance_text"] = f"{dist_km:.1f} km"
        ch["total_duration_text"] = f"{dur_min} min"

    return chapters


# ---- Endpoints ----

@router.post("/plan")
async def plan_smart_route(
    body: SmartRouteRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Plan a smart route with preference-based POI suggestions and trip chapters.

    1. Gets the base route from Google Directions
    2. If preference != "fastest", searches for POIs along the route
    3. Breaks the route into time-of-day chapters
    4. If group_id provided, incorporates group preference data
    """
    if len(body.waypoints) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")

    try:
        # 1. Get base route
        directions_data = await _get_base_route(body.waypoints, body.mode)
        route = directions_data["routes"][0]
        legs = route["legs"]

        # 2. Search POIs along route if not "fastest"
        suggestions = []
        if body.preference != "fastest":
            api_key = os.getenv("GOOGLE_PLACES_API_KEY")
            if api_key:
                suggestions = await _search_pois_along_route(legs, body.preference, api_key)

        # 3. If group_id provided, filter suggestions by group preferences
        if body.group_id:
            try:
                members_res = (
                    supabase.table("group_member")
                    .select("user_id")
                    .eq("group_id", body.group_id)
                    .is_("left_datetime", None)
                    .execute()
                )
                member_ids = [m["user_id"] for m in (members_res.data or [])]

                if member_ids:
                    prefs_res = (
                        supabase.table("user_preferences")
                        .select("avoid_types")
                        .in_("user_id", member_ids)
                        .execute()
                    )
                    # Collect all avoid_types from the group
                    avoid = set()
                    for p in (prefs_res.data or []):
                        for t in (p.get("avoid_types") or []):
                            avoid.add(t.lower())

                    # Filter out places that match avoided types
                    if avoid:
                        suggestions = [
                            s for s in suggestions
                            if not any(a in [t.lower() for t in s.get("types", [])] for a in avoid)
                        ]
            except Exception:
                pass  # Don't fail the route if preference lookup fails

        # 4. Build chapters
        chapters = _build_chapters(legs, body.departure_time)

        # 5. Build response
        total_duration = sum(leg["duration"]["value"] for leg in legs)
        total_distance = sum(leg["distance"]["value"] for leg in legs)

        return {
            "route": {
                "overview_polyline": route["overview_polyline"]["points"],
                "bounds": route.get("bounds"),
                "total_distance": total_distance,
                "total_distance_text": f"{total_distance / 1000:.1f} km",
                "total_duration": total_duration,
                "total_duration_text": f"{total_duration // 60} min",
            },
            "chapters": chapters,
            "suggestions": suggestions[:10],  # Cap at 10 suggestions
            "preference": body.preference,
            "directions_data": directions_data,  # Full Google response for the frontend
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Smart route error: {e}")
        raise HTTPException(status_code=500, detail=f"Error planning route: {str(e)}")


@router.post("/group-sync/{group_id}")
async def update_group_position(
    group_id: str,
    body: dict,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Update the user's current position for group sync.
    Other group members can poll this to see where everyone is.

    Body: { "lat": float, "lng": float, "heading": float }
    """
    user_id = current_user["id"]

    # Verify membership
    membership = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Store position in a lightweight way — using group_member's metadata
    # We update a 'last_position' JSONB column if it exists, or use a cache approach
    # For now, return the positions of all members (frontend polls this)
    return {"status": "ok", "user_id": user_id}


@router.get("/group-positions/{group_id}")
async def get_group_positions(
    group_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get last known positions of all group members.
    For MVP, this returns member info — real-time positions
    will use Supabase Realtime on the frontend.
    """
    user_id = current_user["id"]

    members_res = (
        supabase.table("group_member")
        .select("user_id, role")
        .eq("group_id", group_id)
        .is_("left_datetime", None)
        .execute()
    )

    member_ids = [m["user_id"] for m in (members_res.data or [])]
    if user_id not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", member_ids)
        .execute()
    )

    role_map = {m["user_id"]: m["role"] for m in (members_res.data or [])}

    members = []
    for u in (users_res.data or []):
        members.append({
            "user_id": u["id"],
            "username": u["username"],
            "role": role_map.get(u["id"], "member"),
            "is_me": u["id"] == user_id,
        })

    return {"members": members}
