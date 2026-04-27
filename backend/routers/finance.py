import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from supabase_client import supabase, async_safe_single
from utils import oauth2
from utils.logger import get_logger
from utils.trip_access import require_trip_member, is_trip_leader
from services.anomaly_detection import ExpenseAnomalyDetector
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/finance",
    tags=["Finance"],
)


# Local aliases preserve the original call sites without forcing a router-wide
# rename. They delegate to the shared helpers in `utils/trip_access.py`.
_ensure_trip_member = require_trip_member
_is_trip_leader = is_trip_leader


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
@limiter.limit("60/minute")
async def get_transactions(
    request: Request,
    trip_id: Optional[str] = None,
    current_user=Depends(oauth2.get_current_user),
):
    """Return normalized finance transactions for the authenticated user."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        if trip_id:
            await _ensure_trip_member(trip_id, user_id)
            result = await asyncio.to_thread(
                lambda: supabase.table("expenses")
                .select("id, user_id, trip_id, merchant_name, place_name, category, total, date, currency, created_at, items")
                .eq("trip_id", trip_id)
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )
        else:
            result = await asyncio.to_thread(
                lambda: supabase.table("expenses")
                .select("id, user_id, trip_id, merchant_name, place_name, category, total, date, currency, created_at, items")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(500)
                .execute()
            )

        transactions = [_normalize_expense_row(row) for row in (result.data or [])]

        return {"transactions": transactions}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[get_transactions] %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching finance transactions")


@router.post("/transactions")
@limiter.limit("30/minute")
async def create_transaction(
    request: Request,
    payload: CreateTransactionPayload,
    current_user=Depends(oauth2.get_current_user),
):
    """Persist a finance transaction in the expenses table."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        if payload.trip_id:
            await _ensure_trip_member(payload.trip_id, user_id)

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

        result = await asyncio.to_thread(
            lambda: supabase.table("expenses").insert(row).execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create transaction")

        return {"transaction": _normalize_expense_row(result.data[0])}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[create_transaction] %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error creating transaction")


@router.get("/trips/{trip_id}/expenses/anomalies")
@limiter.limit("10/minute")
async def get_expense_anomalies(
    request: Request,
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Detect anomalous expenses for a trip using Isolation Forest (z-score fallback
    for categories with fewer than 5 samples).
    Returns only flagged expenses (is_anomaly=True).
    """
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        await _ensure_trip_member(trip_id, user_id)

        result = await asyncio.to_thread(
            lambda: supabase.table("expenses")
            .select("id, merchant_name, place_name, category, total, date, currency, created_at")
            .eq("trip_id", trip_id)
            .execute()
        )

        rows = result.data or []

        # Build expense dicts for the detector
        expenses = []
        for row in rows:
            total_value = float(row.get("total") or 0)
            expenses.append({
                "id": row.get("id"),
                "amount": abs(total_value),
                "category": row.get("category") or "Other",
                "merchant": row.get("merchant_name") or row.get("place_name") or "Unknown",
                "date": row.get("date") or (str(row.get("created_at") or "")[:10] or None),
            })

        detector = ExpenseAnomalyDetector()
        analyzed = detector.detect(expenses)

        flagged = [
            {
                "id": e["id"],
                "amount": e["amount"],
                "category": e["category"],
                "merchant": e["merchant"],
                "date": e["date"],
                "anomaly_score": e["anomaly_score"],
            }
            for e in analyzed
            if e.get("is_anomaly")
        ]

        return {"anomalies": flagged, "total_expenses_checked": len(expenses)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[get_expense_anomalies] %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error detecting expense anomalies")


@router.delete("/transactions/{transaction_id}")
@limiter.limit("30/minute")
async def delete_transaction(
    request: Request,
    transaction_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Delete one of the authenticated user's finance transactions."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        existing = await asyncio.to_thread(
            lambda: supabase.table("expenses")
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
            await _ensure_trip_member(row_trip_id, user_id)
            allowed = await _is_trip_leader(row_trip_id, user_id)

        if not allowed:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this transaction")

        await asyncio.to_thread(
            lambda: supabase.table("expenses").delete().eq("id", transaction_id).execute()
        )
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[delete_transaction] %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error deleting transaction")
