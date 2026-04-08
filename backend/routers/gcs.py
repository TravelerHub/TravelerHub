"""
Group-Centric Search (GCS) API — the "Waze+" layer.

Features:
  1. Geometric Median (Weiszfeld's Algorithm) — optimal fair meeting point for N travelers
  2. Group Arrival Sync — batch ETA comparison via Distance Matrix API
  3. Isochrone-based "Along the Way" search — time-budget corridor, not a thin line
  4. Park-and-Walk multimodal routing for high-congestion zones
  5. Veto / Social Contract enforcement on route decisions
"""

import os
import math
import uuid
import httpx
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from utils import oauth2
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/gcs", tags=["Group-Centric Search"])

# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class FairPointRequest(BaseModel):
    trip_id: str
    poi_type: Optional[str] = "restaurant"   # Google Places type to search near median
    keyword: Optional[str] = None            # e.g. "Italian" from preference intersection
    radius: int = 1500                       # metres around the geometric median
    auto_poll: bool = False                  # trigger a ranked-choice micro-poll?


class GroupArrivalRequest(BaseModel):
    trip_id: str
    destination_lat: float
    destination_lng: float


class IsochroneSearchRequest(BaseModel):
    trip_id: str
    route_polyline: str                      # encoded overview polyline of current route
    time_budget_minutes: int = 10            # max detour time
    poi_type: str = "restaurant"
    keyword: Optional[str] = None


class ParkAndWalkRequest(BaseModel):
    destination_lat: float
    destination_lng: float
    origin_lat: float
    origin_lng: float
    walk_radius: int = 500                   # metres — search parking within this radius


class VetoCheckRequest(BaseModel):
    trip_id: str
    proposed_place_types: List[str] = []     # types from Google Places result
    proposed_tolls: bool = False             # route uses toll roads


# ─────────────────────────────────────────────────────────────────────────────
# 1. Geometric Median — Weiszfeld's Algorithm
# ─────────────────────────────────────────────────────────────────────────────

def _weiszfeld(points: List[tuple], max_iter: int = 100, tol: float = 1e-7) -> tuple:
    """
    Weiszfeld's iterative algorithm for the geometric median.
    Input:  list of (lat, lng) tuples
    Output: (lat, lng) that minimises total Euclidean distance to all points.
    """
    if len(points) == 1:
        return points[0]
    if len(points) == 2:
        return ((points[0][0] + points[1][0]) / 2,
                (points[0][1] + points[1][1]) / 2)

    # Initialise with the centroid
    x = sum(p[0] for p in points) / len(points)
    y = sum(p[1] for p in points) / len(points)

    for _ in range(max_iter):
        weights = []
        for p in points:
            d = math.sqrt((p[0] - x) ** 2 + (p[1] - y) ** 2)
            weights.append(1.0 / max(d, 1e-12))

        total_w = sum(weights)
        new_x = sum(w * p[0] for w, p in zip(weights, points)) / total_w
        new_y = sum(w * p[1] for w, p in zip(weights, points)) / total_w

        if math.sqrt((new_x - x) ** 2 + (new_y - y) ** 2) < tol:
            break
        x, y = new_x, new_y

    return (x, y)


