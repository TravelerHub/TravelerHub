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


async def _fetch_user_preferences(user_id: str) -> dict:
    """Fetch a single user's preferences for individual route optimization."""
    try:
        res = (
            supabase.table("user_preferences")
            .select("preferred_categories, dietary_restrictions, interests, avoid_types, price_preference, travel_pace, spontaneity_score")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data or {}
    except Exception:
        return {}


async def _check_weather_for_suggestions(suggestions: list, api_key: str = None) -> list:
    """
    Check current weather at suggestion locations.
    Marks outdoor suggestions with weather warnings if conditions are poor.
    Uses Open-Meteo (free, no key needed).
    """
    if not suggestions:
        return suggestions

    outdoor_types = {"park", "natural_feature", "campground", "zoo", "amusement_park",
                     "tourist_attraction", "stadium", "hiking_area"}

    async with httpx.AsyncClient(timeout=8.0) as client:
        for sug in suggestions:
            # Only check weather for outdoor POIs
            sug_types = set(t.lower() for t in sug.get("types", []))
            if not sug_types & outdoor_types:
                continue

            lat = sug["coordinates"][1] if len(sug.get("coordinates", [])) > 1 else None
            lng = sug["coordinates"][0] if len(sug.get("coordinates", [])) > 0 else None
            if lat is None or lng is None:
                continue

            try:
                resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat, "longitude": lng,
                        "current": "weathercode,temperature_2m",
                        "temperature_unit": "fahrenheit",
                    },
                )
                data = resp.json()
                code = data.get("current", {}).get("weathercode", 0)
                temp = data.get("current", {}).get("temperature_2m")

                # WMO codes: 51-67=rain, 71-77=snow, 80-82=showers, 95-99=storm
                if code >= 95:
                    sug["weather_warning"] = "Thunderstorm in area"
                    sug["weather_safe"] = False
                elif code >= 61:
                    sug["weather_warning"] = "Rain expected"
                    sug["weather_safe"] = False
                elif code >= 71 and code <= 77:
                    sug["weather_warning"] = "Snow conditions"
                    sug["weather_safe"] = False
                else:
                    sug["weather_safe"] = True

                if temp is not None:
                    sug["temperature_f"] = round(temp)
            except Exception:
                sug["weather_safe"] = True  # Default to safe if check fails

    return suggestions


