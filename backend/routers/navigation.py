import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/navigation",
    tags=["Navigation"]
)


@router.get("/route")
async def get_route(
    origin: str = Query(..., description="lat,lng of start point"),
    destination: str = Query(..., description="lat,lng of end point"),
    waypoints: Optional[str] = Query(None, description="pipe-separated lat,lng|lat,lng"),
    mode: str = Query("driving", description="driving|walking|bicycling|transit"),
    departure_time: Optional[str] = Query(None, description="Unix timestamp or 'now'"),
    alternatives: bool = Query(False, description="Request alternative routes"),
    avoid: Optional[str] = Query(None, description="tolls|highways|ferries"),
):
    """
    Proxy for Google Directions API with improved transit support.
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

    # For transit: departure_time is required for accurate results
    if mode == "transit":
        params["departure_time"] = departure_time or "now"
        # Transit always benefits from alternatives
        params["alternatives"] = "true"
    else:
        if departure_time:
            params["departure_time"] = departure_time
        if alternatives:
            params["alternatives"] = "true"

    if avoid:
        params["avoid"] = avoid

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


# ── Multi-modal routing ──────────────────────────────────────────────
# Allows per-leg transport modes: walk leg 1, drive leg 2, bus leg 3, etc.

class MultiModalLeg(BaseModel):
    origin: List[float]       # [lng, lat]
    destination: List[float]  # [lng, lat]
    mode: str                 # driving | walking | bicycling | transit


class MultiModalRequest(BaseModel):
    legs: List[MultiModalLeg]
    departure_time: Optional[str] = None


@router.post("/multi-route")
async def get_multi_modal_route(body: MultiModalRequest):
    """
    Plan a multi-modal route. Each leg can have a different transport mode.
    Returns an array of route results — one per leg — that the frontend
    stitches together on the map with per-segment styling.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY not set")

    if len(body.legs) == 0:
        raise HTTPException(status_code=400, detail="At least 1 leg required")

    results = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for i, leg in enumerate(body.legs):
            params = {
                "origin": f"{leg.origin[1]},{leg.origin[0]}",
                "destination": f"{leg.destination[1]},{leg.destination[0]}",
                "mode": leg.mode,
                "key": api_key,
            }

            if leg.mode == "transit":
                params["departure_time"] = body.departure_time or "now"

            try:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "OK":
                    results.append({
                        "leg_index": i,
                        "mode": leg.mode,
                        "status": data.get("status"),
                        "error": data.get("error_message", "No route found"),
                        "routes": [],
                    })
                else:
                    results.append({
                        "leg_index": i,
                        "mode": leg.mode,
                        "status": "OK",
                        "routes": data["routes"],
                    })
            except Exception as e:
                results.append({
                    "leg_index": i,
                    "mode": leg.mode,
                    "status": "ERROR",
                    "error": str(e),
                    "routes": [],
                })

    return {"legs": results}