def _get_group_preference_intersection(member_ids: list) -> dict:
    """Find the intersection of group preferences — categories everyone likes."""
    prefs_res = (
        supabase.table("user_preferences")
        .select("preferred_categories, dietary_restrictions, interests, avoid_types, price_preference, travel_pace, spontaneity_score")
        .in_("user_id", member_ids)
        .execute()
    )
    rows = prefs_res.data or []
    if not rows:
        return {}

    # Intersection: categories that ALL members have selected
    cat_sets = [set(r.get("preferred_categories") or []) for r in rows if r.get("preferred_categories")]
    common_categories = list(set.intersection(*cat_sets)) if cat_sets else []

    # Intersection of interests
    int_sets = [set(r.get("interests") or []) for r in rows if r.get("interests")]
    common_interests = list(set.intersection(*int_sets)) if int_sets else []

    # Union of dietary restrictions (everyone's restrictions must be honoured)
    all_dietary = set()
    for r in rows:
        for d in (r.get("dietary_restrictions") or []):
            all_dietary.add(d)

    # Union of avoid_types (anyone's avoid blocks the group)
    all_avoid = set()
    for r in rows:
        for a in (r.get("avoid_types") or []):
            all_avoid.add(a)

    # Most conservative price preference
    price_order = {"budget": 1, "moderate": 2, "expensive": 3, "any": 4}
    prices = [r.get("price_preference", "any") for r in rows]
    most_conservative = min(prices, key=lambda p: price_order.get(p, 4))

    # Average spontaneity
    spont_scores = [r.get("spontaneity_score", 5) for r in rows]
    avg_spontaneity = round(sum(spont_scores) / len(spont_scores))

    # Most conservative pace
    pace_order = {"chill": 1, "moderate": 2, "packed": 3}
    paces = [r.get("travel_pace", "moderate") for r in rows]
    group_pace = min(paces, key=lambda p: pace_order.get(p, 2))

    return {
        "common_categories": common_categories,
        "common_interests": common_interests,
        "all_dietary": list(all_dietary),
        "all_avoid": list(all_avoid),
        "price_preference": most_conservative,
        "avg_spontaneity": avg_spontaneity,
        "group_pace": group_pace,
    }


