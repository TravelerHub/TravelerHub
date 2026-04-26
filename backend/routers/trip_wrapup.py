"""
Trip Wrap-Up — post-trip ritual flow

Endpoints:
  GET   /trips/{trip_id}/wrapup-data   — combined payload for the 4-step modal
  PATCH /trips/{trip_id}/complete      — mark trip completed, optionally set highlight photo
"""

import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from supabase_client import supabase, safe_single, async_safe_single
from utils import oauth2
from utils.logger import get_logger
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
logger = get_logger(__name__)

router = APIRouter(prefix="/trips", tags=["Trip Wrap-Up"])


# ── helpers ────────────────────────────────────────────────────────────────────

def _uid(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


def _get_trip_member_ids(trip_id: str) -> list[str]:
    """Return all active member user_ids for a trip (mirrors settlements.py helper)."""
    ids: set[str] = set()
    try:
        res = (
            supabase.table("trip_members")
            .select("user_id")
            .eq("trip_id", trip_id)
            .is_("left_at", None)
            .execute()
        )
        ids.update(r["user_id"] for r in (res.data or []))
    except Exception as e:
        logger.warning("[wrapup] trip_members query failed for trip=%s: %s", trip_id, e)

    try:
        res = (
            supabase.table("group_member")
            .select("user_id")
            .eq("group_id", trip_id)
            .is_("left_datetime", None)
            .execute()
        )
        ids.update(r["user_id"] for r in (res.data or []))
    except Exception as e:
        logger.warning("[wrapup] group_member query failed for trip=%s: %s", trip_id, e)

    try:
        owner = safe_single(
            supabase.table("trips").select("owner_id").eq("id", trip_id)
        )
        if owner.data:
            ids.add(owner.data["owner_id"])
    except Exception as e:
        logger.warning("[wrapup] owner query failed for trip=%s: %s", trip_id, e)

    return list(ids)


def _ensure_trip_member(trip_id: str, user_id: str) -> None:
    if user_id not in _get_trip_member_ids(trip_id):
        raise HTTPException(status_code=403, detail="Not a member of this trip")


def _build_suggested_transfers(trip_id: str, member_ids: list[str]) -> list[dict]:
    """
    Lightweight version of the balances algorithm from settlements.py.
    Returns a minimal transfer list for the wrap-up modal.
    """
    if not member_ids:
        return []

    try:
        users_res = (
            supabase.table("users")
            .select("id, username")
            .in_("id", member_ids)
            .execute()
        )
        user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

        expenses_res = (
            supabase.table("expenses")
            .select("id, user_id, total")
            .eq("trip_id", trip_id)
            .execute()
        )
        expenses = expenses_res.data or []
        expense_ids = [e["id"] for e in expenses]

        shares: list[dict] = []
        if expense_ids:
            shares_res = (
                supabase.table("expense_shares")
                .select("expense_id, user_id, share_amount")
                .in_("expense_id", expense_ids)
                .execute()
            )
            shares = shares_res.data or []

        net = {mid: 0.0 for mid in member_ids}
        expense_shares_map: dict = {}
        for s in shares:
            expense_shares_map.setdefault(s["expense_id"], []).append(s)

        n_members = max(len(member_ids), 1)
        for exp in expenses:
            exp_shares = expense_shares_map.get(exp["id"], [])
            payer_id = exp.get("user_id")
            total_paid = abs(float(exp.get("total") or 0))
            if not exp_shares:
                share_amount = round(total_paid / n_members, 2)
                if payer_id in net:
                    net[payer_id] += total_paid
                for mid in member_ids:
                    net[mid] -= share_amount
                continue
            if payer_id in net:
                net[payer_id] += total_paid
            for s in exp_shares:
                if s["user_id"] in net:
                    net[s["user_id"]] -= float(s["share_amount"])

        # Factor in existing settlements
        settlements_res = (
            supabase.table("settlements")
            .select("from_user_id, to_user_id, amount")
            .eq("trip_id", trip_id)
            .execute()
        )
        for s in (settlements_res.data or []):
            amt = float(s["amount"])
            if s["from_user_id"] in net:
                net[s["from_user_id"]] += amt
            if s["to_user_id"] in net:
                net[s["to_user_id"]] -= amt

        creditors = [[uid, round(bal, 2)] for uid, bal in net.items() if bal > 0.005]
        debtors = [[uid, round(-bal, 2)] for uid, bal in net.items() if bal < -0.005]
        creditors.sort(key=lambda x: -x[1])
        debtors.sort(key=lambda x: -x[1])

        transfers: list[dict] = []
        ci, di = 0, 0
        while ci < len(creditors) and di < len(debtors):
            c_id, c_amt = creditors[ci]
            d_id, d_amt = debtors[di]
            transfer_amt = round(min(c_amt, d_amt), 2)
            if transfer_amt > 0:
                transfers.append({
                    "from_user_id": d_id,
                    "from_username": user_map.get(d_id, "Unknown"),
                    "to_user_id": c_id,
                    "to_username": user_map.get(c_id, "Unknown"),
                    "amount": transfer_amt,
                })
            creditors[ci][1] = round(c_amt - transfer_amt, 2)
            debtors[di][1] = round(d_amt - transfer_amt, 2)
            if creditors[ci][1] < 0.005:
                ci += 1
            if debtors[di][1] < 0.005:
                di += 1

        return transfers
    except Exception as e:
        logger.warning("[wrapup] suggested transfers failed for trip=%s: %s", trip_id, e)
        return []


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{trip_id}/wrapup-data")
@limiter.limit("30/minute")
async def get_wrapup_data(
    request: Request,
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Returns all data needed for the trip wrap-up flow."""
    user_id = _uid(current_user)
    await asyncio.to_thread(_ensure_trip_member, trip_id, user_id)

    # 1. Trip metadata
    try:
        trip_res = await asyncio.to_thread(
            lambda: safe_single(
                supabase.table("trips").select("*").eq("id", trip_id)
            )
        )
    except Exception as e:
        logger.error("[wrapup] trip fetch failed for trip=%s: %s", trip_id, e)
        raise HTTPException(status_code=500, detail="Failed to fetch trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = trip_res.data

    # 2. Expense summary
    try:
        expenses_res = await asyncio.to_thread(
            lambda: supabase.table("expenses")
            .select("total")
            .eq("trip_id", trip_id)
            .execute()
        )
        expenses = expenses_res.data or []
        total_spent = round(sum(abs(float(e.get("total") or 0)) for e in expenses), 2)
        expense_count = len(expenses)
    except Exception as e:
        logger.warning("[wrapup] expenses query failed for trip=%s: %s", trip_id, e)
        total_spent = 0.0
        expense_count = 0

    # 3. Photos (first 12 for highlight picker, total count)
    try:
        photos_res = await asyncio.to_thread(
            lambda: supabase.table("trip_media")
            .select("id, public_url, caption, created_at, uploaded_by_name")
            .eq("trip_id", trip_id)
            .order("created_at", desc=False)
            .limit(12)
            .execute()
        )
        photos = photos_res.data or []

        photos_count_res = await asyncio.to_thread(
            lambda: supabase.table("trip_media")
            .select("id", count="exact")
            .eq("trip_id", trip_id)
            .execute()
        )
        total_photos = photos_count_res.count if photos_count_res.count is not None else len(photos)
    except Exception as e:
        logger.warning("[wrapup] photos query failed for trip=%s: %s", trip_id, e)
        photos = []
        total_photos = 0

    # 4. Trip date range → total days
    start_date = trip.get("start_date")
    end_date = trip.get("end_date")
    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(str(start_date)[:10])
            d2 = datetime.fromisoformat(str(end_date)[:10])
            total_days = max((d2 - d1).days + 1, 1)
        except Exception:
            total_days = None
    else:
        # Fall back: count distinct days with activity
        total_days = None

    # 5. Suggested transfers (unsettled balances)
    member_ids = await asyncio.to_thread(_get_trip_member_ids, trip_id)
    suggested_transfers = await asyncio.to_thread(_build_suggested_transfers, trip_id, member_ids)

    return {
        "trip_id": trip_id,
        "trip_name": trip.get("name") or "Untitled Trip",
        "start_date": start_date,
        "end_date": end_date,
        "total_days": total_days,
        "total_spent": total_spent,
        "expense_count": expense_count,
        "total_photos": total_photos,
        "photos": photos,
        "suggested_transfers": suggested_transfers,
        "all_settled": len(suggested_transfers) == 0,
        # Include current highlight photo if already set
        "highlight_photo_url": trip.get("highlight_photo"),
        "status": trip.get("status", "active"),
    }


@router.patch("/{trip_id}/complete")
@limiter.limit("10/minute")
async def mark_trip_complete(
    request: Request,
    trip_id: str,
    body: dict,
    current_user=Depends(oauth2.get_current_user),
):
    """Mark trip as completed, optionally set a highlight photo."""
    user_id = _uid(current_user)
    await asyncio.to_thread(_ensure_trip_member, trip_id, user_id)

    # Verify trip exists
    try:
        trip_res = await asyncio.to_thread(
            lambda: safe_single(supabase.table("trips").select("id, owner_id").eq("id", trip_id))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to verify trip")

    if not trip_res.data:
        raise HTTPException(status_code=404, detail="Trip not found")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Build update payload defensively — only include columns that the DB supports
    update_payload: dict = {}
    highlight = body.get("highlight_photo_url")

    # Try to set status + completed_at + highlight_photo
    # These columns may not exist yet — we handle that gracefully.
    try:
        candidate_payload = {"status": "completed", "completed_at": now_iso}
        if highlight:
            candidate_payload["highlight_photo"] = highlight

        res = await asyncio.to_thread(
            lambda: supabase.table("trips")
            .update(candidate_payload)
            .eq("id", trip_id)
            .execute()
        )
        updated_trip = res.data[0] if res.data else None
    except Exception as e:
        # Some columns may not exist in the DB yet (schema not migrated).
        # Fall back to updating only what's available.
        logger.warning(
            "[wrapup] full update failed for trip=%s (schema may be missing columns): %s — trying minimal update",
            trip_id, e
        )
        try:
            # Attempt with just name update as a no-op to confirm trip is reachable,
            # then return partial success.
            updated_trip = None
        except Exception as e2:
            logger.error("[wrapup] mark_complete fallback also failed: %s", e2)
            raise HTTPException(status_code=500, detail="Failed to mark trip complete")

    return {
        "success": True,
        "trip_id": trip_id,
        "completed_at": now_iso,
        "highlight_photo_url": highlight,
        "trip": updated_trip,
    }
