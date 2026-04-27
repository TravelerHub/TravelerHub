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
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from supabase_client import supabase, supabase_admin, safe_single, has_service_role
from utils import oauth2
from utils.logger import get_logger
from utils.trip_access import require_trip_member
from services.photo_clusterer import PhotoClusterer
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/trips",
    tags=["Gallery"],
)

BUCKET_NAME = "trip-media"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB — matches nginx client_max_body_size
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}


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
        res = safe_single(
            supabase.table("trip_members")
            .select("role")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
        )
        if res.data and res.data.get("role") == "leader":
            return True
    except Exception as e:
        logger.warning("[_is_trip_leader] trip_members query failed for trip=%s, user=%s: %s", trip_id, user_id, e, exc_info=True)

    try:
        owner = safe_single(
            supabase.table("trips")
            .select("id")
            .eq("id", trip_id)
            .eq("owner_id", user_id)
        )
        if owner.data:
            return True
    except Exception as e:
        logger.warning("[_is_trip_leader] trips owner fallback failed for trip=%s, user=%s: %s", trip_id, user_id, e, exc_info=True)

    return False


# ── GET: Fetch all photos for a trip ──────────────────────────────────────────

@router.get("/{trip_id}/media")
@limiter.limit("60/minute")
async def get_trip_media(
    request: Request,
    trip_id: str,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None),  # cursor = last photo's created_at ISO string
    current_user=Depends(oauth2.get_current_user),
):
    """Fetches media for a trip with like/save status for the current user. Supports cursor-based pagination."""
    user_id = _uid(current_user)
    await require_trip_member(trip_id, user_id)

    try:
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
        logger.error("[get_trip_media] trip=%s: %s", trip_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch media")


# ── GET: Fetch photos grouped by location / date ─────────────────────────────

@router.get("/{trip_id}/media/grouped")
@limiter.limit("60/minute")
async def get_trip_media_grouped(
    request: Request,
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
    await require_trip_member(trip_id, _uid(current_user))

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
        logger.error("[get_trip_media_grouped] trip=%s: %s", trip_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch grouped media")


# ── POST: Upload a new photo ──────────────────────────────────────────────────

@router.post("/{trip_id}/upload")
@limiter.limit("30/minute")
async def upload_trip_media(
    request: Request,
    trip_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user=Depends(oauth2.get_current_user),
):
    """Upload a photo to a trip album via Supabase Storage."""
    user_id = _uid(current_user)
    await require_trip_member(trip_id, user_id)

    # Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WEBP, GIF, HEIC.",
        )

    random_hex = secrets.token_hex(4)
    # Guard against None filename (can happen with some mobile browsers/programmatic uploads)
    raw_filename = file.filename or "photo"
    safe_filename = raw_filename.replace(" ", "_")
    file_path = f"{trip_id}/{random_hex}_{safe_filename}"

    # Hard-fail loudly when the deploy is missing the service role key — without
    # it `supabase_admin` falls back to the anon client and storage uploads
    # silently 4xx with an opaque RLS error.
    if not has_service_role:
        logger.error("[upload_trip_media] SUPABASE_SERVICE_ROLE_KEY is not set in this environment")
        raise HTTPException(
            status_code=503,
            detail="Photo uploads aren't configured on the server (missing storage credentials). Please ask an admin to set SUPABASE_SERVICE_ROLE_KEY.",
        )

    try:
        file_content = await file.read()
    except Exception as e:
        logger.error("[upload_trip_media] read failure trip=%s: %s", trip_id, e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {type(e).__name__}")

    if len(file_content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    # Step 1: storage upload — distinct error so we know if the bucket / key is
    # the problem.
    try:
        supabase_admin.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type},
        )
        public_url = supabase_admin.storage.from_(BUCKET_NAME).get_public_url(file_path)
    except Exception as e:
        logger.error("[upload_trip_media] storage upload failed trip=%s: %s", trip_id, e, exc_info=True)
        # Translate the most common Supabase-side failures into messages that
        # tell the operator what to fix, instead of bubbling raw vendor JSON
        # to the user.
        raw = str(e)
        lowered = raw.lower()
        if "jws protected header is invalid" in lowered or "jwt" in lowered and "invalid" in lowered:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Storage credentials look malformed (server-side). "
                    "Ask an admin to verify SUPABASE_SERVICE_ROLE_KEY has no "
                    "stray whitespace or surrounding quotes and is the current "
                    "key from the Supabase dashboard."
                ),
            )
        if "row-level security" in lowered or "rls" in lowered:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Storage rejected the upload because of row-level security. "
                    "Either SUPABASE_SERVICE_ROLE_KEY isn't set on the server, "
                    "or the trip-media bucket policy needs review."
                ),
            )
        # Surface enough detail for the client error toast to be useful, but
        # keep it short and free of credentials.
        msg = raw[:160] or type(e).__name__
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {msg}")

    # Step 2: DB insert — separate so we can tell storage vs metadata failures
    # apart in the logs and the client error message.
    try:
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
            raise Exception("trip_media insert returned no row")
        return saved
    except Exception as e:
        logger.error("[upload_trip_media] DB insert failed trip=%s: %s", trip_id, e, exc_info=True)
        msg = str(e)[:160] or type(e).__name__
        raise HTTPException(status_code=500, detail=f"Saved file but couldn't write metadata: {msg}")


