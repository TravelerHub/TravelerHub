"""
Export router — iCal (.ics), CSV expenses, and JSON trip summary.

All endpoints require authentication.  They pull data from the same
tables the rest of the app uses (booking, expenses, trips, trip_members,
group_member) and return download-ready responses.
"""

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from icalendar import Calendar, Event as ICalEvent
from supabase_client import supabase
from utils import oauth2

router = APIRouter(prefix="/export", tags=["Export"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") or current_user.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return uid


def _ensure_trip_access(trip_id: str, user_id: str) -> Dict[str, Any]:
    """Return the trip row or raise 403/404."""
    trip_res = (
        supabase.table("trips")
        .select("*")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )
    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = trip_res.data

    # owner always has access
    if trip.get("owner_id") == user_id:
        return trip

    # check trip_members
    try:
        m = (
            supabase.table("trip_members")
            .select("id")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
            .maybe_single()
            .execute()
        )
        if m.data:
            return trip
    except Exception:
        pass

    # check group_member via group_id
    try:
        group_id = trip.get("group_id")
        if group_id:
            m = (
                supabase.table("group_member")
                .select("id")
                .eq("group_id", group_id)
                .eq("user_id", user_id)
                .is_("left_datetime", None)
                .maybe_single()
                .execute()
            )
            if m.data:
                return trip
    except Exception:
        pass

    raise HTTPException(status_code=403, detail="Not a member of this trip")


def _parse_dt(value: Any) -> datetime | None:
    """Try to parse an ISO string into a datetime.  Return None on failure."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# ---------------------------------------------------------------------------
# GET /export/trips/{trip_id}/calendar.ics
# ---------------------------------------------------------------------------

@router.get("/trips/{trip_id}/calendar.ics")
def export_calendar_ics(
    trip_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """
    Generate an iCalendar (.ics) file with all bookings for the trip.

    Each booking becomes one VEVENT.  Hotels use check-in/check-out dates,
    flights use departure/arrival times, activities use the visit date.
    """
    user_id = _user_id(current_user)
    trip = _ensure_trip_access(trip_id, user_id)
    trip_name = trip.get("name") or trip.get("title") or "Trip"

    # Fetch bookings
    bookings_res = (
        supabase.table("bookings")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    bookings = bookings_res.data or []

    cal = Calendar()
    cal.add("prodid", "-//TravelerHub//TravelerHub//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-calname", f"TravelerHub — {trip_name}")
    cal.add("x-wr-timezone", "UTC")

    for b in bookings:
        ev = ICalEvent()

        # UID must be globally unique
        ev.add("uid", f"booking-{b.get('id', uuid.uuid4())}@travelerhub.app")

        summary = b.get("title") or b.get("vendor") or "Booking"
        booking_type = (b.get("type") or "other").lower()

        # Build a readable DESCRIPTION
        desc_parts = []
        if b.get("vendor"):
            desc_parts.append(f"Vendor: {b['vendor']}")
        if b.get("confirmation_code"):
            desc_parts.append(f"Confirmation: {b['confirmation_code']}")
        cost_value = b.get("cost") if b.get("cost") is not None else b.get("price")
        if cost_value is not None:
            currency = b.get("currency") or "USD"
            desc_parts.append(f"Cost: {cost_value} {currency}")
        if b.get("notes"):
            desc_parts.append(f"Notes: {b['notes']}")
        if b.get("status"):
            desc_parts.append(f"Status: {b['status']}")
        ev.add("description", "\n".join(desc_parts) if desc_parts else "TravelerHub booking")

        # Determine DTSTART / DTEND
        dtstart = _parse_dt(b.get("start_time"))
        dtend = _parse_dt(b.get("end_time"))

        if dtstart is None:
            # Skip bookings with no usable date
            continue

        ev.add("dtstart", dtstart)
        if dtend:
            ev.add("dtend", dtend)
        else:
            ev.add("dtend", dtstart)  # point-in-time event

        # Emoji prefix by type makes the calendar easier to scan
        type_prefix = {
            "hotel": "🏨",
            "flight": "✈️",
            "car": "🚗",
            "activity": "🎯",
        }.get(booking_type, "📌")

        ev.add("summary", f"{type_prefix} {summary}")
        ev.add("categories", booking_type)

        # Timestamp the event was created
        created_at = _parse_dt(b.get("created_at")) or datetime.now(tz=timezone.utc)
        ev.add("dtstamp", created_at)

        cal.add_component(ev)

    ics_bytes = cal.to_ical()

    return Response(
        content=ics_bytes,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="trip-{trip_id[:8]}.ics"',
        },
    )


# ---------------------------------------------------------------------------
# GET /export/trips/{trip_id}/expenses.csv
# ---------------------------------------------------------------------------

@router.get("/trips/{trip_id}/expenses.csv")
def export_expenses_csv(
    trip_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """
    Generate a CSV of all expenses for the trip.

    Columns: Date, Merchant, Category, Amount, Currency, Paid By, Notes
    """
    user_id = _user_id(current_user)
    _ensure_trip_access(trip_id, user_id)

    expenses_res = (
        supabase.table("expenses")
        .select(
            "id, date, created_at, merchant_name, place_name, category, "
            "total, currency, user_id, items"
        )
        .eq("trip_id", trip_id)
        .order("date", desc=False)
        .execute()
    )
    expenses = expenses_res.data or []

    # Fetch member display names so "Paid By" is human-readable
    member_names: Dict[str, str] = {}
    member_user_ids = list({e["user_id"] for e in expenses if e.get("user_id")})
    if member_user_ids:
        try:
            profiles_res = (
                supabase.table("users")
                .select("id, full_name, email")
                .in_("id", member_user_ids)
                .execute()
            )
            for p in profiles_res.data or []:
                member_names[p["id"]] = p.get("full_name") or p.get("email") or p["id"]
        except Exception:
            pass

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")

    # Header
    writer.writerow(["Date", "Merchant", "Category", "Amount", "Currency", "Paid By", "Notes"])

    for e in expenses:
        # Date
        date_val = e.get("date") or (str(e.get("created_at") or "")[:10]) or ""

        # Merchant
        merchant = e.get("merchant_name") or e.get("place_name") or "Unknown"

        # Category
        category = e.get("category") or "Other"

        # Amount (always positive in the export)
        try:
            amount = abs(float(e.get("total") or 0))
        except (TypeError, ValueError):
            amount = 0.0
        amount_str = f"{amount:.2f}"

        # Currency
        currency = e.get("currency") or "USD"

        # Paid By
        paid_by_uid = e.get("user_id") or ""
        paid_by = member_names.get(paid_by_uid, paid_by_uid)

        # Notes — pull from the items JSON blob if present
        notes = ""
        raw_items = e.get("items")
        if isinstance(raw_items, dict):
            notes = raw_items.get("notes") or raw_items.get("description") or ""

        writer.writerow([date_val, merchant, category, amount_str, currency, paid_by, notes])

    csv_content = output.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="expenses-{trip_id[:8]}.csv"',
        },
    )


# ---------------------------------------------------------------------------
# GET /export/trips/{trip_id}/summary.json
# ---------------------------------------------------------------------------

@router.get("/trips/{trip_id}/summary.json")
def export_trip_summary(
    trip_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """
    Return a clean JSON dump of the full trip for backup / migration.

    Includes: trip info, bookings, expenses, and members.
    """
    user_id = _user_id(current_user)
    trip = _ensure_trip_access(trip_id, user_id)

    # Bookings
    bookings_res = (
        supabase.table("bookings")
        .select("*")
        .eq("trip_id", trip_id)
        .order("start_time", desc=False)
        .execute()
    )

    # Expenses
    expenses_res = (
        supabase.table("expenses")
        .select("id, date, created_at, merchant_name, place_name, category, total, currency, user_id, items")
        .eq("trip_id", trip_id)
        .order("date", desc=False)
        .execute()
    )

    # Members — try trip_members first, fall back to group_member
    members: list = []
    try:
        tm_res = (
            supabase.table("trip_members")
            .select("user_id, role, joined_at, left_at")
            .eq("trip_id", trip_id)
            .is_("left_at", None)
            .execute()
        )
        members = tm_res.data or []
    except Exception:
        pass

    if not members:
        try:
            group_id = trip.get("group_id")
            if group_id:
                gm_res = (
                    supabase.table("group_member")
                    .select("user_id, role, joined_datetime")
                    .eq("group_id", group_id)
                    .is_("left_datetime", None)
                    .execute()
                )
                members = gm_res.data or []
        except Exception:
            pass

    summary = {
        "exportedAt": datetime.now(tz=timezone.utc).isoformat(),
        "trip": trip,
        "bookings": bookings_res.data or [],
        "expenses": expenses_res.data or [],
        "members": members,
    }

    # Return as a proper JSON Response so the file downloads with a nice name
    import json

    return Response(
        content=json.dumps(summary, indent=2, default=str),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="trip-summary-{trip_id[:8]}.json"',
        },
    )
