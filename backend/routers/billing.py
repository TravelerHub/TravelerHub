import os
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from supabase_client import supabase
from utils import oauth2

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
)


class FinalizeSetupPayload(BaseModel):
    session_id: str


class ChargeCardPayload(BaseModel):
    payment_method_id: str
    amount_minor: int = Field(gt=0)
    currency: str = "usd"
    description: Optional[str] = "TravelerHub charge"


class ManualCardPayload(BaseModel):
    brand: str = "visa"
    last4: str = Field(min_length=4, max_length=4)


class EncryptedCardPayload(BaseModel):
    encrypted_payload: str
    brand: str
    last4: str = Field(min_length=4, max_length=4)


def _current_user_id(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


def _get_or_create_stripe_customer(user: dict) -> str:
    user_id = user["id"]

    existing = (
        supabase.table("finance_funding_sources")
        .select("provider_reference")
        .eq("user_id", user_id)
        .eq("provider", "stripe_customer")
        .limit(1)
        .execute()
    )

    if existing.data:
        return existing.data[0]["provider_reference"]

    customer = stripe.Customer.create(
        email=user.get("email"),
        name=user.get("username") or "TravelerHub User",
        metadata={"user_id": user_id},
    )

    supabase.table("finance_funding_sources").insert(
        {
            "user_id": user_id,
            "source_type": "external_transfer",
            "provider": "stripe_customer",
            "provider_reference": customer.id,
            "status": "active",
            "last4": None,
            "brand": "stripe_customer",
        }
    ).execute()

    return customer.id


@router.post("/create-setup-session")
def create_setup_session(current_user=Depends(oauth2.get_current_user)):
    if not stripe.api_key:
        return {
            "mode": "manual",
            "message": "Stripe is not configured. Falling back to manual test card storage.",
        }

    try:
        user_id = _current_user_id(current_user)
        customer_id = _get_or_create_stripe_customer(current_user)

        frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
        success_url = f"{frontend_base}/profile?tab=payment&checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{frontend_base}/profile?tab=payment&checkout=cancel"

        session = stripe.checkout.Session.create(
            mode="setup",
            customer=customer_id,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id},
        )

        return {"url": session.url, "session_id": session.id}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating setup session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create setup session")


