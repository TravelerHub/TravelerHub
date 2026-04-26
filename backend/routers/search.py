"""
Global Search — GET /search?q={query}&trip_id={optional}

Searches across trips, expenses, and photos for the authenticated user.
Results are limited to 5 per category (15 total) and scoped to content
the user is a member of.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase_client import supabase
from utils import oauth2
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(
    prefix="/search",
    tags=["Search"],
)


def _get_user_trip_ids(user_id: str) -> list[str]:
    """Return all trip IDs the user is a member of (union of trip_members, group_member, owner)."""
    trip_ids: set[str] = set()

    try:
        res = (
            supabase.table("trip_members")
            .select("trip_id")
            .eq("user_id", user_id)
            .is_("left_at", None)
            .execute()
        )
        trip_ids.update(r["trip_id"] for r in (res.data or []) if r.get("trip_id"))
    except Exception as e:
        logger.warning("[_get_user_trip_ids] trip_members query failed for user=%s: %s", user_id, e, exc_info=True)

    try:
        res = (
            supabase.table("group_member")
            .select("group_id")
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )
        trip_ids.update(r["group_id"] for r in (res.data or []) if r.get("group_id"))
    except Exception as e:
        logger.warning("[_get_user_trip_ids] group_member query failed for user=%s: %s", user_id, e, exc_info=True)

    try:
        res = (
            supabase.table("trips")
            .select("id")
            .eq("owner_id", user_id)
            .execute()
        )
        trip_ids.update(r["id"] for r in (res.data or []) if r.get("id"))
    except Exception as e:
        logger.warning("[_get_user_trip_ids] owned trips query failed for user=%s: %s", user_id, e, exc_info=True)

    return list(trip_ids)


@router.get("")
def global_search(
    q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    trip_id: Optional[str] = Query(None, description="Optional trip ID to scope search"),
    current_user=Depends(oauth2.get_current_user),
):
    """
    Search across trips, expenses, and photos.
    Results are scoped to content the authenticated user is a member of.
    Returns up to 5 results per category (15 total).
    """
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Gather all trip IDs the user belongs to
        user_trip_ids = _get_user_trip_ids(user_id)

        # If trip_id filter is provided, intersect (and validate membership)
        if trip_id:
            if trip_id not in user_trip_ids:
                raise HTTPException(status_code=403, detail="Not a member of this trip")
            scoped_trip_ids = [trip_id]
        else:
            scoped_trip_ids = user_trip_ids

        results = []

        # ── 1. Trips ──────────────────────────────────────────────────────────
        try:
            if scoped_trip_ids:
                trips_res = (
                    supabase.table("trips")
                    .select("id, name, description")
                    .in_("id", scoped_trip_ids)
                    .or_(f"name.ilike.%{q}%,description.ilike.%{q}%")
                    .limit(5)
                    .execute()
                )
                for row in (trips_res.data or []):
                    results.append({
                        "type": "trip",
                        "id": row.get("id"),
                        "title": row.get("name") or "Untitled Trip",
                        "subtitle": row.get("description") or "",
                        "url": f"/navigation?trip={row.get('id')}",
                    })
        except Exception as e:
            logger.warning("[search] trips query error: %s", e, exc_info=True)

        # ── 2. Expenses ───────────────────────────────────────────────────────
        try:
            if scoped_trip_ids:
                expenses_res = (
                    supabase.table("expenses")
                    .select("id, merchant_name, total, category, date, trip_id, currency")
                    .in_("trip_id", scoped_trip_ids)
                    .or_(f"merchant_name.ilike.%{q}%,category.ilike.%{q}%")
                    .limit(5)
                    .execute()
                )
                for row in (expenses_res.data or []):
                    amount = abs(float(row.get("total") or 0))
                    currency = row.get("currency") or "USD"
                    merchant = row.get("merchant_name") or "Unknown"
                    category = row.get("category") or "Other"
                    date_val = row.get("date") or ""

                    # Format date as "Mar 15" style if possible
                    date_label = ""
                    if date_val:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(str(date_val)[:10])
                            date_label = dt.strftime("%b %-d") if hasattr(dt, "strftime") else date_val[:10]
                        except Exception:
                            date_label = str(date_val)[:10]

                    subtitle_parts = [category.lower()]
                    if date_label:
                        subtitle_parts.append(date_label)

                    results.append({
                        "type": "expense",
                        "id": row.get("id"),
                        "title": f"${amount:.0f} at {merchant}",
                        "subtitle": " · ".join(subtitle_parts),
                        "url": "/expenses",
                    })
        except Exception as e:
            logger.warning("[search] expenses query error: %s", e, exc_info=True)

        # ── 3. Photos ─────────────────────────────────────────────────────────
        try:
            if scoped_trip_ids:
                photos_res = (
                    supabase.table("trip_media")
                    .select("id, public_url, caption, uploaded_by_name, trip_id")
                    .in_("trip_id", scoped_trip_ids)
                    .or_(f"caption.ilike.%{q}%,uploaded_by_name.ilike.%{q}%")
                    .limit(5)
                    .execute()
                )
                for row in (photos_res.data or []):
                    caption = row.get("caption") or "Photo"
                    uploader = row.get("uploaded_by_name") or "Member"
                    results.append({
                        "type": "photo",
                        "id": row.get("id"),
                        "title": caption,
                        "subtitle": f"by {uploader}",
                        "thumbnail": row.get("public_url"),
                        "url": "/gallery",
                    })
        except Exception as e:
            logger.warning("[search] photos query error: %s", e, exc_info=True)

        return {"results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[search] unexpected error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed")
