"""
Trip Photo Gallery — UC#6 (Centralized Trip Photo)

Group-scoped photo sharing with Supabase Storage.

Endpoints:
  GET    /trips/{trip_id}/media              — fetch all photos for a trip
  POST   /trips/{trip_id}/upload             — upload photo to trip album
  PATCH  /trips/{trip_id}/media/{media_id}   — update caption
  DELETE /trips/{trip_id}/media/{media_id}   — delete photo (owner or leader)
  GET    /trips/my-albums                    — list all trips with photo counts
"""

import secrets
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from supabase_client import supabase
from utils import oauth2

router = APIRouter(
    prefix="/trips",
    tags=["Gallery"],
)

BUCKET_NAME = "Media"


def _uid(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


def _is_trip_leader(trip_id: str, user_id: str) -> bool:
    try:
        res = (
            supabase.table("trip_members")
            .select("role")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
            .maybe_single()
            .execute()
        )
        if res.data and res.data.get("role") == "leader":
            return True
    except Exception:
        pass

    try:
        owner = (
            supabase.table("trips")
            .select("id")
            .eq("id", trip_id)
            .eq("owner_id", user_id)
            .maybe_single()
            .execute()
        )
        if owner.data:
            return True
    except Exception:
        pass

    return False


# ── GET: Fetch all photos for a trip ──────────────────────────────────────────

@router.get("/{trip_id}/media")
async def get_trip_media(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Fetches all media for a trip, ordered newest first."""
    try:
        _uid(current_user)

        response = (
            supabase.table("trip_media")
            .select("*")
            .eq("trip_id", trip_id)
            .order("created_at", desc=True)
            .execute()
        )

        return response.data or []

    except Exception as e:
        print(f"Error fetching media: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch media")


# ── POST: Upload a new photo ──────────────────────────────────────────────────

@router.post("/{trip_id}/upload")
async def upload_trip_media(
    trip_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user=Depends(oauth2.get_current_user),
):
    """Upload a photo to a trip album via Supabase Storage."""
    user_id = _uid(current_user)

    random_hex = secrets.token_hex(4)
    safe_filename = file.filename.replace(" ", "_")
    file_path = f"{trip_id}/{random_hex}_{safe_filename}"

    try:
        file_content = await file.read()
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type},
        )

        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

        db_record = {
            "trip_id": trip_id,
            "storage_path": file_path,
            "public_url": public_url,
            "uploaded_by": user_id,
            "uploaded_by_name": current_user.get("username") or current_user.get("email") or "Group Member",
            "caption": caption,
        }

        db_res = supabase.table("trip_media").insert(db_record).execute()
        saved = (db_res.data or [None])[0]
        if not saved:
            raise Exception("Database insert returned empty.")

        return saved

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading media: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload media")


# ── PATCH: Update caption ─────────────────────────────────────────────────────

class CaptionUpdate(BaseModel):
    caption: str


@router.patch("/{trip_id}/media/{media_id}")
async def update_media_caption(
    trip_id: str,
    media_id: str,
    body: CaptionUpdate,
    current_user=Depends(oauth2.get_current_user),
):
    """Update the caption on a photo. Owner or trip leader can edit."""
    user_id = _uid(current_user)

    existing = (
        supabase.table("trip_media")
        .select("id, uploaded_by")
        .eq("id", media_id)
        .eq("trip_id", trip_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    is_owner = existing.data["uploaded_by"] == user_id
    if not is_owner and not _is_trip_leader(trip_id, user_id):
        raise HTTPException(status_code=403, detail="Only the uploader or trip leader can edit")

    res = (
        supabase.table("trip_media")
        .update({"caption": body.caption})
        .eq("id", media_id)
        .execute()
    )

    return (res.data or [{}])[0]


# ── DELETE: Remove a photo ────────────────────────────────────────────────────

@router.delete("/{trip_id}/media/{media_id}")
async def delete_trip_media(
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Delete a photo. Owner or trip leader can delete."""
    user_id = _uid(current_user)

    existing = (
        supabase.table("trip_media")
        .select("id, uploaded_by, storage_path")
        .eq("id", media_id)
        .eq("trip_id", trip_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    is_owner = existing.data["uploaded_by"] == user_id
    if not is_owner and not _is_trip_leader(trip_id, user_id):
        raise HTTPException(status_code=403, detail="Only the uploader or trip leader can delete")

    # Delete from storage
    try:
        supabase.storage.from_(BUCKET_NAME).remove([existing.data["storage_path"]])
    except Exception:
        pass  # Storage cleanup failure shouldn't block DB deletion

    supabase.table("trip_media").delete().eq("id", media_id).execute()

    return {"success": True}


# ── GET: My albums (all trips with photo counts) ─────────────────────────────

@router.get("/my-albums")
async def get_my_albums(
    current_user=Depends(oauth2.get_current_user),
):
    """List all trips the user belongs to, with photo count per trip."""
    user_id = _uid(current_user)

    # Get trip IDs from memberships
    trip_ids = set()

    try:
        tm = (
            supabase.table("trip_members")
            .select("trip_id")
            .eq("user_id", user_id)
            .is_("left_at", None)
            .execute()
        )
        trip_ids.update(r["trip_id"] for r in (tm.data or []))
    except Exception:
        pass

    try:
        gm = (
            supabase.table("group_member")
            .select("group_id")
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )
        trip_ids.update(r["group_id"] for r in (gm.data or []))
    except Exception:
        pass

    try:
        owned = (
            supabase.table("trips")
            .select("id")
            .eq("owner_id", user_id)
            .execute()
        )
        trip_ids.update(r["id"] for r in (owned.data or []))
    except Exception:
        pass

    if not trip_ids:
        return {"albums": []}

    trip_list = list(trip_ids)

    # Get trip names
    trips_res = (
        supabase.table("trips")
        .select("id, name")
        .in_("id", trip_list)
        .execute()
    )
    trip_map = {t["id"]: t.get("name", "Untitled Trip") for t in (trips_res.data or [])}

    # Get photo counts and latest photo per trip
    albums = []
    for tid in trip_list:
        media_res = (
            supabase.table("trip_media")
            .select("id, public_url, created_at")
            .eq("trip_id", tid)
            .order("created_at", desc=True)
            .limit(4)
            .execute()
        )
        photos = media_res.data or []

        # Get total count
        all_res = (
            supabase.table("trip_media")
            .select("id")
            .eq("trip_id", tid)
            .execute()
        )
        total = len(all_res.data or [])

        albums.append({
            "trip_id": tid,
            "trip_name": trip_map.get(tid, "Untitled Trip"),
            "photo_count": total,
            "preview_urls": [p["public_url"] for p in photos[:4]],
            "latest_at": photos[0]["created_at"] if photos else None,
        })

    albums.sort(key=lambda a: a.get("latest_at") or "", reverse=True)

    return {"albums": albums}
