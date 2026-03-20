import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
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
