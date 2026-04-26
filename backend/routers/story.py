"""
Story Mode — shareable post-trip timeline artifact

Endpoint:
  GET /trips/{trip_id}/story

Returns a single unified payload:
  {
    "trip": { "id", "name", "description" },
    "timeline": [
      {
        "date": "2024-03-15",
        "day_label": "Day 1",
        "photos": [...],
        "expenses": [...],
        "total_spent": 142.50
      }
    ],
    "summary": {
      "total_days": 5,
      "total_spent": 892.00,
      "total_photos": 47,
      "top_categories": ["food", "transport", "lodging"]
    }
  }
"""

import uuid
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import supabase, safe_single
from utils import oauth2

router = APIRouter(
    prefix="/trips",
    tags=["Story"],
)


def _uid(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


def _date_from(value: str | None) -> str | None:
    """Extract YYYY-MM-DD from an ISO timestamp or date string."""
    if not value:
        return None
    return str(value)[:10]


def _build_story_payload(trip_id: str) -> dict:
    """
    Shared story-building logic used by both the authenticated and public endpoints.
    Raises HTTPException on trip-not-found (404) or DB error (500).
    """
    # ── Trip metadata ─────────────────────────────────────────────────────────
    try:
        trip_res = safe_single(
            supabase.table("trips").select("id, name, description").eq("id", trip_id)
        )
    except Exception as e:
        print(f"[story] Error fetching trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = trip_res.data

    # ── Photos ────────────────────────────────────────────────────────────────
    try:
        media_res = (
            supabase.table("trip_media")
            .select("id, public_url, caption, created_at, uploaded_by_name")
            .eq("trip_id", trip_id)
            .order("created_at", desc=False)
            .execute()
        )
        photos_raw = media_res.data or []
    except Exception as e:
        print(f"[story] Error fetching photos for trip {trip_id}: {e}")
        photos_raw = []

    # ── Expenses ──────────────────────────────────────────────────────────────
    try:
        exp_res = (
            supabase.table("expenses")
            .select("id, total, category, merchant_name, place_name, date, created_at, created_by")
            .eq("trip_id", trip_id)
            .order("date", desc=False)
            .execute()
        )
        expenses_raw = exp_res.data or []
    except Exception as e:
        print(f"[story] Error fetching expenses for trip {trip_id}: {e}")
        expenses_raw = []

    # ── Group by date ─────────────────────────────────────────────────────────
    photos_by_date: dict[str, list] = defaultdict(list)
    for photo in photos_raw:
        date_key = _date_from(photo.get("created_at"))
        if date_key:
            photos_by_date[date_key].append({
                "id": photo.get("id"),
                "public_url": photo.get("public_url"),
                "caption": photo.get("caption"),
                "created_at": photo.get("created_at"),
                "uploaded_by_name": photo.get("uploaded_by_name"),
            })

    expenses_by_date: dict[str, list] = defaultdict(list)
    category_counter: Counter = Counter()
    for exp in expenses_raw:
        date_key = _date_from(exp.get("date") or exp.get("created_at"))
        if date_key:
            amount = abs(float(exp.get("total") or 0))
            category = exp.get("category") or "Other"
            category_counter[category] += amount
            expenses_by_date[date_key].append({
                "id": exp.get("id"),
                "amount": amount,
                "category": category,
                "merchant": exp.get("merchant_name") or exp.get("place_name") or "Unknown",
                "date": date_key,
                "created_by": exp.get("created_by"),
            })

    # ── Build sorted timeline ─────────────────────────────────────────────────
    all_dates = sorted(set(list(photos_by_date.keys()) + list(expenses_by_date.keys())))

    timeline = []
    for day_number, date_key in enumerate(all_dates, start=1):
        day_photos = photos_by_date.get(date_key, [])
        day_expenses = expenses_by_date.get(date_key, [])
        day_total = round(sum(e["amount"] for e in day_expenses), 2)

        timeline.append({
            "date": date_key,
            "day_label": f"Day {day_number}",
            "photos": day_photos,
            "expenses": day_expenses,
            "total_spent": day_total,
        })

    # ── Summary stats ─────────────────────────────────────────────────────────
    total_photos = len(photos_raw)
    total_spent = round(sum(abs(float(e.get("total") or 0)) for e in expenses_raw), 2)
    total_days = len(all_dates)
    top_categories = [cat for cat, _ in category_counter.most_common(3)]

    return {
        "trip": {
            "id": trip.get("id"),
            "name": trip.get("name") or "Untitled Trip",
            "description": trip.get("description"),
        },
        "timeline": timeline,
        "summary": {
            "total_days": total_days,
            "total_spent": total_spent,
            "total_photos": total_photos,
            "top_categories": top_categories,
        },
    }


@router.get("/{trip_id}/story")
async def get_trip_story(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Return a single unified story payload for the given trip.
    Fetches trip metadata, photos, and expenses, then groups them by date
    and computes summary statistics.
    """
    _uid(current_user)  # auth check — user must be authenticated
    return _build_story_payload(trip_id)


# ---------------------------------------------------------------------------
# POST /trips/{trip_id}/story/share  — auth required
# Generates (or returns existing) a public share token for this trip's story.
# ---------------------------------------------------------------------------

@router.post("/{trip_id}/story/share")
async def generate_story_share_token(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Generate a public share token for a trip story. Auth required.
    Returns the token and the full public URL.

    Idempotent: if a token already exists for this trip it is returned unchanged.

    Required SQL (run once in Supabase):
      CREATE TABLE IF NOT EXISTS story_share_tokens (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id      uuid REFERENCES trips(id) ON DELETE CASCADE,
        token        text UNIQUE NOT NULL,
        created_by   uuid REFERENCES users(id),
        created_at   timestamptz DEFAULT now()
      );
    """
    user_id = _uid(current_user)

    # Verify the trip exists
    try:
        trip_res = safe_single(
            supabase.table("trips").select("id").eq("id", trip_id)
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to verify trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Return existing token if present (idempotent)
    try:
        existing = safe_single(
            supabase.table("story_share_tokens")
            .select("token")
            .eq("trip_id", trip_id)
        )
        if existing.data:
            token = existing.data["token"]
            return {
                "token": token,
                "public_url": f"{_public_story_base_url()}/{token}",
            }
    except Exception as e:
        print(f"[story] Warning: could not look up existing share token: {e}")

    # Create a new token
    token = str(uuid.uuid4()).replace("-", "")
    try:
        supabase.table("story_share_tokens").insert({
            "trip_id": trip_id,
            "token": token,
            "created_by": user_id,
        }).execute()
    except Exception as e:
        print(f"[story] Failed to insert story_share_token: {e}")
        raise HTTPException(status_code=500, detail="Could not generate share token")

    return {
        "token": token,
        "public_url": f"{_public_story_base_url()}/{token}",
    }


# ---------------------------------------------------------------------------
# Public router — no auth prefix so it sits at /public/story/{token}
# ---------------------------------------------------------------------------

import os

public_router = APIRouter(
    prefix="/public/story",
    tags=["Story (Public)"],
)


def _public_story_base_url() -> str:
    frontend = os.getenv("FRONTEND_URL", "https://travelhub.fozhan.dev")
    return f"{frontend}/story/public"


@public_router.get("/{token}")
async def get_public_story(token: str):
    """
    No-auth endpoint. Validates the share token, resolves the trip, and
    returns the same story payload as the authenticated endpoint.
    """
    # Look up the token
    try:
        token_res = safe_single(
            supabase.table("story_share_tokens")
            .select("trip_id")
            .eq("token", token)
        )
    except Exception as e:
        print(f"[story] Error looking up share token {token}: {e}")
        raise HTTPException(status_code=500, detail="Error validating share token")

    if not token_res.data:
        raise HTTPException(status_code=404, detail="Share link not found or has been revoked")

    trip_id = token_res.data["trip_id"]
    return _build_story_payload(trip_id)
