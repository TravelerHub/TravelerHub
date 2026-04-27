from fastapi import APIRouter, Depends, Query
from typing import Optional
from utils import oauth2
from utils.trip_access import require_trip_member_sync
from utils.logger import get_logger
from supabase_client import supabase
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="/calendar",
    tags=["Calendar"]
)


@router.get("/events")
@limiter.limit("60/minute")
def get_calendar_events(
    request: Request,
    trip_id: Optional[str] = Query(None),
    current_user=Depends(oauth2.get_current_user),
):
    """
    Aggregate events from bookings, saved routes, and checklists
    into a unified calendar event list.
    """
    user_id = current_user["id"]
    if trip_id:
        require_trip_member_sync(trip_id, user_id)
    events = []

    # 1. Bookings → calendar events
    try:
        query = supabase.table("booking").select("*")
        if trip_id:
            query = query.eq("trip_id", trip_id)
        else:
            query = query.eq("created_by", user_id)
        bookings = query.execute()

        for b in bookings.data or []:
            events.append({
                "id": f"booking-{b['id']}",
                "type": "booking",
                "title": b.get("title") or "Booking",
                "start": b.get("start_time"),
                "end": b.get("end_time"),
                "color": "#22c55e",  # green
                "metadata": {
                    "vendor": b.get("vendor"),
                    "booking_type": b.get("type"),
                    "confirmation_code": b.get("confirmation_code"),
                    "cost": b.get("cost"),
                    "currency": b.get("currency"),
                    "status": b.get("status"),
                },
            })
    except Exception as e:
        logger.warning("Calendar: booking query error: %s", e, exc_info=True)

    # 2. Saved routes → calendar events (use created_at as event date)
    try:
        query = supabase.table("saved_routes").select("*").eq("created_by", user_id)
        if trip_id:
            query = query.eq("trip_id", trip_id)
        routes = query.execute()

        for r in routes.data or []:
            events.append({
                "id": f"route-{r['id']}",
                "type": "route",
                "title": r.get("name") or "Saved Route",
                "start": r.get("created_at"),
                "end": None,
                "color": "#3b82f6",  # blue
                "metadata": {
                    "total_distance": r.get("total_distance"),
                    "total_duration": r.get("total_duration"),
                    "waypoint_count": len(r.get("waypoints", [])),
                },
            })
    except Exception as e:
        logger.warning("Calendar: routes query error: %s", e, exc_info=True)

    # 3. Document checklists → calendar events
    try:
        checklists = (
            supabase.table("document_checklists")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        for cl in checklists.data or []:
            # Count items
            items = (
                supabase.table("checklist_items")
                .select("id, is_completed")
                .eq("checklist_id", cl["id"])
                .execute()
            )
            total = len(items.data or [])
            completed = sum(1 for i in (items.data or []) if i.get("is_completed"))

            events.append({
                "id": f"checklist-{cl['id']}",
                "type": "checklist",
                "title": cl.get("document_title") or "Checklist",
                "start": cl.get("created_at"),
                "end": None,
                "color": "#f97316",  # orange
                "metadata": {
                    "document_type": cl.get("document_type"),
                    "source_location": cl.get("source_location"),
                    "items_total": total,
                    "items_completed": completed,
                },
            })
    except Exception as e:
        logger.warning("Calendar: checklists query error: %s", e, exc_info=True)

    return events