@router.post("/payment-methods/manual")
def add_manual_payment_method(payload: ManualCardPayload, current_user=Depends(oauth2.get_current_user)):
    """Store a manual/test card record when Stripe is not configured yet."""
    try:
        user_id = _current_user_id(current_user)
        cleaned_last4 = "".join([c for c in payload.last4 if c.isdigit()])
        if len(cleaned_last4) != 4:
            raise HTTPException(status_code=400, detail="last4 must contain exactly 4 digits")

        provider_reference = f"manual_{user_id}_{cleaned_last4}"
        insert_res = (
            supabase.table("finance_funding_sources")
            .insert(
                {
                    "user_id": user_id,
                    "source_type": "debit_card",
                    "provider": "manual",
                    "provider_reference": provider_reference,
                    "status": "active",
                    "brand": payload.brand.lower(),
                    "last4": cleaned_last4,
                }
            )
            .execute()
        )

        saved = (insert_res.data or [None])[0]
        return {
            "success": True,
            "card": {
                "id": saved.get("id") if saved else None,
                "payment_method_id": provider_reference,
                "brand": payload.brand.lower(),
                "last4": cleaned_last4,
                "status": "active",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving manual card: {e}")
        raise HTTPException(status_code=500, detail="Failed to save manual card")


@router.post("/payment-methods/encrypted")
def add_encrypted_payment_method(payload: EncryptedCardPayload, current_user=Depends(oauth2.get_current_user)):
    """Store encrypted card payload provided by the client using a shared symmetric key."""
    try:
        user_id = _current_user_id(current_user)

        cleaned_last4 = "".join([c for c in payload.last4 if c.isdigit()])
        if len(cleaned_last4) != 4:
            raise HTTPException(status_code=400, detail="last4 must contain exactly 4 digits")

        if len(payload.encrypted_payload) < 32:
            raise HTTPException(status_code=400, detail="encrypted_payload is invalid")

        insert_res = (
            supabase.table("finance_funding_sources")
            .insert(
                {
                    "user_id": user_id,
                    "source_type": "debit_card",
                    "provider": "local_encrypted",
                    "provider_reference": payload.encrypted_payload,
                    "status": "active",
                    "brand": payload.brand.lower(),
                    "last4": cleaned_last4,
                }
            )
            .execute()
        )

        saved = (insert_res.data or [None])[0]
        return {
            "success": True,
            "card": {
                "id": saved.get("id") if saved else None,
                "provider": "local_encrypted",
                "brand": payload.brand.lower(),
                "last4": cleaned_last4,
                "status": "active",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving encrypted card: {e}")
        raise HTTPException(status_code=500, detail="Failed to save encrypted card")


@router.post("/finalize-setup")
def finalize_setup(payload: FinalizeSetupPayload, current_user=Depends(oauth2.get_current_user)):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    try:
        user_id = _current_user_id(current_user)

        session = stripe.checkout.Session.retrieve(payload.session_id)
        if not session or session.mode != "setup":
            raise HTTPException(status_code=400, detail="Invalid setup session")

        if session.status != "complete":
            raise HTTPException(status_code=400, detail="Setup session is not complete")

        setup_intent_id = session.setup_intent
        if not setup_intent_id:
            raise HTTPException(status_code=400, detail="No setup intent found")

        setup_intent = stripe.SetupIntent.retrieve(setup_intent_id)
        if setup_intent.status != "succeeded":
            raise HTTPException(status_code=400, detail="Card setup is not complete")

        payment_method_id = setup_intent.payment_method
        payment_method = stripe.PaymentMethod.retrieve(payment_method_id)

        if payment_method.type != "card":
            raise HTTPException(status_code=400, detail="Only card payment methods are supported")

        card = payment_method.card or {}
        brand = card.get("brand")
        last4 = card.get("last4")

        existing = (
            supabase.table("finance_funding_sources")
            .select("id")
            .eq("user_id", user_id)
            .eq("provider", "stripe")
            .eq("provider_reference", payment_method_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            supabase.table("finance_funding_sources").update(
                {
                    "status": "active",
                    "brand": brand,
                    "last4": last4,
                }
            ).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("finance_funding_sources").insert(
                {
                    "user_id": user_id,
                    "source_type": "debit_card",
                    "provider": "stripe",
                    "provider_reference": payment_method_id,
                    "status": "active",
                    "brand": brand,
                    "last4": last4,
                }
            ).execute()

        return {
            "success": True,
            "payment_method": {
                "id": payment_method_id,
                "brand": brand,
                "last4": last4,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error finalizing card setup: {e}")
        raise HTTPException(status_code=500, detail="Failed to finalize card setup")


@router.get("/payment-methods")
def get_payment_methods(current_user=Depends(oauth2.get_current_user)):
    try:
        user_id = _current_user_id(current_user)

        res = (
            supabase.table("finance_funding_sources")
            .select("id, provider, provider_reference, status, last4, brand, created_at")
            .eq("user_id", user_id)
            .in_("provider", ["stripe", "manual", "local_encrypted"])
            .neq("status", "removed")
            .order("created_at", desc=True)
            .execute()
        )

        cards = [
            {
                "id": row.get("id"),
                "provider": row.get("provider"),
                "payment_method_id": row.get("provider_reference"),
                "status": row.get("status"),
                "brand": row.get("brand"),
                "last4": row.get("last4"),
                "created_at": row.get("created_at"),
            }
            for row in (res.data or [])
        ]

        return {"cards": cards}

    except Exception as e:
        print(f"Error getting payment methods: {e}")
        raise HTTPException(status_code=500, detail="Failed to load payment methods")


@router.delete("/payment-methods/{funding_source_id}")
def remove_payment_method(funding_source_id: str, current_user=Depends(oauth2.get_current_user)):
    """Soft-delete a saved payment method for the authenticated user."""
    try:
        user_id = _current_user_id(current_user)

        existing = (
            supabase.table("finance_funding_sources")
            .select("id, provider, provider_reference, status")
            .eq("id", funding_source_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Payment method not found")

        row = existing.data[0]
        if row.get("status") == "removed":
            return {"success": True}

        # Best-effort Stripe detach. We still mark removed even if detach fails.
        if row.get("provider") == "stripe" and stripe.api_key:
            try:
                stripe.PaymentMethod.detach(row.get("provider_reference"))
            except Exception as stripe_err:
                print(f"Stripe detach warning: {stripe_err}")

        supabase.table("finance_funding_sources").update({"status": "removed"}).eq("id", funding_source_id).eq(
            "user_id", user_id
        ).execute()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing payment method: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove payment method")


@router.post("/charge")
def charge_saved_card(payload: ChargeCardPayload, current_user=Depends(oauth2.get_current_user)):
    if not stripe.api_key:
        raise HTTPException(status_code=400, detail="Stripe is not configured. Charging is unavailable.")

    try:
        user_id = _current_user_id(current_user)

        card_res = (
            supabase.table("finance_funding_sources")
            .select("id")
            .eq("user_id", user_id)
            .eq("provider", "stripe")
            .eq("provider_reference", payload.payment_method_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )

        if not card_res.data:
            raise HTTPException(status_code=404, detail="Saved card not found")

        customer_id = _get_or_create_stripe_customer(current_user)

        intent = stripe.PaymentIntent.create(
            amount=payload.amount_minor,
            currency=payload.currency.lower(),
            customer=customer_id,
            payment_method=payload.payment_method_id,
            off_session=True,
            confirm=True,
            description=payload.description or "TravelerHub charge",
            metadata={"user_id": user_id},
        )

        return {
            "success": intent.status in {"succeeded", "processing", "requires_capture"},
            "payment_intent_id": intent.id,
            "status": intent.status,
            "amount_minor": intent.amount,
            "currency": intent.currency,
        }

    except stripe.error.CardError as e:
        err = e.json_body.get("error", {}) if hasattr(e, "json_body") and e.json_body else {}
        raise HTTPException(status_code=402, detail=err.get("message", "Card was declined"))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error charging saved card: {e}")
        raise HTTPException(status_code=500, detail="Failed to charge saved card")
