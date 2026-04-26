from datetime import date
from typing import Optional, Any, Dict, List, Set
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from supabase_client import supabase
from utils import oauth2

router = APIRouter(prefix="/api/bookings", tags=["bookings"])
BOOKING_TABLE = "bookings"
BOOKING_ALLOWED_STATUSES = {"pending", "confirmed", "cancelled"}
BOOKING_STATUS_ALIASES = {
    "active": "confirmed",
}

# --- Pydantic models ---

class BookingCreate(BaseModel):
    trip_id: str
    title: str
    vendor: Optional[str] = None
    type: str = Field(default="other")  # hotel|flight|car|activity|other
    start_time: Optional[str] = None    # ISO string
    end_time: Optional[str] = None      # ISO string
    confirmation_code: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = "USD"
    notes: Optional[str] = None
    created_by: Optional[str] = None    # set this from auth if you have it

class BookingPatch(BaseModel):
    title: Optional[str] = None
    vendor: Optional[str] = None
    type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    confirmation_code: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None        # pending|confirmed|cancelled

class CancelBody(BaseModel):
    reason: Optional[str] = None


class PackToFinanceBody(BaseModel):
    booking_ids: Optional[List[str]] = None


# --- Helpers (membership check) ---

def ensure_trip_member(trip_id: str, user_id: str) -> None:
    try:
        member = (
            supabase.table("trip_members")
            .select("id")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
            .maybe_single()
            .execute()
        )
        if member.data:
            return
    except Exception:
        pass

    try:
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
    except Exception:
        pass

    trip = (
        supabase.table("trips")
        .select("id, group_id, owner_id")
        .eq("id", trip_id)
        .maybe_single()
        .execute()
    )
    if trip.data and str(trip.data.get("owner_id")) == str(user_id):
        return

    group_id = trip.data.get("group_id") if trip.data else None
    if group_id:
        group_member = (
            supabase.table("group_member")
            .select("id")
            .eq("group_id", group_id)
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .maybe_single()
            .execute()
        )
        if group_member.data:
            return

    raise HTTPException(status_code=403, detail="Not a member of this group")