async def _search_pois_along_route(legs: list, preference: str, api_key: str, keyword: str = None) -> list:
    """
    Search for POIs near the midpoint of each route leg using Google Places v1 API.
    Returns hours, ratings, and price level for each suggestion.
    Optional keyword param filters results (e.g. "vegetarian", "halal").
    """
    poi_types = PREFERENCE_POI_TYPES.get(preference, [])
    if not poi_types:
        return []

    # If a keyword is given, use text search instead of nearby for better filtering
    use_text_search = bool(keyword)

    suggestions = []
    v1_nearby_url = "https://places.googleapis.com/v1/places:searchNearby"
    v1_text_url = "https://places.googleapis.com/v1/places:searchText"
    field_mask_nearby = (
        "places.id,places.displayName,places.formattedAddress,places.location,"
        "places.rating,places.userRatingCount,places.types,places.priceLevel,"
        "places.regularOpeningHours"
    )
    field_mask_text = field_mask_nearby  # same fields

    async with httpx.AsyncClient(timeout=10.0) as client:
        for i, leg in enumerate(legs):
            start = leg["start_location"]
            end = leg["end_location"]
            mid_lat = (start["lat"] + end["lat"]) / 2
            mid_lng = (start["lng"] + end["lng"]) / 2

            for poi_type in poi_types[:2]:
                if use_text_search:
                    # Text search: "vegetarian restaurant" near midpoint
                    req_body = {
                        "textQuery": f"{keyword} {poi_type}",
                        "maxResultCount": 5,
                        "locationBias": {
                            "circle": {
                                "center": {"latitude": mid_lat, "longitude": mid_lng},
                                "radius": 2000.0,
                            }
                        },
                    }
                    url = v1_text_url
                    mask = field_mask_text
                else:
                    req_body = {
                        "includedTypes": [poi_type],
                        "maxResultCount": 5,
                        "locationRestriction": {
                            "circle": {
                                "center": {"latitude": mid_lat, "longitude": mid_lng},
                                "radius": 2000.0,
                            }
                        },
                    }
                    url = v1_nearby_url
                    mask = field_mask_nearby

                # Budget filter: fetch more, filter by price
                if preference == "budget":
                    if not use_text_search:
                        req_body["includedPrimaryTypes"] = [poi_type]
                    req_body["maxResultCount"] = 8

                try:
                    resp = await client.post(
                        url,
                        json=req_body,
                        headers={
                            "X-Goog-Api-Key": api_key,
                            "X-Goog-FieldMask": mask,
                            "Content-Type": "application/json",
                        },
                    )
                    data = resp.json()

                    for place in (data.get("places") or [])[:3]:
                        loc = place.get("location", {})
                        price = place.get("priceLevel")

                        # Budget filter: skip expensive places
                        if preference == "budget" and price in ("PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"):
                            continue

                        hours = place.get("regularOpeningHours", {})
                        suggestions.append({
                            "name": place.get("displayName", {}).get("text", "Unknown"),
                            "coordinates": [loc.get("longitude", 0), loc.get("latitude", 0)],
                            "types": place.get("types", []),
                            "rating": place.get("rating"),
                            "price_level": price,
                            "vicinity": place.get("formattedAddress", ""),
                            "user_ratings_total": place.get("userRatingCount", 0),
                            "opening_hours": hours.get("weekdayDescriptions", []),
                            "is_open": hours.get("openNow"),
                            "leg_index": i,
                            "preference_match": preference,
                        })
                except Exception:
                    continue

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

        start_loc = leg.get("start_location", {})
        end_loc = leg.get("end_location", {})
        current_chapter["legs"].append({
            "leg_index": i,
            "from": leg.get("start_address", ""),
            "to": leg.get("end_address", ""),
            "distance": leg["distance"]["text"],
            "duration": leg["duration"]["text"],
            "arrival_time": (current_time + timedelta(seconds=leg["duration"]["value"])).strftime("%I:%M %p"),
            "start_coordinates": [start_loc.get("lng", 0), start_loc.get("lat", 0)],
            "end_coordinates": [end_loc.get("lng", 0), end_loc.get("lat", 0)],
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
        user_id = current_user["id"]
        api_key = os.getenv("GOOGLE_PLACES_API_KEY")

        # 1. Get base route
        directions_data = await _get_base_route(body.waypoints, body.mode)
        route = directions_data["routes"][0]
        legs = route["legs"]

        # 2. Fetch user preferences (individual or group)
        user_prefs = await _fetch_user_preferences(user_id)
        avoid_types = set()
        dietary = user_prefs.get("dietary_restrictions") or []
        price_pref = user_prefs.get("price_preference", "any")
        preferred_cats = user_prefs.get("preferred_categories") or []
        spontaneity = user_prefs.get("spontaneity_score", 5)

        # Build avoid set from individual preferences
        for a in (user_prefs.get("avoid_types") or []):
            avoid_types.add(a.lower())

        # 3. Search POIs along route — even for "fastest" if user has high spontaneity
        suggestions = []
        should_search = body.preference != "fastest" or spontaneity >= 7
        if should_search and api_key:
            suggestions = await _search_pois_along_route(legs, body.preference if body.preference != "fastest" else "scenic", api_key)

            # Inject dietary keyword search for foodie/budget modes
            if body.preference in ("foodie", "budget") and dietary:
                extra = await _search_pois_along_route(legs, body.preference, api_key, keyword=dietary[0])
                seen_names = {s["name"] for s in suggestions}
                for e in extra:
                    if e["name"] not in seen_names:
                        suggestions.append(e)

        # 4. If group_id provided, merge group avoid_types
        if body.group_id:
            try:
                # Try trip_members first
                members_res = None
                try:
                    members_res = (
                        supabase.table("trip_members")
                        .select("user_id")
                        .eq("trip_id", body.group_id)
                        .is_("left_at", None)
                        .execute()
                    )
                except Exception:
                    pass

                if not members_res or not members_res.data:
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
                        .select("avoid_types, dietary_restrictions, price_preference")
                        .in_("user_id", member_ids)
                        .execute()
                    )
                    for p in (prefs_res.data or []):
                        for t in (p.get("avoid_types") or []):
                            avoid_types.add(t.lower())
            except Exception:
                pass

        # 5. Filter suggestions by avoid_types
        if avoid_types:
            suggestions = [
                s for s in suggestions
                if not any(a in [t.lower() for t in s.get("types", [])] for a in avoid_types)
            ]

        # 6. Filter by price preference
        price_max = {"budget": 1, "moderate": 2, "expensive": 3}.get(price_pref)
        if price_max:
            v1_price_order = {
                "PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1,
                "PRICE_LEVEL_MODERATE": 2, "PRICE_LEVEL_EXPENSIVE": 3,
                "PRICE_LEVEL_VERY_EXPENSIVE": 4,
            }
            suggestions = [
                s for s in suggestions
                if v1_price_order.get(s.get("price_level"), 0) <= price_max
            ]

        # 7. Rank suggestions by preference match score
        for s in suggestions:
            score = 0
            s_types = [t.lower() for t in s.get("types", [])]
            # Boost if matches user's preferred categories
            for cat in preferred_cats:
                if cat.lower() in s_types:
                    score += 3
            # Boost high ratings
            if (s.get("rating") or 0) >= 4.5:
                score += 2
            elif (s.get("rating") or 0) >= 4.0:
                score += 1
            # Boost places that are open
            if s.get("is_open") is True:
                score += 1
            s["relevance_score"] = score

        suggestions.sort(key=lambda s: -s.get("relevance_score", 0))

        # 8. Weather check on outdoor suggestions
        suggestions = await _check_weather_for_suggestions(suggestions)

        # 9. Build chapters with coordinates
        chapters = _build_chapters(legs, body.departure_time)

        # 10. Build response
        total_duration = sum(leg["duration"]["value"] for leg in legs)
        total_distance = sum(leg["distance"]["value"] for leg in legs)

        # 11. Park & Walk auto-detect: if destination is in congested area
        park_walk_suggestion = None
        if user_prefs.get("park_and_walk_auto") and len(body.waypoints) >= 2:
            dest = body.waypoints[-1]
            origin = body.waypoints[0]
            try:
                from routers.gcs import park_and_walk, ParkAndWalkRequest
                pw_body = ParkAndWalkRequest(
                    destination_lat=dest.coordinates[1],
                    destination_lng=dest.coordinates[0],
                    origin_lat=origin.coordinates[1],
                    origin_lng=origin.coordinates[0],
                )
                pw_result = await park_and_walk(pw_body, current_user)
                if pw_result.get("recommendation") == "park_and_walk":
                    park_walk_suggestion = pw_result
            except Exception:
                pass

        response = {
            "route": {
                "overview_polyline": route["overview_polyline"]["points"],
                "bounds": route.get("bounds"),
                "total_distance": total_distance,
                "total_distance_text": f"{total_distance / 1000:.1f} km",
                "total_duration": total_duration,
                "total_duration_text": f"{total_duration // 60} min",
            },
            "chapters": chapters,
            "suggestions": suggestions[:12],
            "preference": body.preference,
            "user_preferences_applied": {
                "price": price_pref,
                "dietary": dietary,
                "avoided": list(avoid_types),
                "preferred_categories": preferred_cats,
            },
            "park_and_walk": park_walk_suggestion,
            "directions_data": directions_data,
        }

        # Broadcast to group via Supabase Realtime (insert triggers the channel)
        if body.group_id:
            try:
                supabase.table("route_broadcasts").upsert({
                    "trip_id": body.group_id,
                    "planned_by": user_id,
                    "route_summary": {
                        "polyline": route["overview_polyline"]["points"],
                        "distance": response["route"]["total_distance_text"],
                        "duration": response["route"]["total_duration_text"],
                        "preference": body.preference,
                        "suggestion_count": len(suggestions[:12]),
                    },
                    "updated_at": datetime.now().isoformat(),
                }, on_conflict="trip_id").execute()
            except Exception:
                pass  # Don't fail the route if broadcast fails

        return response

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
    UPSERTs into member_positions — triggers Supabase Realtime automatically.

    Body: { "lat": float, "lng": float, "heading": float, "accuracy": float }
    """
    user_id = current_user["id"]

    # Verify membership (try trip_members first, fallback to group_member)
    membership = None
    try:
        membership = (
            supabase.table("trip_members")
            .select("id")
            .eq("trip_id", group_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
            .maybe_single()
            .execute()
        )
    except Exception:
        pass

    if not membership or not membership.data:
        try:
            membership = (
                supabase.table("group_member")
                .select("id")
                .eq("group_id", group_id)
                .eq("user_id", user_id)
                .is_("left_datetime", None)
                .maybe_single()
                .execute()
            )
        except Exception:
            pass

    # Also check if user is the trip owner
    if not membership or not membership.data:
        try:
            owner = (
                supabase.table("trips")
                .select("id")
                .eq("id", group_id)
                .eq("owner_id", user_id)
                .maybe_single()
                .execute()
            )
            if owner and owner.data:
                membership = owner
        except Exception:
            pass

    if not membership or not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # UPSERT position into member_positions table
    supabase.table("member_positions").upsert(
        {
            "trip_id": group_id,
            "user_id": user_id,
            "lat": body.get("lat"),
            "lng": body.get("lng"),
            "heading": body.get("heading"),
            "accuracy": body.get("accuracy"),
            "updated_at": datetime.now().isoformat(),
        },
        on_conflict="trip_id,user_id",
    ).execute()

    return {"status": "ok", "user_id": user_id}


@router.get("/group-positions/{group_id}")
async def get_group_positions(
    group_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get last known positions of all group members.
    Now reads from member_positions table for actual location data.
    Frontend should also subscribe via Supabase Realtime for live updates.
    """
    user_id = current_user["id"]

    # Try trip_members first, fallback to group_member
    members_res = None
    try:
        members_res = (
            supabase.table("trip_members")
            .select("user_id, role")
            .eq("trip_id", group_id)
            .is_("left_at", None)
            .execute()
        )
    except Exception:
        pass

    if not members_res or not members_res.data:
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

    role_map = {m["user_id"]: m["role"] for m in (members_res.data or [])}

    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", member_ids)
        .execute()
    )
    name_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    # Fetch actual positions from member_positions
    pos_res = (
        supabase.table("member_positions")
        .select("user_id, lat, lng, heading, accuracy, updated_at")
        .eq("trip_id", group_id)
        .execute()
    )
    pos_map = {p["user_id"]: p for p in (pos_res.data or [])}

    members = []
    for uid in member_ids:
        pos = pos_map.get(uid)
        members.append({
            "user_id": uid,
            "username": name_map.get(uid, "Unknown"),
            "role": role_map.get(uid, "member"),
            "is_me": uid == user_id,
            "lat": pos["lat"] if pos else None,
            "lng": pos["lng"] if pos else None,
            "heading": pos["heading"] if pos else None,
            "accuracy": pos["accuracy"] if pos else None,
            "position_updated_at": pos["updated_at"] if pos else None,
        })

    return {"members": members}
