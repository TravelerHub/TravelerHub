from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from utils import oauth2  
from supabase_client import supabase 

router = APIRouter(prefix="/routes", tags=["Routes"])


def _ensure_trip_member(trip_id: str, user_id: str) -> None:
    member = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if member.data:
        return

    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not owner.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _is_trip_leader(trip_id: str, user_id: str) -> bool:
    member = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if member.data:
        return True

    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    return bool(owner.data)

class LocationPoint(BaseModel):
    name: str
    address: str
    coordinates: List[float]

class RouteCreate(BaseModel):
    trip_id: Optional[str] = None
    name: str
    waypoints: List[LocationPoint]
    route_data: dict
    total_distance: float
    total_duration: float

class RouteResponse(BaseModel):
    id: str
    name: str
    waypoints: List[dict]
    route_data: dict
    total_distance: float
    total_duration: float
    created_by: str
    created_at: datetime

@router.post("/", response_model=RouteResponse)
async def save_route(
    route: RouteCreate,
    current_user=Depends(oauth2.get_current_user)
):
    """Save a planned route"""
    if route.trip_id:
        _ensure_trip_member(route.trip_id, current_user["id"])

    route_data = {
        "trip_id": route.trip_id,
        "name": route.name,
        "waypoints": [w.dict() for w in route.waypoints],
        "route_data": route.route_data,
        "total_distance": route.total_distance,
        "total_duration": route.total_duration,
        "created_by": current_user["id"]
    }
    
    result = supabase.table("saved_routes").insert(route_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save route")
    
    return result.data[0]

@router.get("/", response_model=List[RouteResponse])
async def get_my_routes(
    trip_id: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user)
):
    """Get routes. If trip_id provided, return shared routes for that trip."""
    query = supabase.table("saved_routes").select("*")
    
    if trip_id:
        _ensure_trip_member(trip_id, current_user["id"])
        query = query.eq("trip_id", trip_id)
    else:
        query = query.eq("created_by", current_user["id"])
    
    result = query.order("created_at", desc=True).execute()
    return result.data

@router.delete("/{route_id}")
async def delete_route(
    route_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """Delete a saved route"""
    route_res = (
        supabase.table("saved_routes")
        .select("id, created_by, trip_id")
        .eq("id", route_id)
        .maybe_single()
        .execute()
    )
    if not route_res.data:
        raise HTTPException(status_code=404, detail="Route not found")

    route = route_res.data
    allowed = route.get("created_by") == current_user["id"]
    if (not allowed) and route.get("trip_id"):
        _ensure_trip_member(route["trip_id"], current_user["id"])
        allowed = _is_trip_leader(route["trip_id"], current_user["id"])

    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this route")

    result = (
        supabase.table("saved_routes")
        .delete()
        .eq("id", route_id)
        .execute()
    )
    
    return {"message": "Route deleted successfully"}