@router.post("/fair-point")
async def find_fair_point(
    body: FairPointRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    1. Pull live positions from member_positions.
    2. Compute the Geometric Median via Weiszfeld's algorithm.
    3. Query Google Places for POIs near that coordinate that match
       the intersection of all members' preferences.
    4. Optionally trigger a ranked-choice micro-poll (UC#5) on the results.
    """
    user_id = current_user["id"]

    # 1. Get live member positions
    pos_res = (
        supabase.table("member_positions")
        .select("user_id, lat, lng, updated_at")
        .eq("trip_id", body.trip_id)
        .execute()
    )
    positions = pos_res.data or []
    if len(positions) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 member positions for fair-point calculation")

    member_ids = [p["user_id"] for p in positions]
    points = [(p["lat"], p["lng"]) for p in positions]

    # 2. Compute geometric median
    median_lat, median_lng = _weiszfeld(points)

    # 3. Get group preference intersection for keyword filtering
    group_prefs = _get_group_preference_intersection(member_ids)
    keyword = body.keyword
    if not keyword and group_prefs.get("common_categories"):
        keyword = group_prefs["common_categories"][0]

    # 4. Search Google Places near the median
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    params = {
        "location": f"{median_lat},{median_lng}",
        "radius": body.radius,
        "type": body.poi_type,
        "key": api_key,
    }
    if keyword:
        params["keyword"] = keyword

    # Apply group price constraint
    price_map = {"budget": 1, "moderate": 2, "expensive": 3}
    max_price = price_map.get(group_prefs.get("price_preference", "any"))
    if max_price:
        params["maxprice"] = max_price

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params=params,
        )
        data = resp.json()

    results = data.get("results", [])

    # Filter out places matching any member's avoid_types
    avoid = set(a.lower() for a in group_prefs.get("all_avoid", []))
    if avoid:
        results = [
            r for r in results
            if not any(a in [t.lower() for t in r.get("types", [])] for a in avoid)
        ]

    # Build suggestion list
    suggestions = []
    for r in results[:5]:
        loc = r.get("geometry", {}).get("location", {})
        suggestions.append({
            "place_id": r.get("place_id"),
            "name": r.get("name"),
            "address": r.get("vicinity"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "rating": r.get("rating"),
            "price_level": r.get("price_level"),
            "types": r.get("types", []),
            "user_ratings_total": r.get("user_ratings_total", 0),
        })

    # 5. Optionally create a ranked-choice micro-poll
    poll_id = None
    if body.auto_poll and len(suggestions) >= 2:
        poll_res = supabase.table("polls").insert({
            "id": str(uuid.uuid4()),
            "trip_id": body.trip_id,
            "created_by": user_id,
            "poll_type": "ranked_choice",
            "title": f"Fair-Point: Best {body.poi_type} for the group?",
            "status": "open",
        }).execute()

        if poll_res.data:
            poll_id = poll_res.data[0]["id"]
            for s in suggestions[:5]:
                supabase.table("poll_options").insert({
                    "id": str(uuid.uuid4()),
                    "poll_id": poll_id,
                    "created_by": user_id,
                    "text": s["name"],
                    "value": {
                        "place_id": s["place_id"],
                        "lat": s["lat"],
                        "lng": s["lng"],
                        "address": s["address"],
                    },
                    "vote_count": 0,
                    "ai_suggested": True,
                }).execute()

    return {
        "geometric_median": {"lat": median_lat, "lng": median_lng},
        "member_count": len(positions),
        "group_preferences": group_prefs,
        "suggestions": suggestions,
        "poll_id": poll_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Group Arrival Sync — batch ETA via Distance Matrix
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/group-arrival-sync")
async def group_arrival_sync(
    body: GroupArrivalRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Calculate ETAs for ALL group members to a shared destination.
    Uses Google Distance Matrix for a single batch call.
    Returns delay warnings + leader alert if someone is >15 min behind.
    """
    # 1. Fetch all member positions
    pos_res = (
        supabase.table("member_positions")
        .select("user_id, lat, lng, updated_at")
        .eq("trip_id", body.trip_id)
        .execute()
    )
    positions = pos_res.data or []
    if not positions:
        return {"status": "no_positions", "members": []}

    # 2. Get member info + identify leader
    members_res = (
        supabase.table("trip_members")
        .select("user_id, role")
        .eq("trip_id", body.trip_id)
        .is_("left_at", None)
        .execute()
    )
    role_map = {m["user_id"]: m["role"] for m in (members_res.data or [])}
    leader_id = next((uid for uid, r in role_map.items() if r == "leader"), None)

    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", [p["user_id"] for p in positions])
        .execute()
    )
    name_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    # 3. Batch ETA via Google Distance Matrix
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    origins = "|".join(f"{p['lat']},{p['lng']}" for p in positions)
    destination = f"{body.destination_lat},{body.destination_lng}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={
                "origins": origins,
                "destinations": destination,
                "mode": "driving",
                "departure_time": "now",
                "key": api_key,
            },
        )
        matrix = resp.json()

    if matrix.get("status") != "OK":
        raise HTTPException(status_code=502, detail=f"Distance Matrix error: {matrix.get('status')}")

    # 4. Parse ETAs
    etas = []
    for i, pos in enumerate(positions):
        row = matrix.get("rows", [])[i] if i < len(matrix.get("rows", [])) else None
        if not row:
            continue
        element = row["elements"][0]
        if element.get("status") != "OK":
            continue

        duration_field = element.get("duration_in_traffic", element.get("duration", {}))
        eta_seconds = duration_field.get("value", 0)

        etas.append({
            "user_id": pos["user_id"],
            "username": name_map.get(pos["user_id"], "Unknown"),
            "role": role_map.get(pos["user_id"], "member"),
            "eta_seconds": eta_seconds,
            "eta_text": duration_field.get("text", ""),
            "distance_text": element.get("distance", {}).get("text", ""),
            "last_position_update": pos["updated_at"],
        })

    if not etas:
        return {"status": "no_routes", "members": []}

    # 5. Compute group stats & detect outliers
    eta_values = [e["eta_seconds"] for e in etas]
    min_eta = min(eta_values)
    max_eta = max(eta_values)
    avg_eta = sum(eta_values) / len(eta_values)

    DEVIATION_THRESHOLD = 900  # 15 minutes in seconds
    for e in etas:
        e["deviation_seconds"] = e["eta_seconds"] - min_eta
        e["is_delayed"] = e["deviation_seconds"] > DEVIATION_THRESHOLD
        e["status"] = "delayed" if e["is_delayed"] else "on_track"

    delayed = [e for e in etas if e["is_delayed"]]

    return {
        "status": "sync_complete",
        "destination": {"lat": body.destination_lat, "lng": body.destination_lng},
        "group_eta": {
            "earliest_seconds": min_eta,
            "latest_seconds": max_eta,
            "average_seconds": round(avg_eta),
            "spread_minutes": round((max_eta - min_eta) / 60),
        },
        "members": sorted(etas, key=lambda e: e["eta_seconds"]),
        "delayed_count": len(delayed),
        "delayed_members": [
            {"username": d["username"], "extra_minutes": round(d["deviation_seconds"] / 60)}
            for d in delayed
        ],
        "leader_alert": len(delayed) > 0,
        "leader_id": leader_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Isochrone "Along the Way" Search
# ─────────────────────────────────────────────────────────────────────────────

def _decode_polyline(encoded: str) -> List[tuple]:
    """Decode a Google-encoded polyline string into (lat, lng) tuples."""
    index, lat, lng = 0, 0, 0
    coords = []
    while index < len(encoded):
        for var in ('lat', 'lng'):
            shift, result = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if var == 'lat':
                lat += delta
            else:
                lng += delta
        coords.append((lat / 1e5, lng / 1e5))
    return coords


def _sample_route_points(polyline_coords: List[tuple], num_samples: int = 6) -> List[tuple]:
    """Pick evenly-spaced points along a decoded polyline."""
    n = len(polyline_coords)
    if n <= num_samples:
        return polyline_coords
    step = max(1, n // num_samples)
    return [polyline_coords[i] for i in range(0, n, step)][:num_samples]


@router.post("/isochrone-search")
async def isochrone_along_route(
    body: IsochroneSearchRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Instead of a thin line corridor, search within a TIME-BUDGET around the route.

    Algorithm:
      1. Decode the route polyline and sample N points along it.
      2. For each sample point, search Google Places.
      3. For each POI found, ask Distance Matrix: "How much detour from the route?"
      4. Keep only POIs where detour <= time_budget_minutes.

    This finds the "hidden gem BBQ spot 2 miles off the highway but only 4 min away."
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    # 1. Decode polyline and sample points
    coords = _decode_polyline(body.route_polyline)
    if not coords:
        raise HTTPException(status_code=400, detail="Could not decode route polyline")

    sample_points = _sample_route_points(coords, num_samples=5)

    # 2. Search POIs near each sample point
    raw_pois = []
    seen_ids = set()

    async with httpx.AsyncClient(timeout=10.0) as client:
        for lat, lng in sample_points:
            params = {
                "location": f"{lat},{lng}",
                "radius": 3000,  # wider radius — the time filter narrows it
                "type": body.poi_type,
                "key": api_key,
            }
            if body.keyword:
                params["keyword"] = body.keyword

            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params=params,
                )
                data = resp.json()
                for r in (data.get("results") or [])[:5]:
                    pid = r.get("place_id")
                    if pid and pid not in seen_ids:
                        seen_ids.add(pid)
                        loc = r.get("geometry", {}).get("location", {})
                        raw_pois.append({
                            "place_id": pid,
                            "name": r.get("name"),
                            "address": r.get("vicinity"),
                            "lat": loc.get("lat"),
                            "lng": loc.get("lng"),
                            "rating": r.get("rating"),
                            "price_level": r.get("price_level"),
                            "types": r.get("types", []),
                            "user_ratings_total": r.get("user_ratings_total", 0),
                            "nearest_route_point": (lat, lng),
                        })
            except Exception:
                continue

    if not raw_pois:
        return {"results": [], "time_budget_minutes": body.time_budget_minutes}

    # 3. Batch detour check — for each POI, how long is the round-trip detour
    #    from the nearest route point?
    #    (route_point → POI → route_point) — if < budget, it's a keeper
    time_budget_seconds = body.time_budget_minutes * 60
    filtered = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Process in batches of 10 (Distance Matrix limits)
        for batch_start in range(0, len(raw_pois), 10):
            batch = raw_pois[batch_start:batch_start + 10]
            origins = "|".join(
                f"{p['nearest_route_point'][0]},{p['nearest_route_point'][1]}"
                for p in batch
            )
            destinations = "|".join(f"{p['lat']},{p['lng']}" for p in batch)

            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": origins,
                        "destinations": destinations,
                        "mode": "driving",
                        "key": api_key,
                    },
                )
                matrix = resp.json()

                for i, poi in enumerate(batch):
                    if i < len(matrix.get("rows", [])):
                        element = matrix["rows"][i]["elements"][i] if i < len(matrix["rows"][i]["elements"]) else None
                        if element and element.get("status") == "OK":
                            detour_one_way = element["duration"]["value"]
                            detour_round_trip = detour_one_way * 2  # there and back

                            if detour_round_trip <= time_budget_seconds:
                                poi["detour_minutes"] = round(detour_round_trip / 60, 1)
                                poi["detour_text"] = f"+{poi['detour_minutes']} min detour"
                                del poi["nearest_route_point"]
                                filtered.append(poi)
            except Exception:
                continue

    # Sort by rating (best first), then by detour (shortest first)
    filtered.sort(key=lambda p: (-(p.get("rating") or 0), p.get("detour_minutes", 99)))

    return {
        "results": filtered[:10],
        "time_budget_minutes": body.time_budget_minutes,
        "total_scanned": len(raw_pois),
        "within_budget": len(filtered),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Park-and-Walk Multimodal Routing
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/park-and-walk")
async def park_and_walk(
    body: ParkAndWalkRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    For high-congestion destinations: find parking nearby, then walk.
    Returns a hybrid Drive→Park→Walk route with combined ETA.
    Also checks if a "scenic walk" option is available (<10% longer).
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    # 1. Search for parking near the destination
    async with httpx.AsyncClient(timeout=10.0) as client:
        parking_resp = await client.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "location": f"{body.destination_lat},{body.destination_lng}",
                "radius": body.walk_radius,
                "type": "parking",
                "key": api_key,
            },
        )
        parking_data = parking_resp.json()

    lots = []
    for r in (parking_data.get("results") or [])[:5]:
        loc = r.get("geometry", {}).get("location", {})
        lots.append({
            "place_id": r.get("place_id"),
            "name": r.get("name"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "rating": r.get("rating"),
            "vicinity": r.get("vicinity"),
        })

    if not lots:
        return {
            "has_parking_options": False,
            "recommendation": "No parking found nearby. Consider rideshare or transit.",
            "options": [],
        }

    # 2. For each parking lot, compute Drive ETA + Walk ETA
    options = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for lot in lots:
            # Drive: origin → parking lot
            drive_resp = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": f"{body.origin_lat},{body.origin_lng}",
                    "destination": f"{lot['lat']},{lot['lng']}",
                    "mode": "driving",
                    "departure_time": "now",
                    "key": api_key,
                },
            )
            drive_data = drive_resp.json()

            # Walk: parking lot → final destination
            walk_resp = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": f"{lot['lat']},{lot['lng']}",
                    "destination": f"{body.destination_lat},{body.destination_lng}",
                    "mode": "walking",
                    "key": api_key,
                },
            )
            walk_data = walk_resp.json()

            if drive_data.get("status") == "OK" and walk_data.get("status") == "OK":
                drive_leg = drive_data["routes"][0]["legs"][0]
                walk_leg = walk_data["routes"][0]["legs"][0]

                drive_sec = drive_leg.get("duration_in_traffic", drive_leg["duration"])["value"]
                walk_sec = walk_leg["duration"]["value"]
                total_sec = drive_sec + walk_sec

                options.append({
                    "parking_lot": lot,
                    "drive": {
                        "duration_seconds": drive_sec,
                        "duration_text": drive_leg.get("duration_in_traffic", drive_leg["duration"])["text"],
                        "distance_text": drive_leg["distance"]["text"],
                        "polyline": drive_data["routes"][0]["overview_polyline"]["points"],
                    },
                    "walk": {
                        "duration_seconds": walk_sec,
                        "duration_text": walk_leg["duration"]["text"],
                        "distance_text": walk_leg["distance"]["text"],
                        "polyline": walk_data["routes"][0]["overview_polyline"]["points"],
                    },
                    "total_seconds": total_sec,
                    "total_text": f"{total_sec // 60} min total (drive {drive_sec // 60} + walk {walk_sec // 60})",
                })

    # 3. Also compute the direct drive ETA for comparison
    direct_drive = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        dd_resp = await client.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={
                "origin": f"{body.origin_lat},{body.origin_lng}",
                "destination": f"{body.destination_lat},{body.destination_lng}",
                "mode": "driving",
                "departure_time": "now",
                "key": api_key,
            },
        )
        dd_data = dd_resp.json()
        if dd_data.get("status") == "OK":
            dd_leg = dd_data["routes"][0]["legs"][0]
            dd_sec = dd_leg.get("duration_in_traffic", dd_leg["duration"])["value"]
            direct_drive = {
                "duration_seconds": dd_sec,
                "duration_text": dd_leg.get("duration_in_traffic", dd_leg["duration"])["text"],
                "distance_text": dd_leg["distance"]["text"],
            }

    # Sort by total time
    options.sort(key=lambda o: o["total_seconds"])

    # 4. Determine recommendation
    recommendation = "direct_drive"
    if options and direct_drive:
        best_hybrid = options[0]["total_seconds"]
        direct_sec = direct_drive["duration_seconds"]
        # If park-and-walk is within 10% of direct drive, prefer it for "enjoyment"
        if best_hybrid <= direct_sec * 1.10:
            recommendation = "park_and_walk"

    return {
        "has_parking_options": len(options) > 0,
        "recommendation": recommendation,
        "direct_drive": direct_drive,
        "options": options[:3],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Veto / Social Contract Check
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/veto-check")
async def veto_check(
    body: VetoCheckRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Before finalising a route or destination, check if any member's hard
    constraints (avoid_types, tolls, dietary) would be violated.

    Returns a verdict: 'approved', 'vetoed', or 'needs_vote' depending on
    the group's Social Contract setting.
    """
    # 1. Load group settings (social contract)
    settings_res = (
        supabase.table("group_settings")
        .select("*")
        .eq("trip_id", body.trip_id)
        .maybe_single()
        .execute()
    )
    settings = settings_res.data if settings_res.data else {
        "vote_mode": "majority",
        "veto_enabled": True,
        "veto_scope": ["tolls", "dietary_restrictions", "avoid_types"],
    }

    # 2. Load all member preferences
    members_res = (
        supabase.table("trip_members")
        .select("user_id")
        .eq("trip_id", body.trip_id)
        .is_("left_at", None)
        .execute()
    )
    member_ids = [m["user_id"] for m in (members_res.data or [])]

    prefs_res = (
        supabase.table("user_preferences")
        .select("user_id, avoid_types, dietary_restrictions")
        .in_("user_id", member_ids)
        .execute()
    )

    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", member_ids)
        .execute()
    )
    name_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    # 3. Check for violations
    violations = []
    proposed_types_lower = [t.lower() for t in body.proposed_place_types]

    for pref in (prefs_res.data or []):
        uid = pref["user_id"]
        username = name_map.get(uid, "Unknown")

        # Check avoid_types
        if "avoid_types" in settings.get("veto_scope", []):
            for avoid in (pref.get("avoid_types") or []):
                if avoid.lower() in proposed_types_lower:
                    violations.append({
                        "user_id": uid,
                        "username": username,
                        "type": "avoid_types",
                        "detail": f"{username} wants to avoid '{avoid}'",
                    })

        # Check dietary (if destination is food-related)
        food_types = {"restaurant", "cafe", "bakery", "bar", "food", "meal_delivery", "meal_takeaway"}
        if "dietary_restrictions" in settings.get("veto_scope", []):
            if any(t in food_types for t in proposed_types_lower):
                for diet in (pref.get("dietary_restrictions") or []):
                    if diet and diet != "none":
                        violations.append({
                            "user_id": uid,
                            "username": username,
                            "type": "dietary_restrictions",
                            "detail": f"{username} has dietary restriction: {diet}",
                        })

    # Check toll road
    if body.proposed_tolls and "tolls" in settings.get("veto_scope", []):
        for pref in (prefs_res.data or []):
            uid = pref["user_id"]
            username = name_map.get(uid, "Unknown")
            if "tolls" in (pref.get("avoid_types") or []):
                violations.append({
                    "user_id": uid,
                    "username": username,
                    "type": "tolls",
                    "detail": f"{username} wants to avoid toll roads",
                })

    # 4. Determine verdict based on social contract
    if not violations:
        return {"verdict": "approved", "violations": [], "vote_mode": settings["vote_mode"]}

    if not settings.get("veto_enabled", True):
        # Veto disabled — violations are warnings only
        return {
            "verdict": "approved_with_warnings",
            "violations": violations,
            "vote_mode": settings["vote_mode"],
            "message": "Veto is disabled for this group. Violations noted as warnings.",
        }

    if settings["vote_mode"] == "unanimous":
        return {
            "verdict": "vetoed",
            "violations": violations,
            "vote_mode": "unanimous",
            "message": "Unanimous mode: any constraint violation blocks the decision.",
        }
    elif settings["vote_mode"] == "leader_decides":
        return {
            "verdict": "needs_leader_approval",
            "violations": violations,
            "vote_mode": "leader_decides",
            "message": "Leader must approve despite constraint violations.",
        }
    else:  # majority
        return {
            "verdict": "needs_vote",
            "violations": violations,
            "vote_mode": "majority",
            "message": "Majority mode: put this to a group vote to override individual constraints.",
        }


# ─────────────────────────────────────────────────────────────────────────────
# 6. Group Social Contract CRUD
# ─────────────────────────────────────────────────────────────────────────────

class GroupSettingsUpdate(BaseModel):
    vote_mode: Optional[str] = None
    veto_enabled: Optional[bool] = None
    veto_scope: Optional[List[str]] = None


@router.get("/group-settings/{trip_id}")
def get_group_settings(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Get the group's social contract settings."""
    res = (
        supabase.table("group_settings")
        .select("*")
        .eq("trip_id", trip_id)
        .maybe_single()
        .execute()
    )
    if res.data:
        return res.data

    # Return defaults
    return {
        "trip_id": trip_id,
        "vote_mode": "majority",
        "veto_enabled": True,
        "veto_scope": ["tolls", "dietary_restrictions", "avoid_types"],
    }


@router.put("/group-settings/{trip_id}")
def update_group_settings(
    trip_id: str,
    body: GroupSettingsUpdate,
    current_user=Depends(oauth2.get_current_user),
):
    """Update the group's social contract. Leader only."""
    # Verify leader
    members = (
        supabase.table("trip_members")
        .select("user_id, role")
        .eq("trip_id", trip_id)
        .is_("left_at", None)
        .execute()
    )
    is_leader = any(
        m["user_id"] == current_user["id"] and m["role"] == "leader"
        for m in (members.data or [])
    )
    if not is_leader:
        raise HTTPException(status_code=403, detail="Only the trip leader can update group settings")

    update_data = {}
    if body.vote_mode is not None:
        if body.vote_mode not in ("majority", "unanimous", "leader_decides"):
            raise HTTPException(status_code=400, detail="Invalid vote_mode")
        update_data["vote_mode"] = body.vote_mode
    if body.veto_enabled is not None:
        update_data["veto_enabled"] = body.veto_enabled
    if body.veto_scope is not None:
        update_data["veto_scope"] = body.veto_scope

    if not update_data:
        return get_group_settings(trip_id, current_user)

    update_data["updated_at"] = "now()"

    # Upsert
    existing = (
        supabase.table("group_settings")
        .select("id")
        .eq("trip_id", trip_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        res = (
            supabase.table("group_settings")
            .update(update_data)
            .eq("trip_id", trip_id)
            .execute()
        )
    else:
        update_data["trip_id"] = trip_id
        res = supabase.table("group_settings").insert(update_data).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update group settings")
    return res.data[0]
