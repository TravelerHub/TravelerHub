import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/navigation",
    tags=["Navigation"]
)


class OptimizeRequest(BaseModel):
    coordinates: List[List[float]]  # [[lng, lat], ...]
    mode: str = "driving"           # driving | walking | cycling


@router.get("/route")
async def get_route(
    origin: str = Query(..., description="lat,lng of start point"),
    destination: str = Query(..., description="lat,lng of end point"),
    waypoints: Optional[str] = Query(None, description="pipe-separated lat,lng|lat,lng"),
    mode: str = Query("driving", description="driving|walking|bicycling|transit"),
):
    """
    Proxy for Google Directions API. No auth required — this proxies public map data.
    Google Directions API is server-side only and does not support browser CORS.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_PLACES_API_KEY not set in backend .env"
        )

    params = {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "key": api_key,
    }

    if waypoints:
        params["waypoints"] = waypoints

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params=params
            )
            response.raise_for_status()
            data = response.json()

        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            error_msg = data.get("error_message", "No additional info from Google")
            raise HTTPException(
                status_code=400,
                detail=f"Directions API returned {status}: {error_msg}"
            )

        return data

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Directions API: {str(e)}")


@router.post("/optimize")
async def optimize_waypoint_order(body: OptimizeRequest):
    """
    Reorder waypoints for the most efficient route using Mapbox Optimized Trips API.
    Keeps the first coordinate as the origin and the last as the destination.
    Returns the optimized order as indices into the original array.
    """
    if len(body.coordinates) < 3:
        raise HTTPException(status_code=400, detail="At least 3 waypoints required for optimization")

    if len(body.coordinates) > 12:
        raise HTTPException(status_code=400, detail="Maximum 12 waypoints supported for optimization")

    mapbox_token = os.getenv("MAPBOX_TOKEN")
    if not mapbox_token:
        raise HTTPException(status_code=500, detail="MAPBOX_TOKEN not set in backend .env")

    # Mapbox expects lng,lat;lng,lat;... format
    coords_str = ";".join(f"{c[0]},{c[1]}" for c in body.coordinates)

    # Map our mode names to Mapbox profiles
    profile_map = {"driving": "mapbox/driving", "walking": "mapbox/walking", "cycling": "mapbox/cycling"}
    profile = profile_map.get(body.mode, "mapbox/driving")

    url = f"https://api.mapbox.com/optimized-trips/v1/{profile}/{coords_str}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params={
                "source": "first",
                "destination": "last",
                "roundtrip": "false",
                "access_token": mapbox_token,
            })
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok" or not data.get("trips"):
            raise HTTPException(
                status_code=400,
                detail=data.get("message", "Could not optimize route. Try different locations.")
            )

        trip = data["trips"][0]
        waypoints_result = data["waypoints"]

        return {
            "optimized_order": [wp["waypoint_index"] for wp in waypoints_result],
            "distance": trip.get("distance"),
            "duration": trip.get("duration"),
        }

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Mapbox API: {str(e)}")
