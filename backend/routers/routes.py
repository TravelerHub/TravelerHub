from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from utils import oauth2  
from supabase_client import supabase 

router = APIRouter(prefix="/routes", tags=["Routes"])

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
    """Get user's saved routes"""
    query = supabase.table("saved_routes").select("*").eq("created_by", current_user["id"])
    
    if trip_id:
        query = query.eq("trip_id", trip_id)
    
    result = query.order("created_at", desc=True).execute()
    return result.data

@router.delete("/{route_id}")
async def delete_route(
    route_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """Delete a saved route"""
    result = (
        supabase.table("saved_routes")
        .delete()
        .eq("id", route_id)
        .eq("created_by", current_user["id"])
        .execute()
    )
    
    return {"message": "Route deleted successfully"}