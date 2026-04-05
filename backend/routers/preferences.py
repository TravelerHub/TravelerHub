from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(
    prefix="/preferences",
    tags=["Preferences"]
)


# ---- Schemas ----
class PreferencesUpdate(BaseModel):
    preferred_categories: Optional[List[str]] = None
    price_preference: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    avoid_types: Optional[List[str]] = None
    travel_pace: Optional[str] = None           # chill | moderate | packed
    spontaneity_score: Optional[int] = None     # 1-10
    park_and_walk_auto: Optional[bool] = None
    silent_mode: Optional[bool] = None


class PreferencesOut(BaseModel):
    id: str
    user_id: str
    preferred_categories: List[str]
    price_preference: str
    dietary_restrictions: List[str]
    interests: List[str]
    avoid_types: List[str]
    travel_pace: Optional[str] = "moderate"
    spontaneity_score: Optional[int] = 5
    park_and_walk_auto: Optional[bool] = False
    silent_mode: Optional[bool] = False


# ---- Endpoints ----

@router.get("/me", response_model=PreferencesOut)
def get_my_preferences(current_user=Depends(oauth2.get_current_user)):
    """Get current user's travel preferences"""
    try:
        res = (
            supabase
            .table("user_preferences")
            .select("*")
            .eq("user_id", current_user["id"])
            .execute()
        )

        if res.data and len(res.data) > 0:
            return res.data[0]

        # No preferences yet — create default row
        default = {
            "user_id": current_user["id"],
            "preferred_categories": [],
            "price_preference": "moderate",
            "dietary_restrictions": [],
            "interests": [],
            "avoid_types": [],
        }
        insert_res = supabase.table("user_preferences").insert(default).execute()

        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create default preferences")

        return insert_res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching preferences: {e}")
        raise HTTPException(status_code=500, detail="Error fetching preferences")


@router.put("/me", response_model=PreferencesOut)
def update_my_preferences(
    prefs: PreferencesUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    """Update current user's travel preferences"""
    try:
        # Build update payload with only provided fields
        update_data = {}
        if prefs.preferred_categories is not None:
            update_data["preferred_categories"] = prefs.preferred_categories
        if prefs.price_preference is not None:
            update_data["price_preference"] = prefs.price_preference
        if prefs.dietary_restrictions is not None:
            update_data["dietary_restrictions"] = prefs.dietary_restrictions
        if prefs.interests is not None:
            update_data["interests"] = prefs.interests
        if prefs.avoid_types is not None:
            update_data["avoid_types"] = prefs.avoid_types
        if prefs.travel_pace is not None:
            if prefs.travel_pace not in ("chill", "moderate", "packed"):
                raise HTTPException(status_code=400, detail="travel_pace must be chill, moderate, or packed")
            update_data["travel_pace"] = prefs.travel_pace
        if prefs.spontaneity_score is not None:
            if not (1 <= prefs.spontaneity_score <= 10):
                raise HTTPException(status_code=400, detail="spontaneity_score must be 1-10")
            update_data["spontaneity_score"] = prefs.spontaneity_score
        if prefs.park_and_walk_auto is not None:
            update_data["park_and_walk_auto"] = prefs.park_and_walk_auto
        if prefs.silent_mode is not None:
            update_data["silent_mode"] = prefs.silent_mode

        if not update_data:
            # Nothing to update, return current
            return get_my_preferences(current_user)

        update_data["updated_at"] = "now()"

        # Check if row exists
        existing = (
            supabase
            .table("user_preferences")
            .select("id")
            .eq("user_id", current_user["id"])
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            # Update existing
            res = (
                supabase
                .table("user_preferences")
                .update(update_data)
                .eq("user_id", current_user["id"])
                .execute()
            )
        else:
            # Insert new
            update_data["user_id"] = current_user["id"]
            res = (
                supabase
                .table("user_preferences")
                .insert(update_data)
                .execute()
            )

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update preferences")

        return res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating preferences: {e}")
        raise HTTPException(status_code=500, detail="Error updating preferences")