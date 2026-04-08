"""
Expense Splitting & Settlement Engine — UC#11 (Shared Finances and Payment)

Endpoints:
  POST /finance/split/{expense_id}        — split an expense among group members
  GET  /finance/balances/{trip_id}         — compute who owes whom (debt graph)
  POST /finance/settle                     — record a settlement between two users
  GET  /finance/settlements/{trip_id}      — list all settlements for a trip
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase_client import supabase
from utils import oauth2

router = APIRouter(prefix="/finance", tags=["Finance — Splitting"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_trip_member_ids(trip_id: str) -> List[str]:
    """Return all active member user_ids for a trip."""
    ids = set()

    try:
        res = (
            supabase.table("trip_members")
            .select("user_id")
            .eq("trip_id", trip_id)
            .is_("left_at", None)
            .execute()
        )
        ids.update(r["user_id"] for r in (res.data or []))
    except Exception:
        pass

    try:
        res = (
            supabase.table("group_member")
            .select("user_id")
            .eq("group_id", trip_id)
            .is_("left_datetime", None)
            .execute()
        )
        ids.update(r["user_id"] for r in (res.data or []))
    except Exception:
        pass

    # Include the trip owner
    try:
        owner = (
            supabase.table("trips")
            .select("owner_id")
            .eq("id", trip_id)
            .maybe_single()
            .execute()
        )
        if owner.data:
            ids.add(owner.data["owner_id"])
    except Exception:
        pass

    return list(ids)


def _ensure_trip_member(trip_id: str, user_id: str) -> None:
    member_ids = _get_trip_member_ids(trip_id)
    if user_id not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this trip")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ShareEntry(BaseModel):
    user_id: str
    share_amount: float = Field(gt=0)

class SplitRequest(BaseModel):
    split_rule: str = "equal"              # equal | custom
    shares: Optional[List[ShareEntry]] = None  # required if split_rule == "custom"
    member_ids: Optional[List[str]] = None     # if None → split among all trip members

class SettleRequest(BaseModel):
    trip_id: str
    to_user_id: str
    amount: float = Field(gt=0)
    currency: str = "USD"
    method: str = "manual"
    note: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/split/{expense_id}")
def split_expense(
    expense_id: str,
    payload: SplitRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Split an existing expense among trip members.
    - equal: divides total evenly among member_ids (or all trip members)
    - custom: uses the provided shares list
    """
    user_id = current_user["id"]

    # Fetch the expense
    exp = (
        supabase.table("expenses")
        .select("id, total, trip_id, user_id")
        .eq("id", expense_id)
        .maybe_single()
        .execute()
    )
    if not exp.data:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense = exp.data
    trip_id = expense.get("trip_id")
    if not trip_id:
        raise HTTPException(status_code=400, detail="Expense must be linked to a trip to split")

    _ensure_trip_member(trip_id, user_id)

    total = float(expense["total"] or 0)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Cannot split a non-positive expense")

    # Delete existing shares for this expense (re-split)
    supabase.table("expense_shares").delete().eq("expense_id", expense_id).execute()

    if payload.split_rule == "custom" and payload.shares:
        # Validate custom shares sum to total
        shares_sum = sum(s.share_amount for s in payload.shares)
        if abs(shares_sum - total) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Custom shares sum ({shares_sum:.2f}) must equal expense total ({total:.2f})"
            )
        rows = [
            {
                "expense_id": expense_id,
                "user_id": s.user_id,
                "share_amount": round(s.share_amount, 2),
                "split_rule": "custom",
            }
            for s in payload.shares
        ]
    else:
        # Equal split
        member_ids = payload.member_ids or _get_trip_member_ids(trip_id)
        if not member_ids:
            raise HTTPException(status_code=400, detail="No members to split among")

        n = len(member_ids)
        base = round(total / n, 2)
        remainder = round(total - base * n, 2)

        rows = []
        for i, mid in enumerate(member_ids):
            amt = base + (0.01 if i < round(remainder * 100) else 0)
            rows.append({
                "expense_id": expense_id,
                "user_id": mid,
                "share_amount": round(amt, 2),
                "split_rule": "equal",
            })

    supabase.table("expense_shares").insert(rows).execute()

    return {
        "expense_id": expense_id,
        "split_rule": payload.split_rule,
        "shares": [{"user_id": r["user_id"], "share_amount": r["share_amount"]} for r in rows],
    }


