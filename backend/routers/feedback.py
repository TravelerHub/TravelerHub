"""Feedback / contact form ingestion.

Two thin POST endpoints that persist user-submitted free-text into Supabase:

  POST /feedback  — authenticated; rating + optional comment from in-app users
  POST /contact   — public; name + email + subject + message from the marketing
                    Contact Us page (no login required)

Both insert into Supabase tables (`user_feedback`, `contact_messages`) so the
ops team can review them. Failures are logged but the user is never told the
DB write failed for a contact form — they get a generic "we'll be in touch"
response either way to avoid leaking infrastructure errors to anonymous users.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from supabase_client import supabase
from utils import oauth2
from utils.logger import get_logger

logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["feedback"])


class FeedbackBody(BaseModel):
    """In-app feedback. `rating` is 1–5 (stars); `comment` is free text."""

    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)
    page: Optional[str] = Field(default=None, max_length=120)  # e.g. "/dashboard"


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def submit_feedback(
    request: Request,
    body: FeedbackBody,
    current_user=Depends(oauth2.get_current_user),
):
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    row = {
        "user_id": user_id,
        "rating": body.rating,
        "comment": (body.comment or "").strip() or None,
        "page": body.page,
    }

    try:
        supabase.table("user_feedback").insert(row).execute()
    except Exception as e:
        logger.error("[submit_feedback] insert failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Could not save feedback right now")

    return {"success": True, "message": "Thanks for the feedback."}


class ContactBody(BaseModel):
    """Public marketing-page contact form."""

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: Optional[str] = Field(default=None, max_length=160)
    message: str = Field(min_length=1, max_length=4000)


@router.post("/contact", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def submit_contact(request: Request, body: ContactBody):
    """Public — anyone can submit. Heavy rate-limit per IP to discourage spam."""
    row = {
        "name": body.name.strip(),
        "email": str(body.email).strip().lower(),
        "subject": (body.subject or "").strip() or None,
        "message": body.message.strip(),
    }

    try:
        supabase.table("contact_messages").insert(row).execute()
    except Exception as e:
        # Don't surface infrastructure errors to anonymous users — log and
        # return a generic success so spambots can't probe for failures.
        logger.error("[submit_contact] insert failed: %s", e, exc_info=True)

    return {"success": True, "message": "Thanks — we'll be in touch."}