def _get_current_user_id(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return str(user_id)


def _collect_packed_booking_ids(trip_id: str) -> Set[str]:
    packed_ids: Set[str] = set()
    existing_rollups = (
        supabase.table("expenses")
        .select("items")
        .eq("trip_id", trip_id)
        .execute()
    )
    for row in existing_rollups.data or []:
        items = row.get("items") or {}
        if not isinstance(items, dict):
            continue
        if items.get("source") != "booking_rollup":
            continue
        booking_ids = items.get("booking_ids") or []
        if isinstance(booking_ids, list):
            packed_ids.update(str(bid) for bid in booking_ids)
    return packed_ids


def _status_for_db(raw_status: Optional[str]) -> str:
    text = str(raw_status or "").strip().lower()
    mapped = BOOKING_STATUS_ALIASES.get(text, text)
    if mapped not in BOOKING_ALLOWED_STATUSES:
        allowed = ", ".join(sorted(BOOKING_ALLOWED_STATUSES))
        raise HTTPException(status_code=400, detail=f"Invalid booking status '{raw_status}'. Allowed: {allowed}")
    return mapped


def _normalize_booking_row(row: Dict[str, Any]) -> Dict[str, Any]:
    details = row.get("details") if isinstance(row.get("details"), dict) else {}
    normalized = dict(row)
    normalized["confirmation_code"] = row.get("confirmation_code") or row.get("external_ref")
    normalized["cost"] = row.get("cost") if row.get("cost") is not None else row.get("price")
    normalized["notes"] = row.get("notes") if row.get("notes") is not None else details.get("notes")
    return normalized


def _annotate_pack_state(row: Dict[str, Any], packed_ids: Set[str]) -> Dict[str, Any]:
    normalized = _normalize_booking_row(row)
    booking_id = str(normalized.get("id") or "")
    status = str(normalized.get("status") or "pending").lower()
    status = BOOKING_STATUS_ALIASES.get(status, status)
    cost_value = normalized.get("cost")

    can_pack = True
    reason = None

    if not booking_id:
        can_pack = False
        reason = "missing_id"
    elif booking_id in packed_ids:
        can_pack = False
        reason = "already_packed"
    elif status == "cancelled":
        can_pack = False
        reason = "cancelled"
    elif cost_value is None:
        can_pack = False
        reason = "missing_cost"
    else:
        try:
            if float(cost_value) <= 0:
                can_pack = False
                reason = "invalid_cost"
        except Exception:
            can_pack = False
            reason = "invalid_cost"

    normalized["packed_to_finance"] = booking_id in packed_ids
    normalized["can_pack_to_finance"] = can_pack
    normalized["pack_block_reason"] = reason
    return normalized


def _build_create_payload(body: BookingCreate, user_id: str) -> Dict[str, Any]:
    details: Dict[str, Any] = {}
    if body.notes:
        details["notes"] = body.notes

    payload = {
        "trip_id": body.trip_id,
        "created_by": user_id,
        "type": body.type,
        "title": body.title,
        "vendor": body.vendor,
        "source": "manual",
        "start_time": body.start_time,
        "end_time": body.end_time,
        "external_ref": body.confirmation_code,
        "price": body.cost,
        "currency": body.currency or "USD",
        "details": details,
        "status": _status_for_db("pending"),
    }
    return {k: v for k, v in payload.items() if v is not None}


def _build_update_payload(body: BookingPatch, current: Dict[str, Any]) -> Dict[str, Any]:
    patch_in = body.model_dump(exclude_none=True)
    patch: Dict[str, Any] = {}

    for key in ("title", "vendor", "type", "start_time", "end_time", "currency"):
        if key in patch_in:
            patch[key] = patch_in[key]

    if "status" in patch_in:
        patch["status"] = _status_for_db(patch_in["status"])

    if "confirmation_code" in patch_in:
        patch["external_ref"] = patch_in["confirmation_code"]

    if "cost" in patch_in:
        patch["price"] = patch_in["cost"]

    if "notes" in patch_in:
        details = current.get("details") if isinstance(current.get("details"), dict) else {}
        details["notes"] = patch_in["notes"]
        patch["details"] = details

    return patch


# --- Routes ---

@router.get("")
def list_bookings(
    tripId: Optional[str] = Query(None),
    trip_id: Optional[str] = Query(None),
    current_user: dict = Depends(oauth2.get_current_user)
) -> List[Dict[str, Any]]:
    target_trip_id = tripId or trip_id
    if not target_trip_id:
        raise HTTPException(status_code=400, detail="tripId or trip_id is required")

    user_id = _get_current_user_id(current_user)
    ensure_trip_member(target_trip_id, user_id)

    res = (
        supabase.table(BOOKING_TABLE)
        .select("*")
        .eq("trip_id", target_trip_id)
        .order("start_time", desc=True)
        .execute()
    )
    packed_ids = _collect_packed_booking_ids(target_trip_id)
    return [_annotate_pack_state(row, packed_ids) for row in (res.data or [])]


@router.get("/{booking_id}")
def get_booking(
    booking_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    b = supabase.table(BOOKING_TABLE).select("*").eq("id", booking_id).maybe_single().execute()
    if not b.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(b.data["trip_id"], user_id)
    packed_ids = _collect_packed_booking_ids(b.data["trip_id"])
    return _annotate_pack_state(b.data, packed_ids)


@router.post("")
def create_booking(
    body: BookingCreate,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    ensure_trip_member(body.trip_id, user_id)

    payload = _build_create_payload(body, user_id)

    res = supabase.table(BOOKING_TABLE).insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return _normalize_booking_row(res.data[0])


@router.patch("/{booking_id}")
def update_booking(
    booking_id: str,
    body: BookingPatch,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    current = (
        supabase.table(BOOKING_TABLE)
        .select("*")
        .eq("id", booking_id)
        .maybe_single()
        .execute()
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], user_id)

    patch = _build_update_payload(body, current.data)

    if not patch:
        return _normalize_booking_row(current.data)

    res = supabase.table(BOOKING_TABLE).update(patch).eq("id", booking_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return _normalize_booking_row(res.data[0])


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    body: CancelBody,
    current_user: dict = Depends(oauth2.get_current_user),
) -> Dict[str, Any]:
    del body
    return update_booking(booking_id, BookingPatch(status="cancelled"), current_user)


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    current = (
        supabase.table(BOOKING_TABLE)
        .select("id, trip_id")
        .eq("id", booking_id)
        .maybe_single()
        .execute()
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], user_id)
    supabase.table(BOOKING_TABLE).delete().eq("id", booking_id).execute()
    return {"success": True, "booking_id": booking_id}


@router.post("/trips/{trip_id}/pack-to-finance")
def pack_trip_bookings_to_finance(
    trip_id: str,
    body: Optional[PackToFinanceBody] = None,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    user_id = _get_current_user_id(current_user)
    ensure_trip_member(trip_id, user_id)

    existing_packed_ids = _collect_packed_booking_ids(trip_id)

    booking_rows = (
        supabase.table(BOOKING_TABLE)
        .select("id, title, price, currency, status")
        .eq("trip_id", trip_id)
        .execute()
    )

    selected_ids: Optional[Set[str]] = None
    if body and body.booking_ids is not None:
        selected_ids = {str(bid) for bid in body.booking_ids if str(bid).strip()}
        if not selected_ids:
            raise HTTPException(status_code=400, detail="Please select at least one booking")

    available_ids = {str(row.get("id")) for row in (booking_rows.data or []) if row.get("id") is not None}
    if selected_ids is not None:
        missing = sorted(bid for bid in selected_ids if bid not in available_ids)
        if missing:
            raise HTTPException(status_code=400, detail=f"Some selected bookings are invalid: {', '.join(missing)}")

    unpacked = []
    for row in booking_rows.data or []:
        booking_id = str(row.get("id") or "")
        if selected_ids is not None and booking_id not in selected_ids:
            continue
        if not booking_id or booking_id in existing_packed_ids:
            continue

        status = str(row.get("status") or "pending").lower()
        status = BOOKING_STATUS_ALIASES.get(status, status)
        if status == "cancelled":
            continue

        raw_cost = row.get("price")
        if raw_cost is None:
            continue

        try:
            amount = float(raw_cost)
        except (TypeError, ValueError):
            continue

        if amount <= 0:
            continue

        unpacked.append(
            {
                "id": booking_id,
                "title": row.get("title") or "Booking",
                "amount": amount,
                "currency": (row.get("currency") or "USD").upper(),
            }
        )

    if not unpacked:
        raise HTTPException(status_code=400, detail="No selectable bookings available to pack")

    currencies = {b["currency"] for b in unpacked}
    if len(currencies) > 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot pack bookings with mixed currencies. Please normalize currency first.",
        )

    currency = unpacked[0]["currency"]
    total = round(sum(b["amount"] for b in unpacked), 2)
    booking_ids = [b["id"] for b in unpacked]

    finance_row = {
        "user_id": user_id,
        "merchant_name": "Trip Booking Total",
        "place_name": f"Packed {len(unpacked)} booking(s)",
        "date": date.today().isoformat(),
        "total": total,
        "currency": currency,
        "category": "Expense",
        "payment_method": "manual",
        "trip_id": trip_id,
        "items": {
            "source": "booking_rollup",
            "transaction_type": "expense",
            "booking_ids": booking_ids,
            "bookings_count": len(unpacked),
        },
    }

    inserted = supabase.table("expenses").insert(finance_row).execute()
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to create finance transaction")

    return {
        "success": True,
        "trip_id": trip_id,
        "transaction_id": inserted.data[0].get("id"),
        "bookings_count": len(unpacked),
        "total": total,
        "currency": currency,
        "booking_ids": booking_ids,
        "selected_booking_ids": sorted(selected_ids) if selected_ids is not None else booking_ids,
    }
