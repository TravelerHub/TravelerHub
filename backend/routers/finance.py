from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from supabase_client import supabase
from utils import oauth2

router = APIRouter(
    prefix="/finance",
    tags=["Finance"],
)


def _ensure_trip_member(trip_id: str, user_id: str) -> None:
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

    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not owner.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _is_trip_leader(trip_id: str, user_id: str) -> bool:
    member = (
        supabase.table("group_member")
        .select("id")
        .eq("group_id", trip_id)
        .eq("user_id", user_id)
        .eq("role", "leader")
        .is_("left_datetime", None)
        .maybe_single()
        .execute()
    )
    if member.data:
        return True

    owner = (
        supabase.table("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    return bool(owner.data)


class CreateTransactionPayload(BaseModel):
    description: str
    amount: float = Field(gt=0)
    category: Optional[str] = "Other"
    date: str
    type: str = "expense"
    currency: Optional[str] = "USD"
    trip_id: Optional[str] = None


def _normalize_expense_row(row: dict):
    created_at = row.get("created_at")
    date_value = row.get("date")
    if not date_value and created_at:
        date_value = str(created_at)[:10]

    raw_items = row.get("items")
    tx_type = "expense"
    if isinstance(raw_items, dict):
        tx_type = raw_items.get("transaction_type", "expense")
    elif float(row.get("total") or 0) < 0:
        tx_type = "income"

    total_value = float(row.get("total") or 0)

    return {
        "id": row.get("id"),
        "description": row.get("merchant_name") or row.get("place_name") or "Untitled expense",
        "amount": abs(total_value),
        "category": row.get("category") or "Other",
        "date": date_value,
        "type": "income" if tx_type == "income" else "expense",
        "currency": row.get("currency") or "USD",
    }


@router.get("/transactions")
def get_transactions(
    trip_id: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user),
):
    """Return normalized finance transactions for the authenticated user."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        query = (
            supabase.table("expenses")
            .select("id, user_id, trip_id, merchant_name, place_name, category, total, date, currency, created_at, items")
        )

        if trip_id:
            _ensure_trip_member(trip_id, user_id)
            query = query.eq("trip_id", trip_id)
        else:
            query = query.eq("user_id", user_id)

        result = query.order("created_at", desc=True).limit(500).execute()

        transactions = [_normalize_expense_row(row) for row in (result.data or [])]

        return {"transactions": transactions}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching finance transactions: {e}")
        raise HTTPException(status_code=500, detail="Error fetching finance transactions")


@router.post("/transactions")
def create_transaction(
    payload: CreateTransactionPayload,
    current_user=Depends(oauth2.get_current_user),
):
    """Persist a finance transaction in the expenses table."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        if payload.trip_id:
            _ensure_trip_member(payload.trip_id, user_id)

        tx_type = payload.type if payload.type in {"expense", "income"} else "expense"
        amount = abs(float(payload.amount))
        signed_total = -amount if tx_type == "income" else amount

        row = {
            "user_id": user_id,
            "merchant_name": payload.description,
            "place_name": payload.description,
            "date": payload.date,
            "total": signed_total,
            "currency": payload.currency or "USD",
            "category": payload.category or "Other",
            "payment_method": "manual",
            "trip_id": payload.trip_id,
            "items": {
                "source": "finance_manual",
                "transaction_type": tx_type,
            },
        }

        result = (
            supabase.table("expenses")
            .insert(row)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create transaction")

        return {"transaction": _normalize_expense_row(result.data[0])}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Error creating transaction")


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Delete one of the authenticated user's finance transactions."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        existing = (
            supabase.table("expenses")
            .select("id, user_id, trip_id")
            .eq("id", transaction_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Transaction not found")

        row = existing.data[0]
        owner_user_id = row.get("user_id")
        row_trip_id = row.get("trip_id")

        allowed = owner_user_id == user_id
        if (not allowed) and row_trip_id:
            _ensure_trip_member(row_trip_id, user_id)
            allowed = _is_trip_leader(row_trip_id, user_id)

        if not allowed:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this transaction")

        supabase.table("expenses").delete().eq("id", transaction_id).execute()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting transaction: {e}")
        raise HTTPException(status_code=500, detail="Error deleting transaction")