@router.get("/balances/{trip_id}")
def get_balances(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Compute the net balances for a trip: who owes whom.

    Algorithm:
    1. For each expense with shares, the payer is owed (total - their_share).
       Each other member owes their share_amount to the payer.
    2. Subtract settlements already recorded.
    3. Minimize transactions using the greedy debt simplification algorithm.
    """
    user_id = current_user["id"]
    _ensure_trip_member(trip_id, user_id)

    member_ids = _get_trip_member_ids(trip_id)

    # Fetch usernames for display
    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", member_ids)
        .execute()
    )
    user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    # Get all expenses for this trip that have shares
    expenses_res = (
        supabase.table("expenses")
        .select("id, user_id, total")
        .eq("trip_id", trip_id)
        .execute()
    )
    expenses = expenses_res.data or []
    expense_ids = [e["id"] for e in expenses]

    # Get all shares
    shares = []
    if expense_ids:
        shares_res = (
            supabase.table("expense_shares")
            .select("expense_id, user_id, share_amount")
            .in_("expense_id", expense_ids)
            .execute()
        )
        shares = shares_res.data or []

    # Build a net balance per user: positive = owed money, negative = owes money
    # net[user] > 0 means others owe them; net[user] < 0 means they owe others
    net = {mid: 0.0 for mid in member_ids}

    # Group shares by expense
    expense_shares_map = {}
    for s in shares:
        expense_shares_map.setdefault(s["expense_id"], []).append(s)

    for exp in expenses:
        exp_shares = expense_shares_map.get(exp["id"], [])
        if not exp_shares:
            continue  # Expense not split yet

        payer_id = exp["user_id"]
        total_paid = float(exp["total"] or 0)

        # Payer fronted the full amount
        if payer_id in net:
            net[payer_id] += total_paid

        # Each member's share is what they owe
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
            net[s["from_user_id"]] += amt   # they paid, so they're owed less
        if s["to_user_id"] in net:
            net[s["to_user_id"]] -= amt     # they received, so they owe less

    # Greedy debt simplification: minimize number of transfers
    creditors = []  # (user_id, amount owed to them)
    debtors = []    # (user_id, amount they owe)

    for uid, balance in net.items():
        if balance > 0.005:
            creditors.append([uid, round(balance, 2)])
        elif balance < -0.005:
            debtors.append([uid, round(-balance, 2)])

    # Sort both descending by amount for greedy matching
    creditors.sort(key=lambda x: -x[1])
    debtors.sort(key=lambda x: -x[1])

    transfers = []
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

    # Per-member summary
    member_balances = []
    for mid in member_ids:
        bal = round(net.get(mid, 0), 2)
        member_balances.append({
            "user_id": mid,
            "username": user_map.get(mid, "Unknown"),
            "net_balance": bal,
            "status": "settled" if abs(bal) < 0.01 else ("owed" if bal > 0 else "owes"),
        })

    return {
        "trip_id": trip_id,
        "member_balances": member_balances,
        "suggested_transfers": transfers,
        "all_settled": len(transfers) == 0,
    }


@router.post("/settle")
def record_settlement(
    payload: SettleRequest,
    current_user=Depends(oauth2.get_current_user),
):
    """Record a settlement payment from the current user to another."""
    user_id = current_user["id"]
    _ensure_trip_member(payload.trip_id, user_id)

    if payload.to_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot settle with yourself")

    _ensure_trip_member(payload.trip_id, payload.to_user_id)

    row = {
        "trip_id": payload.trip_id,
        "from_user_id": user_id,
        "to_user_id": payload.to_user_id,
        "amount": round(payload.amount, 2),
        "currency": payload.currency,
        "method": payload.method,
        "note": payload.note,
    }

    res = supabase.table("settlements").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to record settlement")

    return {"settlement": res.data[0]}


@router.get("/settlements/{trip_id}")
def list_settlements(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """List all settlements for a trip."""
    _ensure_trip_member(trip_id, current_user["id"])

    member_ids = _get_trip_member_ids(trip_id)
    users_res = (
        supabase.table("users")
        .select("id, username")
        .in_("id", member_ids)
        .execute()
    )
    user_map = {u["id"]: u["username"] for u in (users_res.data or [])}

    res = (
        supabase.table("settlements")
        .select("*")
        .eq("trip_id", trip_id)
        .order("settled_at", desc=True)
        .execute()
    )

    settlements = []
    for s in (res.data or []):
        settlements.append({
            **s,
            "from_username": user_map.get(s["from_user_id"], "Unknown"),
            "to_username": user_map.get(s["to_user_id"], "Unknown"),
        })

    return {"settlements": settlements}
