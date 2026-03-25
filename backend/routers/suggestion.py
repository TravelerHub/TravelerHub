import os
from typing import List, Optional, Literal, Dict, Any

import requests
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import Trip              # <-- adjust import if needed
from database import get_db          # <-- adjust import if needed


router = APIRouter(prefix="/trips", tags=["Suggestions"])


# -------------------------
# Request / Response Models
# -------------------------

BudgetType = Literal["low", "medium", "high"]


class SuggestionsRequest(BaseModel):
    interests: List[str] = Field(default_factory=list)
    budget: BudgetType = "medium"
    radius_km: float = Field(default=10, ge=1, le=50)


class SuggestionCard(BaseModel):
    title: str
    description: str
    category: str
    rating: Optional[float] = None
    lat: float
    lng: float
    place_id: Optional[str] = None
    source: str = "google_places"


# -------------------------
# Google Places Config
# -------------------------

GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_KEY")

PRICE_MAP = {
    "low": 0,
    "medium": 2,
    "high": 4
}


def fetch_places(query: str, budget: str) -> List[Dict[str, Any]]:
    if not GOOGLE_PLACES_KEY:
        raise RuntimeError("GOOGLE_PLACES_KEY not set")

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    params = {
        "query": query,
        "key": GOOGLE_PLACES_KEY,
        "minprice": PRICE_MAP.get(budget)
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()
    return data.get("results", [])


def format_places(results: List[Dict[str, Any]]) -> List[SuggestionCard]:
    suggestions = []

    for place in results:
        location = place.get("geometry", {}).get("location", {})
        lat = location.get("lat")
        lng = location.get("lng")

        if lat is None or lng is None:
            continue

        types = place.get("types", [])
        category = types[0] if types else "activity"

        suggestions.append(
            SuggestionCard(
                title=place.get("name", "Unknown"),
                description=place.get("formatted_address")
                or place.get("vicinity")
                or "Popular local spot",
                category=category,
                rating=place.get("rating"),
                lat=float(lat),
                lng=float(lng),
                place_id=place.get("place_id")
            )
        )

    return suggestions


# -------------------------
# Endpoint
# -------------------------

@router.post("/{trip_id}/suggestions", response_model=List[SuggestionCard])
def generate_suggestions(
    trip_id: int,
    body: SuggestionsRequest,
    db: Session = Depends(get_db)
):
    # 1️ Get trip from DB
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # 2️ Build search query
    keywords = " ".join(body.interests) if body.interests else "top things to do"
    query = f"{keywords} in {trip.location}"

    try:
        # 3️ Call Google Places
        results = fetch_places(query, body.budget)

        # 4️ Format results
        suggestions = format_places(results)

        return suggestions[:6]  # limit to 6 cards

    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Places API error: {str(e)}")

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))