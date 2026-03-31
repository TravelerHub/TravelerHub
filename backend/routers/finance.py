from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from supabase_client import supabase
from utils import oauth2

router = APIRouter(
    prefix="/finance",
    tags=["Finance"],
)


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
            .select("id, merchant_name, place_name, category, total, date, currency, created_at, items")
            .eq("user_id", user_id)
        )

        if trip_id:
            query = query.eq("trip_id", trip_id)

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
            .select("id")
            .eq("id", transaction_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Transaction not found")

        supabase.table("expenses").delete().eq("id", transaction_id).eq("user_id", user_id).execute()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting transaction: {e}")
        raise HTTPException(status_code=500, detail="Error deleting transaction")