# ── PATCH: Update caption ─────────────────────────────────────────────────────

class CaptionUpdate(BaseModel):
    caption: str


@router.patch("/{trip_id}/media/{media_id}")
@limiter.limit("30/minute")
async def update_media_caption(
    request: Request,
    trip_id: str,
    media_id: str,
    body: CaptionUpdate,
    current_user=Depends(oauth2.get_current_user),
):
    """Update the caption on a photo. Owner or trip leader can edit."""
    user_id = _uid(current_user)

    existing = safe_single(
        supabase.table("trip_media")
        .select("id, uploaded_by")
        .eq("id", media_id)
        .eq("trip_id", trip_id)
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
@limiter.limit("30/minute")
async def delete_trip_media(
    request: Request,
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Delete a photo. Owner or trip leader can delete."""
    user_id = _uid(current_user)

    existing = safe_single(
        supabase.table("trip_media")
        .select("id, uploaded_by, storage_path")
        .eq("id", media_id)
        .eq("trip_id", trip_id)
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    is_owner = existing.data["uploaded_by"] == user_id
    if not is_owner and not _is_trip_leader(trip_id, user_id):
        raise HTTPException(status_code=403, detail="Only the uploader or trip leader can delete")

    # Delete from storage
    try:
        supabase_admin.storage.from_(BUCKET_NAME).remove([existing.data["storage_path"]])
    except Exception as e:
        logger.warning("[delete_trip_media] storage cleanup failed for path=%s: %s", existing.data["storage_path"], e, exc_info=True)  # non-blocking

    supabase.table("trip_media").delete().eq("id", media_id).execute()

    return {"success": True}


# ── GET: My albums (all trips with photo counts) ─────────────────────────────

@router.get("/my-albums")
@limiter.limit("60/minute")
async def get_my_albums(
    request: Request,
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
    except Exception as e:
        logger.warning("[get_my_albums] trip_members query failed for user=%s: %s", user_id, e, exc_info=True)

    try:
        gm = (
            supabase.table("group_member")
            .select("group_id")
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )
        trip_ids.update(r["group_id"] for r in (gm.data or []))
    except Exception as e:
        logger.warning("[get_my_albums] group_member query failed for user=%s: %s", user_id, e, exc_info=True)

    try:
        owned = (
            supabase.table("trips")
            .select("id")
            .eq("owner_id", user_id)
            .execute()
        )
        trip_ids.update(r["id"] for r in (owned.data or []))
    except Exception as e:
        logger.warning("[get_my_albums] owned trips query failed for user=%s: %s", user_id, e, exc_info=True)

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
@limiter.limit("60/minute")
async def toggle_like(
    request: Request,
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Like or unlike a photo. Returns the new like state and count."""
    user_id = _uid(current_user)
    await require_trip_member(trip_id, user_id)

    existing = safe_single(
        supabase.table("media_likes")
        .select("id")
        .eq("media_id", media_id)
        .eq("user_id", user_id)
    )

    if existing.data:
        # Unlike
        supabase.table("media_likes").delete().eq("id", existing.data["id"]).execute()
        # Decrement count
        photo = safe_single(supabase.table("trip_media").select("like_count").eq("id", media_id))
        new_count = max(0, (photo.data or {}).get("like_count", 1) - 1)
        supabase.table("trip_media").update({"like_count": new_count}).eq("id", media_id).execute()
        return {"liked": False, "like_count": new_count}
    else:
        # Like
        supabase.table("media_likes").insert({
            "media_id": media_id,
            "user_id": user_id,
        }).execute()
        photo = safe_single(supabase.table("trip_media").select("like_count").eq("id", media_id))
        new_count = ((photo.data or {}).get("like_count", 0) or 0) + 1
        supabase.table("trip_media").update({"like_count": new_count}).eq("id", media_id).execute()
        return {"liked": True, "like_count": new_count}


# ── POST: Toggle save/bookmark ───────────────────────────────────────────────

@router.post("/{trip_id}/media/{media_id}/save")
@limiter.limit("60/minute")
async def toggle_save(
    request: Request,
    trip_id: str,
    media_id: str,
    current_user=Depends(oauth2.get_current_user),
):
    """Save or unsave a photo to personal collection."""
    user_id = _uid(current_user)
    await require_trip_member(trip_id, user_id)

    existing = safe_single(
        supabase.table("media_saves")
        .select("id")
        .eq("media_id", media_id)
        .eq("user_id", user_id)
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
@limiter.limit("60/minute")
async def get_saved_photos(
    request: Request,
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
