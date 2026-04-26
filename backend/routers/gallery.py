"""
Trip Photo Gallery — UC#6 (Centralized Trip Photo)

Group-scoped photo sharing with Supabase Storage.

Endpoints:
  GET    /trips/{trip_id}/media              — fetch all photos with like/save status
  POST   /trips/{trip_id}/upload             — upload photo to trip album
  PATCH  /trips/{trip_id}/media/{media_id}   — update caption
  DELETE /trips/{trip_id}/media/{media_id}   — delete photo (owner or leader)
  POST   /trips/{trip_id}/media/{media_id}/like   — toggle like
  POST   /trips/{trip_id}/media/{media_id}/save   — toggle save/bookmark
  GET    /trips/my-albums                    — list all trips with photo counts
  GET    /trips/saved-photos                 — user's saved/bookmarked photos
"""

import secrets
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from pydantic import BaseModel
from supabase_client import supabase, supabase_admin
from utils import oauth2
from services.photo_clusterer import PhotoClusterer

router = APIRouter(
    prefix="/trips",
    tags=["Gallery"],
)

BUCKET_NAME = "Media"


def _add_image_variants(photo: dict) -> dict:
    """Add optimized URL variants to a photo record."""
    base_url = photo.get("public_url", "")
    if not base_url or "supabase" not in base_url:
        photo["thumbnail_url"] = base_url
        photo["display_url"] = base_url
        return photo

    # Supabase image transform: append ?width=X&quality=Y to the URL
    # This works on /storage/v1/object/public/ URLs
    photo["thumbnail_url"] = f"{base_url}?width=300&quality=60&resize=cover"
    photo["display_url"] = f"{base_url}?width=1200&quality=80"
    # Keep original public_url unchanged for download
    return photo


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
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None),  # cursor = last photo's created_at ISO string
    current_user=Depends(oauth2.get_current_user),
):
    """Fetches media for a trip with like/save status for the current user. Supports cursor-based pagination."""
    try:
        user_id = _uid(current_user)

        query = supabase.table("trip_media").select("*").eq("trip_id", trip_id)

        if cursor:
            # Fetch photos older than the cursor
            query = query.lt("created_at", cursor)

        response = query.order("created_at", desc=True).limit(limit + 1).execute()
        photos = response.data or []

        has_more = len(photos) > limit
        if has_more:
            photos = photos[:limit]

        next_cursor = photos[-1]["created_at"] if has_more and photos else None

        if not photos:
            return {"photos": [], "next_cursor": None, "has_more": False}

        media_ids = [p["id"] for p in photos]

        # Fetch current user's likes
        likes_res = (
            supabase.table("media_likes")
            .select("media_id")
            .eq("user_id", user_id)
            .in_("media_id", media_ids)
            .execute()
        )
        liked_ids = {r["media_id"] for r in (likes_res.data or [])}

        # Fetch current user's saves
        saves_res = (
            supabase.table("media_saves")
            .select("media_id")
            .eq("user_id", user_id)
            .in_("media_id", media_ids)
            .execute()
        )
        saved_ids = {r["media_id"] for r in (saves_res.data or [])}

        for p in photos:
            p["liked_by_me"] = p["id"] in liked_ids
            p["saved_by_me"] = p["id"] in saved_ids
            _add_image_variants(p)

        return {"photos": photos, "next_cursor": next_cursor, "has_more": has_more}

    except Exception as e:
        print(f"Error fetching media: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch media")


# ── GET: Fetch photos grouped by location / date ─────────────────────────────

