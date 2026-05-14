from datetime import date
from typing import Optional, Any, Dict, List, Set
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from supabase_client import supabase, safe_single
from utils import oauth2
from utils.trip_access import require_trip_member_sync
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

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
    status: Optional[str] = None        # active|cancelled

class CancelBody(BaseModel):
    reason: Optional[str] = None


class PackToFinanceBody(BaseModel):
    booking_ids: Optional[List[str]] = None


# --- Helpers (membership check) ---
# Delegate to the shared guard in `utils/trip_access.py`, which handles both
# the current `trip_members` table and the legacy `group_member` fallback,
# plus the `trips.owner_id` short-circuit.
ensure_trip_member = require_trip_member_sync


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


def _annotate_pack_state(row: Dict[str, Any], packed_ids: Set[str]) -> Dict[str, Any]:
    annotated = dict(row)
    booking_id = str(annotated.get("id") or "")
    status = str(annotated.get("status") or "active").lower()
    cost_value = annotated.get("cost")

    can_pack = True
    reason: Optional[str] = None

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
        except (TypeError, ValueError):
            can_pack = False
            reason = "invalid_cost"

    annotated["packed_to_finance"] = booking_id in packed_ids
    annotated["can_pack_to_finance"] = can_pack
    annotated["pack_block_reason"] = reason
    return annotated


# --- Routes ---

@router.get("")
@limiter.limit("60/minute")
def list_bookings(
    request: Request,
    tripId: Optional[str] = Query(None),
    trip_id: Optional[str] = Query(None),
    current_user: dict = Depends(oauth2.get_current_user)
) -> List[Dict[str, Any]]:
    target_trip_id = tripId or trip_id
    if not target_trip_id:
        raise HTTPException(status_code=400, detail="tripId or trip_id is required")

    ensure_trip_member(target_trip_id, current_user["id"])

    res = (
        supabase.table("booking")
        .select("*")
        .eq("trip_id", target_trip_id)
        .order("start_time", desc=True)
        .execute()
    )
    packed_ids = _collect_packed_booking_ids(target_trip_id)
    return [_annotate_pack_state(row, packed_ids) for row in (res.data or [])]


@router.get("/{booking_id}")
@limiter.limit("60/minute")
def get_booking(
    request: Request,
    booking_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    b = safe_single(supabase.table("booking").select("*").eq("id", booking_id))
    if not b.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(b.data["trip_id"], current_user["id"])
    packed_ids = _collect_packed_booking_ids(b.data["trip_id"])
    return _annotate_pack_state(b.data, packed_ids)


@router.post("")
@limiter.limit("30/minute")
def create_booking(
    request: Request,
    body: BookingCreate,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    ensure_trip_member(body.trip_id, current_user["id"])

    payload = body.model_dump()
    payload["created_by"] = current_user["id"]
    payload.setdefault("status", "active")

    res = supabase.table("booking").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.patch("/{booking_id}")
@limiter.limit("30/minute")
def update_booking(
    request: Request,
    booking_id: str,
    body: BookingPatch,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    current = safe_single(supabase.table("booking").select("*").eq("id", booking_id))
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], current_user["id"])

    patch = {k: v for k, v in body.model_dump().items() if v is not None}

    if not patch:
        return current.data

    res = supabase.table("booking").update(patch).eq("id", booking_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed")

    return res.data[0]


@router.post("/{booking_id}/cancel")
@limiter.limit("30/minute")
def cancel_booking(
    request: Request,
    booking_id: str,
    body: CancelBody,
    current_user: dict = Depends(oauth2.get_current_user),
) -> Dict[str, Any]:
    del body
    current = safe_single(supabase.table("booking").select("*").eq("id", booking_id))
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], current_user["id"])

    res = supabase.table("booking").update({"status": "cancelled"}).eq("id", booking_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Cancel failed")
    return res.data[0]


@router.delete("/{booking_id}")
@limiter.limit("30/minute")
def delete_booking(
    request: Request,
    booking_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    current = safe_single(
        supabase.table("booking").select("id, trip_id").eq("id", booking_id)
    )
    if not current.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_trip_member(current.data["trip_id"], current_user["id"])
    supabase.table("booking").delete().eq("id", booking_id).execute()
    return {"success": True, "booking_id": booking_id}


@router.post("/trips/{trip_id}/pack-to-finance")
@limiter.limit("10/minute")
def pack_trip_bookings_to_finance(
    request: Request,
    trip_id: str,
    body: Optional[PackToFinanceBody] = None,
    current_user: dict = Depends(oauth2.get_current_user)
) -> Dict[str, Any]:
    ensure_trip_member(trip_id, current_user["id"])

    existing_packed_ids = _collect_packed_booking_ids(trip_id)

    booking_rows = (
        supabase.table("booking")
        .select("id, title, cost, currency, status")
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

        status = str(row.get("status") or "active").lower()
        if status == "cancelled":
            continue

        raw_cost = row.get("cost")
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
        "user_id": current_user["id"],
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
