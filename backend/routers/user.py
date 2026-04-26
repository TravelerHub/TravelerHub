import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

import schemas
from utils import oauth2, hasing

from supabase_client import supabase

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


#  get current user
@router.get("/me", response_model=schemas.UserOut)
@limiter.limit("60/minute")
def read_me(request: Request, current_user=Depends(oauth2.get_current_user)):
    # NOTE: This still depends on how oauth2.get_current_user is implemented.
    # If oauth2 currently uses SQLAlchemy, you'll want to migrate that to Supabase too.
    return current_user


# ── Privacy-safe user search ────────────────────────────────────────────────
# Returns at most ONE user when the query is an EXACT match on username or
# email (case-insensitive).  Partial / fuzzy queries always return empty so
# that the full user-base is never browseable.
# Never returns password hashes; only exposes id, username, and avatar_url.
@router.get("/search")
@limiter.limit("20/minute")
async def search_users(
    request: Request,
    q: str = Query(..., min_length=1, description="Exact username or email to look up"),
    current_user=Depends(oauth2.get_current_user),
):
    """
    Exact-match user lookup.  Only returns a result when the query string
    matches a username or email exactly (case-insensitive).  Partial matches
    intentionally return an empty list so the full user base cannot be browsed.
    Soft-deleted accounts (username == '[deleted]') are always excluded.
    """
    query = q.strip()
    if not query:
        return {"users": []}

    try:
        # Try exact email match first
        email_res = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .select("id, username, avatar_url")
            .ilike("email", query)
            .neq("username", "[deleted]")
            .limit(1)
            .execute()
        )
        if email_res.data:
            return {"users": email_res.data}

        # Try exact username match
        username_res = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .select("id, username, avatar_url")
            .ilike("username", query)
            .neq("username", "[deleted]")
            .limit(1)
            .execute()
        )
        if username_res.data:
            return {"users": username_res.data}

        # No exact match — return empty (never leak partial results)
        return {"users": []}

    except Exception as e:
        print("Error searching users:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error searching users"
        )


# ── Connections (people in shared groups) ───────────────────────────────────
@router.get("/connections")
@limiter.limit("30/minute")
async def get_my_connections(
    request: Request,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Returns users who share at least one group with the current user.
    These are safe to surface because both parties already know each other
    through a shared trip — no privacy concern.
    Only returns: id, username, avatar_url.
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        # 1. Find all groups the current user belongs to
        membership_res = await asyncio.to_thread(
            lambda: supabase
            .table("group_member")
            .select("group_id")
            .eq("user_id", user_id)
            .execute()
        )
        group_ids = [r["group_id"] for r in (membership_res.data or []) if r.get("group_id")]

        if not group_ids:
            return {"users": []}

        # 2. Find all members of those groups (excluding the current user)
        peer_res = await asyncio.to_thread(
            lambda: supabase
            .table("group_member")
            .select("user_id")
            .in_("group_id", group_ids)
            .neq("user_id", user_id)
            .execute()
        )
        peer_ids = list({r["user_id"] for r in (peer_res.data or []) if r.get("user_id")})

        if not peer_ids:
            return {"users": []}

        # 3. Fetch their public profile info (no email, no password)
        profiles_res = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .select("id, username, avatar_url")
            .in_("id", peer_ids)
            .neq("username", "[deleted]")
            .execute()
        )
        return {"users": profiles_res.data or []}

    except Exception as e:
        print("Error fetching connections:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching connections"
        )


# get user by ID
@router.get("/{id}", response_model=schemas.UserOut)
@limiter.limit("60/minute")
async def get_user(request: Request, id: int):
    try:
        response = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .select("*")
            .eq("id", id)
            .single()
            .execute()
        )

        user = response.data
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {id} not found"
            )

        return user

    except Exception as e:
        # If Supabase throws an error for not found, handle it here too
        print("Error fetching user from Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {id} not found"
        )


# create a new user in supabase
@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_user(request: Request, user: schemas.UserCreate):
    # check if email already exists
    try:
        existing = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .select("id")
            .eq("email", user.email)
            .execute()
        )

        if existing.data:  # if exist, alert user to log in
            raise HTTPException(status_code=400, detail="Email already registered")

    except HTTPException:
        # Re-raise the HTTPException above
        raise
    except Exception as e:
        print("Error checking existing user in Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking existing user"
        )

    # Hash password
    hashed_password = hasing.hash_password(user.password)

    # Insert into Supabase
    try:
        insert_payload = {
            "email": user.email,
            "username": user.username,
            "password": hashed_password,
            "street": user.street,
            "city": user.city,
            "state": user.state,
            "zip_code": user.zip_code

        }

        # Insert and return the new row in one shot
        response = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .insert(insert_payload)
            .select("*")
            .single()
            .execute()
        )

        created_user = response.data
        return created_user

    except Exception as e:
        print("Error inserting user into Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )


# Update current user's profile
@router.put("/me", response_model=schemas.UserOut)
@limiter.limit("30/minute")
async def update_me(
    request: Request,
    user_update: schemas.UserUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    try:
        # Build update payload with only provided fields
        update_data = {}
        if user_update.username is not None:
            update_data["username"] = user_update.username
        if user_update.email is not None:
            update_data["email"] = user_update.email
        # if user_update.phone is not None:
        #     update_data["phone"] = user_update.phone

        if not update_data:
            return current_user  # Nothing to update

        # Update user in Supabase
        response = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .update(update_data)
            .eq("id", current_user["id"])
            .execute()
        )

        updated_user = response.data[0] if response.data else current_user
        return updated_user

    except Exception as e:
        print("Error updating user:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating profile"
        )


# Delete current user's account (soft-delete)
@router.delete("/me")
@limiter.limit("3/hour")
async def delete_my_account(
    request: Request,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Permanently soft-delete the authenticated user's account.
    Anonymises PII (email, username, name) to preserve referential integrity
    for shared trip data. Also removes all push subscriptions so the user
    stops receiving notifications.
    """
    user_id = current_user["id"]

    try:
        # Anonymise the user record — soft-delete by scrubbing PII
        anonymised_email = f"deleted_{user_id}@deleted.com"
        update_payload = {
            "email":      anonymised_email,
            "username":   "[deleted]",
            "password":   "",          # invalidate login
        }

        await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .update(update_payload)
            .eq("id", user_id)
            .execute()
        )

    except Exception as e:
        print("Error soft-deleting user:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting account"
        )

    try:
        # Remove all push subscriptions so notifications stop immediately
        await asyncio.to_thread(
            lambda: supabase
            .table("push_subscriptions")
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        # Non-fatal — log but don't fail the request
        print("Warning: could not remove push subscriptions during account deletion:", e)

    return {"message": "Account deleted successfully"}


# Change password
@router.put("/me/password")
@limiter.limit("10/minute")
async def change_password(
    request: Request,
    password_data: schemas.PasswordChange,
    current_user=Depends(oauth2.get_current_user)
):
    try:
        # Verify current password
        if not hasing.verify_password(password_data.current_password, current_user["password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Hash new password
        new_hashed = hasing.hash_password(password_data.new_password)

        # Update in Supabase
        response = await asyncio.to_thread(
            lambda: supabase
            .table("users")
            .update({"password": new_hashed})
            .eq("id", current_user["id"])
            .execute()
        )

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print("Error changing password:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error changing password"
        )
