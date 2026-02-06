from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(
    prefix="/favorites",
    tags=["Favorites"]
)


# ---- Schemas ----
class FavoriteCreate(BaseModel):
    place_id: str
    place_name: str
    place_address: Optional[str] = None
    coordinates: List[float]  # [lng, lat]
    category: Optional[str] = None
    photos: Optional[List[dict]] = None
    rating: Optional[float] = None
    user_notes: Optional[str] = None


class FavoriteOut(BaseModel):
    id: str
    user_id: str
    place_id: str
    place_name: str
    place_address: Optional[str]
    coordinates: List[float]
    category: Optional[str]
    photos: Optional[List[dict]]
    rating: Optional[float]
    user_notes: Optional[str]
    created_at: str


class FavoriteUpdate(BaseModel):
    user_notes: Optional[str] = None
    category: Optional[str] = None


# ---- Helpers ----
def _format_coordinates_for_db(coords: List[float]) -> str:
    """Convert [lng, lat] to PostgreSQL POINT format '(lng,lat)'"""
    return f"({coords[0]},{coords[1]})"


def _parse_coordinates_from_db(point_str) -> List[float]:
    """Convert PostgreSQL POINT '(lng,lat)' back to [lng, lat]"""
    if isinstance(point_str, str):
        clean = point_str.strip("()")
        parts = clean.split(",")
        return [float(parts[0]), float(parts[1])]
    return [0.0, 0.0]


def _format_favorite(row: dict) -> dict:
    """Format a DB row into the API response format"""
    row["coordinates"] = _parse_coordinates_from_db(row.get("coordinates", "(0,0)"))
    if row.get("rating") is not None:
        row["rating"] = float(row["rating"])
    if row.get("created_at"):
        row["created_at"] = str(row["created_at"])
    return row


# ---- Endpoints ----

@router.post("/", status_code=status.HTTP_201_CREATED)
def add_favorite(
    fav: FavoriteCreate,
    current_user=Depends(oauth2.get_current_user)
):
    """Add a place to favorites"""
    try:
        data = {
            "user_id": current_user["id"],
            "place_id": fav.place_id,
            "place_name": fav.place_name,
            "place_address": fav.place_address,
            "coordinates": _format_coordinates_for_db(fav.coordinates),
            "category": fav.category,
            "photos": fav.photos,
            "rating": fav.rating,
            "user_notes": fav.user_notes,
        }

        res = supabase.table("favorite_places").insert(data).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to save favorite")

        return _format_favorite(res.data[0])

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Place already in favorites")
        print(f"Error adding favorite: {e}")
        raise HTTPException(status_code=500, detail="Error adding favorite")


@router.get("/", response_model=List[dict])
def get_my_favorites(
    category: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user)
):
    """Get all favorite places for current user"""
    try:
        query = (
            supabase
            .table("favorite_places")
            .select("*")
            .eq("user_id", current_user["id"])
        )

        if category:
            query = query.eq("category", category)

        res = query.order("created_at", desc=True).execute()

        return [_format_favorite(row) for row in (res.data or [])]

    except Exception as e:
        print(f"Error fetching favorites: {e}")
        raise HTTPException(status_code=500, detail="Error fetching favorites")


@router.delete("/{place_id}")
def remove_favorite(
    place_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """Remove a place from favorites"""
    try:
        res = (
            supabase
            .table("favorite_places")
            .delete()
            .eq("user_id", current_user["id"])
            .eq("place_id", place_id)
            .execute()
        )

        return {"message": "Favorite removed successfully"}

    except Exception as e:
        print(f"Error removing favorite: {e}")
        raise HTTPException(status_code=500, detail="Error removing favorite")


@router.put("/{place_id}")
def update_favorite(
    place_id: str,
    update: FavoriteUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    """Update notes or category on a favorite"""
    try:
        update_data = {}
        if update.user_notes is not None:
            update_data["user_notes"] = update.user_notes
        if update.category is not None:
            update_data["category"] = update.category

        if not update_data:
            raise HTTPException(status_code=400, detail="Nothing to update")

        res = (
            supabase
            .table("favorite_places")
            .update(update_data)
            .eq("user_id", current_user["id"])
            .eq("place_id", place_id)
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="Favorite not found")

        return _format_favorite(res.data[0])

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating favorite: {e}")
        raise HTTPException(status_code=500, detail="Error updating favorite")


@router.get("/check/{place_id}")
def check_favorite(
    place_id: str,
    current_user=Depends(oauth2.get_current_user)
):
    """Check if a place is in favorites"""
    try:
        res = (
            supabase
            .table("favorite_places")
            .select("id")
            .eq("user_id", current_user["id"])
            .eq("place_id", place_id)
            .execute()
        )

        return {"is_favorite": bool(res.data and len(res.data) > 0)}

    except Exception as e:
        print(f"Error checking favorite: {e}")
        raise HTTPException(status_code=500, detail="Error checking favorite")