@router.get("/{trip_id}/media/grouped")
async def get_trip_media_grouped(
    trip_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """
    Fetch all photos for a trip and cluster them into groups.

    Uses K-means on GPS coordinates when available (>= 3 photos with lat/lng),
    otherwise falls back to date-based grouping.

    Returns:
        {"groups": [{"label": "Stop 1", "photos": [...], "cover": <first photo>}, ...]}
    """
    try:
        response = (
            supabase.table("trip_media")
            .select("*")
            .eq("trip_id", trip_id)
            .order("created_at", desc=False)
            .execute()
        )
        photos = response.data or []

        if not photos:
            return {"groups": []}

        clusterer = PhotoClusterer()
        clustered = clusterer.cluster(photos)

        # Add image variants to every photo before grouping
        for photo in clustered:
            _add_image_variants(photo)

        # Collect groups preserving label order by group_id
        groups_map: dict[int, dict] = {}
        for photo in clustered:
            gid = photo["group_id"]
            if gid not in groups_map:
                groups_map[gid] = {
                    "label": photo["group_label"],
                    "group_id": gid,
                    "photos": [],
                }
            groups_map[gid]["photos"].append(photo)

        groups = sorted(groups_map.values(), key=lambda g: g["group_id"])
        for group in groups:
            group["cover"] = group["photos"][0]
            # Sort photos within group chronologically
            group["photos"].sort(key=lambda p: p.get("created_at") or "")

        return {"groups": groups}

    except Exception as e:
        print(f"Error fetching grouped media: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch grouped media")


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
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type},
        )

        public_url = supabase_admin.storage.from_(BUCKET_NAME).get_public_url(file_path)

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
        supabase_admin.storage.from_(BUCKET_NAME).remove([existing.data["storage_path"]])
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

        preview_photos = [_add_image_variants(dict(p)) for p in photos[:4]]
        albums.append({
            "trip_id": tid,
            "trip_name": trip_map.get(tid, "Untitled Trip"),
            "photo_count": total,
            "preview_urls": [p["public_url"] for p in preview_photos],
            "preview_thumbnail_urls": [p["thumbnail_url"] for p in preview_photos],
            "latest_at": photos[0]["created_at"] if photos else None,
        })

    albums.sort(key=lambda a: a.get("latest_at") or "", reverse=True)

    return {"albums": albums}


# ── POST: Toggle like ────────────────────────────────────────────────────────

@router.post("/{trip_id}/media/{media_id}/like")
async def toggle_like(
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Like or unlike a photo. Returns the new like state and count."""
    user_id = _uid(current_user)

    existing = (
        supabase.table("media_likes")
        .select("id")
        .eq("media_id", media_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Unlike
        supabase.table("media_likes").delete().eq("id", existing.data["id"]).execute()
        # Decrement count
        photo = supabase.table("trip_media").select("like_count").eq("id", media_id).maybe_single().execute()
        new_count = max(0, (photo.data or {}).get("like_count", 1) - 1)
        supabase.table("trip_media").update({"like_count": new_count}).eq("id", media_id).execute()
        return {"liked": False, "like_count": new_count}
    else:
        # Like
        supabase.table("media_likes").insert({
            "media_id": media_id,
            "user_id": user_id,
        }).execute()
        photo = supabase.table("trip_media").select("like_count").eq("id", media_id).maybe_single().execute()
        new_count = ((photo.data or {}).get("like_count", 0) or 0) + 1
        supabase.table("trip_media").update({"like_count": new_count}).eq("id", media_id).execute()
        return {"liked": True, "like_count": new_count}


# ── POST: Toggle save/bookmark ───────────────────────────────────────────────

@router.post("/{trip_id}/media/{media_id}/save")
async def toggle_save(
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Save or unsave a photo to personal collection."""
    user_id = _uid(current_user)

    existing = (
        supabase.table("media_saves")
        .select("id")
        .eq("media_id", media_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        supabase.table("media_saves").delete().eq("id", existing.data["id"]).execute()
        return {"saved": False}
    else:
        supabase.table("media_saves").insert({
            "media_id": media_id,
            "user_id": user_id,
        }).execute()
        return {"saved": True}


# ── GET: Saved photos ────────────────────────────────────────────────────────

@router.get("/saved-photos")
async def get_saved_photos(
    current_user=Depends(oauth2.get_current_user),
):
    """Get all photos the user has saved/bookmarked across all trips."""
    user_id = _uid(current_user)

    saves_res = (
        supabase.table("media_saves")
        .select("media_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    media_ids = [r["media_id"] for r in (saves_res.data or [])]

    if not media_ids:
        return []

    photos_res = (
        supabase.table("trip_media")
        .select("*")
        .in_("id", media_ids)
        .execute()
    )

    photos = photos_res.data or []
    for p in photos:
        p["liked_by_me"] = False
        p["saved_by_me"] = True
        _add_image_variants(p)

    return photos
