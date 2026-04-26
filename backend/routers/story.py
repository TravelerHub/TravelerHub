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

        # Human-friendly label, e.g. "Day 1"
        day_label = f"Day {day_number}"

        timeline.append({
            "date": date_key,
            "day_label": day_label,
            "photos": day_photos,
            "expenses": day_expenses,
            "total_spent": day_total,
        })

    # ── Summary stats ─────────────────────────────────────────────────────────
    total_photos = len(photos_raw)
    total_spent = round(sum(abs(float(e.get("total") or 0)) for e in expenses_raw), 2)
    total_days = len(all_dates)

    # Top 3 categories by amount spent
    top_categories = [cat for cat, _ in category_counter.most_common(3)]

    summary = {
        "total_days": total_days,
        "total_spent": total_spent,
        "total_photos": total_photos,
        "top_categories": top_categories,
    }

    return {
        "trip": {
            "id": trip.get("id"),
            "name": trip.get("name") or "Untitled Trip",
            "description": trip.get("description"),
        },
        "timeline": timeline,
        "summary": summary,
    }
