"""
Credit Card Optimizer — UC extension: Smart spending recommendations

Endpoints:
  GET  /cards/                          — list user's saved cards
  POST /cards/                          — add a card
  PATCH /cards/{card_id}               — update card
  DELETE /cards/{card_id}              — remove card
  GET  /cards/presets                  — list well-known card presets to clone from

  POST /cards/recommend                — given category + amount, return best card
  GET  /cards/savings/{trip_id}        — cashback earned this trip + missed savings
  GET  /cards/analysis/{trip_id}       — per-category breakdown: which card was used vs optimal

  GET  /finance/budget/{trip_id}       — list budgets for a trip
  POST /finance/budget                 — set/upsert a category budget
  DELETE /finance/budget/{budget_id}   — remove a budget target
  GET  /finance/budget/{trip_id}/status — actual vs budgeted per category
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/cards", tags=["Credit Card Optimizer"])
budget_router = APIRouter(prefix="/finance/budget", tags=["Trip Budget"])

# ── Category mapping ───────────────────────────────────────────────────────────
# Maps expense category names (as stored in the expenses table) to rate-lookup keys
CATEGORY_MAP = {
    "Dining":         "dining",
    "Accommodation":  "hotels",
    "Transportation": "travel",
    "Activities":     "entertainment",
    "Shopping":       "shopping",
    "Expense":        "other",
    "Income":         "other",
    "Other":          "other",
    # raw values from receipt scan
    "restaurant":     "dining",
    "hotel":          "hotels",
    "flight":         "flights",
    "gas_station":    "gas",
    "grocery":        "groceries",
    "supermarket":    "groceries",
    "transit":        "transit",
    "transport":      "travel",
}

def _normalize_category(cat: str) -> str:
    return CATEGORY_MAP.get(cat, CATEGORY_MAP.get(cat.lower(), "other"))

def _best_card(cards: list[dict], category_key: str) -> Optional[dict]:
    """Return the card with the highest cashback rate for this category."""
    if not cards:
        return None
    def rate(card):
        rates = card.get("category_rates") or {}
        return max(
            rates.get(category_key, 0),
            rates.get("other", 0),         # fall back to base rate
        )
    return max(cards, key=rate)


# ── Card CRUD ──────────────────────────────────────────────────────────────────

class CardCreate(BaseModel):
    card_name: str
    card_network: Optional[str] = None
    last_four: Optional[str] = None
    color: Optional[str] = "#183a37"
    category_rates: dict = {}
    is_default: bool = False

class CardUpdate(BaseModel):
    card_name: Optional[str] = None
    card_network: Optional[str] = None
    last_four: Optional[str] = None
    color: Optional[str] = None
    category_rates: Optional[dict] = None
    is_default: Optional[bool] = None


@router.get("/")
def list_cards(current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    result = (
        supabase.table("card_profiles")
        .select("*")
        .eq("user_id", user_id)
        .order("is_default", desc=True)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.get("/presets")
def list_presets():
    result = (
        supabase.table("card_presets")
        .select("*")
        .order("annual_fee")
        .execute()
    )
    return result.data or []


@router.post("/", status_code=201)
def add_card(body: CardCreate, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]

    # If this is being set as default, clear existing default first
    if body.is_default:
        supabase.table("card_profiles").update({"is_default": False}).eq("user_id", user_id).execute()

    result = supabase.table("card_profiles").insert({
        "user_id": user_id,
        "card_name": body.card_name,
        "card_network": body.card_network,
        "last_four": body.last_four,
        "color": body.color or "#183a37",
        "category_rates": body.category_rates,
        "is_default": body.is_default,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save card")
    return result.data[0]


@router.patch("/{card_id}")
def update_card(card_id: str, body: CardUpdate, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]

    existing = supabase.table("card_profiles").select("user_id").eq("id", card_id).execute()
    if not existing.data or existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Card not found")

    payload = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}

    if payload.get("is_default"):
        supabase.table("card_profiles").update({"is_default": False}).eq("user_id", user_id).execute()

    result = supabase.table("card_profiles").update(payload).eq("id", card_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update card")
    return result.data[0]


@router.delete("/{card_id}", status_code=204)
def delete_card(card_id: str, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    existing = supabase.table("card_profiles").select("user_id").eq("id", card_id).execute()
    if not existing.data or existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Card not found")
    supabase.table("card_profiles").delete().eq("id", card_id).execute()


# ── Recommendation engine ──────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    category: str           # e.g. "Dining", "Accommodation"
    amount: float
    merchant_name: Optional[str] = None


@router.post("/recommend")
def recommend_card(body: RecommendRequest, current_user=Depends(oauth2.get_current_user)):
    """Return the best card + estimated cashback for a given purchase."""
    user_id = current_user["id"]
    cards_res = supabase.table("card_profiles").select("*").eq("user_id", user_id).execute()
    cards = cards_res.data or []

    if not cards:
        return {"recommendation": None, "message": "Add your cards in the Card Wallet to get recommendations."}

    cat_key = _normalize_category(body.category)

    # Rank all cards for this category
    ranked = []
    for card in cards:
        rates = card.get("category_rates") or {}
        rate = rates.get(cat_key, rates.get("other", 1.0))
        cashback = round(body.amount * rate / 100, 2)
        ranked.append({
            "card_id": card["id"],
            "card_name": card["card_name"],
            "card_network": card.get("card_network"),
            "last_four": card.get("last_four"),
            "color": card.get("color", "#183a37"),
            "category_key": cat_key,
            "rate_pct": rate,
            "estimated_cashback": cashback,
        })

    ranked.sort(key=lambda x: x["estimated_cashback"], reverse=True)
    best = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None

    missed_savings = 0.0
    if runner_up:
        missed_savings = round(best["estimated_cashback"] - runner_up["estimated_cashback"], 2)

    return {
        "recommendation": best,
        "all_cards": ranked,
        "runner_up": runner_up,
        "category": cat_key,
        "amount": body.amount,
        "tip": f"Use {best['card_name']} for {best['rate_pct']}% back on {cat_key} (${best['estimated_cashback']} back on this purchase)",
    }


@router.get("/savings/{trip_id}")
def trip_savings(trip_id: str, current_user=Depends(oauth2.get_current_user)):
    """
    For each expense in this trip: compare the card used (if recorded) against
    the user's best available card. Returns total cashback earned and total missed.
    """
    user_id = current_user["id"]
    cards_res = supabase.table("card_profiles").select("*").eq("user_id", user_id).execute()
    cards = cards_res.data or []

    expenses_res = (
        supabase.table("expenses")
        .select("id, total, category, payment_method")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )
    expenses = expenses_res.data or []

    if not cards or not expenses:
        return {"total_cashback_earned": 0, "total_missed_savings": 0, "breakdown": []}

    total_earned = 0.0
    total_missed = 0.0
    breakdown = []

    for exp in expenses:
        cat_key = _normalize_category(exp.get("category") or "other")
        amount = abs(float(exp.get("total") or 0))
        best_card = _best_card(cards, cat_key)
        best_rate = (best_card.get("category_rates") or {}).get(cat_key,
                     (best_card.get("category_rates") or {}).get("other", 1.0)) if best_card else 1.0
        optimal_cashback = round(amount * best_rate / 100, 2)

        # Try to match payment_method to a saved card name
        used_card = None
        used_rate = 1.0  # assume 1% if unknown
        pm = (exp.get("payment_method") or "").lower()
        for card in cards:
            if card["card_name"].lower() in pm or (card.get("last_four") and card["last_four"] in pm):
                used_card = card
                used_rate = (card.get("category_rates") or {}).get(cat_key,
                              (card.get("category_rates") or {}).get("other", 1.0))
                break

        earned = round(amount * used_rate / 100, 2)
        missed = round(optimal_cashback - earned, 2)

        total_earned += earned
        total_missed += missed

        if missed > 0.01:
            breakdown.append({
                "expense_id": exp["id"],
                "category": cat_key,
                "amount": amount,
                "card_used": used_card["card_name"] if used_card else "Unknown",
                "optimal_card": best_card["card_name"] if best_card else None,
                "earned": earned,
                "optimal": optimal_cashback,
                "missed": missed,
            })

    breakdown.sort(key=lambda x: x["missed"], reverse=True)

    return {
        "total_cashback_earned": round(total_earned, 2),
        "total_missed_savings": round(total_missed, 2),
        "top_missed": breakdown[:5],
    }


# ── Budget CRUD ────────────────────────────────────────────────────────────────

class BudgetUpsert(BaseModel):
    trip_id: str
    category: str
    amount: float
    currency: str = "USD"


@budget_router.get("/{trip_id}")
def get_budgets(trip_id: str, current_user=Depends(oauth2.get_current_user)):
    result = (
        supabase.table("trip_budgets")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    return result.data or []


@budget_router.post("/", status_code=201)
def upsert_budget(body: BudgetUpsert, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    # Try update first (upsert on trip_id + category)
    existing = (
        supabase.table("trip_budgets")
        .select("id")
        .eq("trip_id", body.trip_id)
        .eq("category", body.category)
        .execute()
    )

    if existing.data:
        result = (
            supabase.table("trip_budgets")
            .update({"amount": body.amount, "currency": body.currency, "updated_at": now})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = supabase.table("trip_budgets").insert({
            "trip_id": body.trip_id,
            "category": body.category,
            "amount": body.amount,
            "currency": body.currency,
            "created_by": user_id,
        }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save budget")
    return result.data[0]


@budget_router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    existing = supabase.table("trip_budgets").select("created_by").eq("id", budget_id).execute()
    if not existing.data or existing.data[0]["created_by"] != user_id:
        raise HTTPException(status_code=404, detail="Budget not found")
    supabase.table("trip_budgets").delete().eq("id", budget_id).execute()


@budget_router.get("/{trip_id}/status")
def budget_status(trip_id: str, current_user=Depends(oauth2.get_current_user)):
    """
    Returns per-category: budgeted amount, actual spent, remaining, % used.
    Used to power the Finance page budget bars and the map budget overlay.
    """
    budgets_res = (
        supabase.table("trip_budgets")
        .select("category, amount, currency")
        .eq("trip_id", trip_id)
        .execute()
    )
    budgets = {b["category"]: b["amount"] for b in (budgets_res.data or [])}

    expenses_res = (
        supabase.table("expenses")
        .select("category, total")
        .eq("trip_id", trip_id)
        .execute()
    )

    # Aggregate actual spend per category
    actual: dict[str, float] = {}
    for exp in (expenses_res.data or []):
        cat = exp.get("category") or "Other"
        amt = abs(float(exp.get("total") or 0))
        actual[cat] = actual.get(cat, 0) + amt

    # Merge
    all_categories = set(list(budgets.keys()) + list(actual.keys()))
    result = []
    total_budgeted = 0.0
    total_spent = 0.0

    for cat in sorted(all_categories):
        budgeted = budgets.get(cat, 0)
        spent = actual.get(cat, 0)
        remaining = max(budgeted - spent, 0)
        pct = round((spent / budgeted * 100) if budgeted > 0 else 0, 1)
        status = "over" if spent > budgeted and budgeted > 0 else "warning" if pct >= 80 else "ok"
        total_budgeted += budgeted
        total_spent += spent
        result.append({
            "category": cat,
            "budgeted": round(budgeted, 2),
            "spent": round(spent, 2),
            "remaining": round(remaining, 2),
            "pct_used": pct,
            "status": status,
        })

    return {
        "categories": result,
        "total_budgeted": round(total_budgeted, 2),
        "total_spent": round(total_spent, 2),
        "total_remaining": round(max(total_budgeted - total_spent, 0), 2),
        "overall_pct": round((total_spent / total_budgeted * 100) if total_budgeted > 0 else 0, 1),
    }
