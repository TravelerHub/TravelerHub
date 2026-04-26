from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends, UploadFile, File
from typing import Dict, Set, Optional
import asyncio
from datetime import datetime, timedelta, timezone
import secrets
import re
from supabase_client import supabase, supabase_admin
import schemas
from utils import oauth2

# conversation_id -> set of connected websockets
rooms: Dict[str, Set[WebSocket]] = {}
rooms_lock = asyncio.Lock()


async def broadcast_to_conversation(conversation_id: str, message: dict, exclude: Optional[WebSocket] = None):
    async with rooms_lock:
        sockets = list(rooms.get(conversation_id, set()))

    dead = []
    for ws in sockets:
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)

    if dead:
        async with rooms_lock:
            for ws in dead:
                rooms.get(conversation_id, set()).discard(ws)
            if conversation_id in rooms and not rooms[conversation_id]:
                rooms.pop(conversation_id, None)


router = APIRouter(prefix="/api", tags=["chat"])

CHAT_MEDIA_BUCKET = "Media"
MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024
MAX_CHAT_VOICEMAIL_BYTES = 15 * 1024 * 1024
MAX_CHAT_VIDEO_BYTES = 40 * 1024 * 1024
MESSAGE_EDIT_WINDOW_MINUTES = 15
MESSAGE_DELETE_WINDOW_HOURS = 24
ALLOWED_CHAT_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
ALLOWED_CHAT_AUDIO_TYPES = {
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/x-m4a",
    "audio/aac",
    "audio/3gpp",
    "audio/3gpp2",
}
ALLOWED_CHAT_AUDIO_EXTENSIONS = {
    "webm",
    "mp4",
    "ogg",
    "mp3",
    "m4a",
    "aac",
    "wav",
    "3gp",
    "3g2",
}
ALLOWED_CHAT_VIDEO_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
    "video/x-matroska",
    "video/3gpp",
    "video/3gpp2",
}
ALLOWED_CHAT_VIDEO_EXTENSIONS = {
    "mp4",
    "webm",
    "mov",
    "m4v",
    "ogg",
    "ogv",
    "mkv",
    "3gp",
    "3g2",
}


def get_conversation_trip_id(conversation_id: str) -> Optional[str]:
    try:
        res = (
            supabase
            .from_("conversation")
            .select("trip_id")
            .eq("conversation_id", conversation_id)
            .maybe_single()
            .execute()
        )
        if res.data:
            return res.data.get("trip_id")
    except Exception:
        pass
    return None


def resolve_public_url(raw_public_url) -> Optional[str]:
    if isinstance(raw_public_url, dict):
        return raw_public_url.get("publicURL") or raw_public_url.get("publicUrl")
    return raw_public_url


def normalize_content_type(content_type: Optional[str]) -> str:
    if not content_type:
        return ""
    return content_type.split(";", 1)[0].strip().lower()


def get_file_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def is_allowed_audio_upload(content_type: str, filename: str) -> bool:
    base_type = normalize_content_type(content_type)
    if base_type in ALLOWED_CHAT_AUDIO_TYPES:
        return True

    # Safari can report audio-only MediaRecorder blobs as video/mp4.
    if base_type == "video/mp4":
        return True

    ext = get_file_extension(filename)
    if ext in ALLOWED_CHAT_AUDIO_EXTENSIONS:
        return True

    return False


def is_allowed_video_upload(content_type: str, filename: str) -> bool:
    base_type = normalize_content_type(content_type)
    if base_type in ALLOWED_CHAT_VIDEO_TYPES:
        return True

    ext = get_file_extension(filename)
    if ext in ALLOWED_CHAT_VIDEO_EXTENSIONS:
        return True

    return False


def resolve_video_upload_content_type(content_type: str, filename: str) -> str:
    base_type = normalize_content_type(content_type)
    if base_type in ALLOWED_CHAT_VIDEO_TYPES:
        return base_type

    ext = get_file_extension(filename)
    ext_to_type = {
        "mp4": "video/mp4",
        "m4v": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "ogg": "video/ogg",
        "ogv": "video/ogg",
        "mkv": "video/x-matroska",
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
    }
    return ext_to_type.get(ext, "video/mp4")


def parse_sent_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except Exception:
            return None
    else:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def ensure_conversation_member(conversation_id: str, user_id: str):
    membership = (
        supabase
        .from_("group_member")
        .select("conversation_id")
        .eq("conversation_id", conversation_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")


def ensure_trip_member(trip_id: str, user_id: str):
    try:
        membership = (
            supabase
            .from_("trip_members")
            .select("id")
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_at", None)
            .maybe_single()
            .execute()
        )
        if membership.data:
            return
    except Exception:
        pass

    try:
        membership = (
            supabase
            .from_("group_member")
            .select("id")
            .eq("group_id", trip_id)
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .maybe_single()
            .execute()
        )
        if membership.data:
            return
    except Exception:
        pass

    owner = (
        supabase
        .from_("trips")
        .select("id")
        .eq("id", trip_id)
        .eq("owner_id", user_id)
        .maybe_single()
        .execute()
    )
    if not owner.data:
        raise HTTPException(status_code=403, detail="Not a member of this group")


# ── Keypair endpoints ──────────────────────────────────────────────────────────

@router.post("/users/keypair")
def store_public_key(
    payload: schemas.UserKeypair,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/users/keypair
    Client uploads their public key (generated in the browser).
    Always upserts — ensures the server has the key matching the client's current private key.
    Private key never leaves the client.
    """
    supabase.from_("user_keypair").upsert({
        "user_id": current_user["id"],
        "public_key": payload.public_key
    }).execute()
    return {"public_key": payload.public_key}


@router.get("/users/{user_id}/public-key")
def get_public_key(
    user_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/users/{user_id}/public-key
    Fetch another user's public key so the caller can encrypt the session key for them.
    """
    result = (
        supabase.from_("user_keypair")
        .select("public_key")
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Public key not found for this user")
    return {"public_key": result.data[0]["public_key"]}


# ── Session key endpoints ──────────────────────────────────────────────────────

@router.get("/conversations/{conversation_id}/session-key")
def get_session_key(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/conversations/{conversation_id}/session-key
    Returns the encrypted session key blob for this user.
    The client decrypts it with their local private key — server never sees plaintext.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    result = (
        supabase
        .from_("conversation_session_key")
        .select("encrypted_key")
        .eq("conversation_id", conversation_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="No session key found. The conversation creator must set one up."
        )
    return {"encrypted_key": result.data[0]["encrypted_key"]}


@router.post("/conversations/{conversation_id}/session-key")
async def store_session_keys(
    conversation_id: str,
    payload: schemas.ConversationSessionKeyBulk,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/session-key
    Client sends pre-encrypted session key blobs (one per member).
    Only inserts blobs for members who don't have one yet — safe to call
    multiple times as new members upload their public keys.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    if not payload.keys:
        return {"message": "No keys provided", "stored": 0}

    # Find which members already have a key so we don't overwrite them
    existing = (
        supabase
        .from_("conversation_session_key")
        .select("user_id")
        .eq("conversation_id", conversation_id)
        .execute()
    )
    existing_user_ids = {row["user_id"] for row in (existing.data or [])}

    rows = [
        {
            "conversation_id": conversation_id,
            "user_id": entry.user_id,
            "encrypted_key": entry.encrypted_key
        }
        for entry in payload.keys
        if entry.user_id not in existing_user_ids
    ]

    if rows:
        supabase.from_("conversation_session_key").insert(rows).execute()

    return {"message": f"Stored {len(rows)} key(s)", "stored": len(rows)}


@router.delete("/conversations/{conversation_id}/session-key")
def delete_my_session_key(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    DELETE /api/conversations/{conversation_id}/session-key
    Remove the current user's encrypted session key blob so a new one can be stored.
    Used during keypair rotation when the private key no longer matches the stored blob.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    supabase.from_("conversation_session_key") \
        .delete() \
        .eq("conversation_id", conversation_id) \
        .eq("user_id", current_user["id"]) \
        .execute()
    return {"message": "Session key removed"}


# ── Conversation endpoints ─────────────────────────────────────────────────────

@router.get("/conversations")
def get_conversations(
    trip_id: Optional[str] = Query(None),
    current_user: dict = Depends(oauth2.get_current_user),
):
    """
    GET /api/conversations
    Return conversations that the user is a member of.
    """
    try:
        resp = (
            supabase
            .from_("group_member")
            .select("""
                conversation_id,
                join_datetime,
                left_datetime,
                conversation:conversation_id (
                  conversation_id,
                                    conversation_name,
                                    trip_id
                )
            """)
            .eq("user_id", current_user["id"])
            .is_("left_datetime", None)
            .execute()
        )

        if resp.data is None:
            return []

        convo_map = {}
        for row in resp.data:
            convo = row.get("conversation")
            if convo and convo.get("conversation_id"):
                if trip_id and str(convo.get("trip_id") or "") != str(trip_id):
                    continue
                convo_map[convo["conversation_id"]] = convo

        return list(convo_map.values())

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations")
def create_conversation(
    payload: schemas.ConversationCreate,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations
    Create a new conversation and add members.
    Encryption setup (session key distribution) is handled client-side after this call.
    """
    try:
        if payload.trip_id:
            ensure_trip_member(payload.trip_id, current_user["id"])

        convo_data = {
            "conversation_name": payload.conversation_name or "New Conversation",
            "trip_id": payload.trip_id,
        }
        res = supabase.from_("conversation").insert(convo_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create conversation")

        conversation = res.data[0]
        conversation_id = conversation["conversation_id"]

        member_ids = set(payload.members or [])
        member_ids.add(current_user["id"])

        if payload.trip_id and member_ids:
            allowed_rows = []
            try:
                allowed_res = (
                    supabase
                    .from_("trip_members")
                    .select("user_id")
                    .eq("trip_id", payload.trip_id)
                    .is_("left_at", None)
                    .execute()
                )
                allowed_rows = allowed_res.data or []
            except Exception:
                allowed_res = (
                    supabase
                    .from_("group_member")
                    .select("user_id")
                    .eq("group_id", payload.trip_id)
                    .is_("left_datetime", None)
                    .execute()
                )
                allowed_rows = allowed_res.data or []

            allowed_ids = {row["user_id"] for row in allowed_rows}
            allowed_ids.add(current_user["id"])
            invalid = [uid for uid in member_ids if uid not in allowed_ids]
            if invalid:
                raise HTTPException(status_code=400, detail="All members must belong to the selected group")

        now = datetime.utcnow().isoformat()
        members_to_insert = [
            {"conversation_id": conversation_id, "user_id": uid, "join_datetime": now}
            for uid in member_ids
        ]

        m_res = supabase.from_("group_member").insert(members_to_insert).execute()
        if not m_res.data:
            supabase.from_("conversation").delete().eq("conversation_id", conversation_id).execute()
            raise HTTPException(status_code=500, detail="Failed to add members")

        return conversation

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/members")
def add_member(
    conversation_id: str,
    user_id: str = Query(..., description="User ID to add"),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/members?user_id=...
    Add a member to an existing conversation.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    try:
        existing = (
            supabase.from_("group_member")
            .select("conversation_id")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )
        if existing.data:
            return {"message": "User is already a member"}

        now = datetime.utcnow().isoformat()
        res = supabase.from_("group_member").insert({
            "conversation_id": conversation_id,
            "user_id": user_id,
            "join_datetime": now
        }).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to add member")

        return {"message": "Member added successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/members")
def get_members(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/conversations/{conversation_id}/members
    Return all active users in a conversation.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    try:
        resp = (
            supabase
            .from_("group_member")
            .select("""
                user_id,
                join_datetime,
                left_datetime,
                users:user_id (
                  id,
                  email,
                  username
                )
            """)
            .eq("conversation_id", conversation_id)
            .is_("left_datetime", None)
            .execute()
        )

        if resp.data is None:
            return []

        user_map = {}
        for row in resp.data:
            u = row.get("users")
            if u and u.get("id"):
                user_map[u["id"]] = u

        return list(user_map.values())

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/conversations/{conversation_id}/messages
    Return messages ordered by sent_datetime. Content is encrypted ciphertext.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    try:
        resp = (
            supabase
            .from_("message")
            .select("message_id, from_user, content, sent_datetime, conversation_id, is_encrypted")
            .eq("conversation_id", conversation_id)
            .order("sent_datetime", desc=False)
            .execute()
        )
        return resp.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/images")
async def upload_conversation_image(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/images
    Upload a chat image and return a public URL for message payloads.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    raw_name = (file.filename or "image").replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "", raw_name) or "image"
    base_content_type = normalize_content_type(file.content_type)

    if not base_content_type or not base_content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")

    if base_content_type not in ALLOWED_CHAT_IMAGE_TYPES and base_content_type not in {"image/heic", "image/heif"}:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, GIF, and HEIC images are supported")
    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(file_bytes) > MAX_CHAT_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 8MB)")

    trip_prefix = get_conversation_trip_id(conversation_id) or conversation_id
    file_path = (
        f"{trip_prefix}/chat/{conversation_id}/"
        f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}_{safe_name}"
    )

    try:
        storage_client = supabase_admin or supabase

        storage_client.storage.from_(CHAT_MEDIA_BUCKET).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": base_content_type},
        )

        raw_public_url = storage_client.storage.from_(CHAT_MEDIA_BUCKET).get_public_url(file_path)
        public_url = resolve_public_url(raw_public_url)

        if not public_url:
            raise HTTPException(status_code=500, detail="Upload succeeded but public URL could not be resolved")

        return {
            "public_url": public_url,
            "storage_path": file_path,
            "content_type": base_content_type,
            "file_name": safe_name,
            "size_bytes": len(file_bytes),
        }

    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if "row-level security policy" in err_text.lower() and supabase_admin is None:
            raise HTTPException(
                status_code=500,
                detail="Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in backend .env and restart backend.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.post("/conversations/{conversation_id}/voicemails")
async def upload_conversation_voicemail(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/voicemails
    Upload a voice message file and return a public URL for encrypted message payloads.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    raw_name = (file.filename or "voicemail").replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "", raw_name) or "voicemail"
    base_content_type = normalize_content_type(file.content_type)

    if not is_allowed_audio_upload(base_content_type, safe_name):
        raise HTTPException(
            status_code=400,
            detail=f"Only WEBM, MP4, OGG, MP3, M4A, AAC, WAV, and 3GP audio are supported (received: {file.content_type or 'unknown'})",
        )

    upload_content_type = base_content_type
    if base_content_type == "video/mp4":
        upload_content_type = "audio/mp4"
    if not upload_content_type:
        upload_content_type = "audio/webm"

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(file_bytes) > MAX_CHAT_VOICEMAIL_BYTES:
        raise HTTPException(status_code=400, detail="Voice message is too large (max 15MB)")

    trip_prefix = get_conversation_trip_id(conversation_id) or conversation_id
    file_path = (
        f"{trip_prefix}/chat/{conversation_id}/voicemail/"
        f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}_{safe_name}"
    )

    try:
        storage_client = supabase_admin or supabase

        storage_client.storage.from_(CHAT_MEDIA_BUCKET).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": upload_content_type},
        )

        raw_public_url = storage_client.storage.from_(CHAT_MEDIA_BUCKET).get_public_url(file_path)
        public_url = resolve_public_url(raw_public_url)

        if not public_url:
            raise HTTPException(status_code=500, detail="Upload succeeded but public URL could not be resolved")

        return {
            "public_url": public_url,
            "storage_path": file_path,
            "content_type": upload_content_type,
            "file_name": safe_name,
            "size_bytes": len(file_bytes),
        }

    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if "row-level security policy" in err_text.lower() and supabase_admin is None:
            raise HTTPException(
                status_code=500,
                detail="Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in backend .env and restart backend.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to upload voicemail: {str(e)}")


@router.post("/conversations/{conversation_id}/videos")
async def upload_conversation_video(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/videos
    Upload a video file and return a public URL for encrypted message payloads.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    raw_name = (file.filename or "video").replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "", raw_name) or "video"
    base_content_type = normalize_content_type(file.content_type)

    if not is_allowed_video_upload(base_content_type, safe_name):
        raise HTTPException(
            status_code=400,
            detail=f"Only MP4, WEBM, MOV, OGG, MKV, and 3GP videos are supported (received: {file.content_type or 'unknown'})",
        )

    upload_content_type = resolve_video_upload_content_type(base_content_type, safe_name)
    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(file_bytes) > MAX_CHAT_VIDEO_BYTES:
        raise HTTPException(status_code=400, detail="Video is too large (max 40MB)")

    trip_prefix = get_conversation_trip_id(conversation_id) or conversation_id
    file_path = (
        f"{trip_prefix}/chat/{conversation_id}/video/"
        f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}_{safe_name}"
    )

    try:
        storage_client = supabase_admin or supabase

        storage_client.storage.from_(CHAT_MEDIA_BUCKET).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": upload_content_type},
        )

        raw_public_url = storage_client.storage.from_(CHAT_MEDIA_BUCKET).get_public_url(file_path)
        public_url = resolve_public_url(raw_public_url)

        if not public_url:
            raise HTTPException(status_code=500, detail="Upload succeeded but public URL could not be resolved")

        return {
            "public_url": public_url,
            "storage_path": file_path,
            "content_type": upload_content_type,
            "file_name": safe_name,
            "size_bytes": len(file_bytes),
        }

    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if "row-level security policy" in err_text.lower() and supabase_admin is None:
            raise HTTPException(
                status_code=500,
                detail="Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in backend .env and restart backend.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")


# ── WebSocket ──────────────────────────────────────────────────────────────────

@router.websocket("/ws/conversations/{conversation_id}")
async def ws_conversation(websocket: WebSocket, conversation_id: str):
    await websocket.accept()

    async with rooms_lock:
        rooms.setdefault(conversation_id, set()).add(websocket)

    try:
        while True:
            raw = await websocket.receive_text()

            # Ignore keepalive pings
            if raw == "ping":
                continue

            try:
                data = __import__("json").loads(raw)
            except Exception:
                continue

            event_type = data.get("type")

            if event_type == "typing":
                # Broadcast to everyone else in the room
                await broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "typing",
                        "user_id": data.get("user_id"),
                        "username": data.get("username"),
                    },
                    exclude=websocket,
                )

            elif event_type == "typing_stop":
                await broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "typing_stop",
                        "user_id": data.get("user_id"),
                    },
                    exclude=websocket,
                )

            elif event_type == "read":
                # Broadcast read receipt to others so they can update their UI
                await broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "read",
                        "user_id": data.get("user_id"),
                        "last_read_message_id": data.get("last_read_message_id"),
                    },
                    exclude=websocket,
                )

    except WebSocketDisconnect:
        pass
    finally:
        async with rooms_lock:
            rooms.get(conversation_id, set()).discard(websocket)
            if conversation_id in rooms and not rooms[conversation_id]:
                rooms.pop(conversation_id, None)


@router.post("/conversations/{conversation_id}/messages")
async def post_message(
    conversation_id: str,
    payload: schemas.MessageCreate,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/messages
    Store an encrypted message. Content is an opaque ciphertext blob from the client.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    try:
        if not payload.content:
            raise HTTPException(status_code=400, detail="Missing content")

        new_message = {
            "from_user": current_user["id"],
            "content": payload.content,
            "sent_datetime": payload.sent_datetime.replace(tzinfo=None).isoformat(),
            "conversation_id": conversation_id,
            "is_encrypted": payload.is_encrypted if hasattr(payload, "is_encrypted") else True
        }

        resp = supabase.from_("message").insert(new_message).execute()
        created = resp.data[0]

        await broadcast_to_conversation(conversation_id, created)

        return created

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/conversations/{conversation_id}/messages/{message_id}")
async def edit_message(
    conversation_id: str,
    message_id: str,
    payload: schemas.MessageEdit,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    PATCH /api/conversations/{conversation_id}/messages/{message_id}
    Edit an existing message from the sender within 15 minutes of sent time.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    if not payload.content:
        raise HTTPException(status_code=400, detail="Missing content")

    try:
        existing = (
            supabase
            .from_("message")
            .select("message_id, from_user, content, sent_datetime, conversation_id, is_encrypted")
            .eq("conversation_id", conversation_id)
            .eq("message_id", message_id)
            .maybe_single()
            .execute()
        )

        row = existing.data
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        if str(row.get("from_user")) != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="You can only edit your own messages")

        sent_dt = parse_sent_datetime(row.get("sent_datetime"))
        if not sent_dt:
            raise HTTPException(status_code=400, detail="Message has invalid sent timestamp")

        now_utc = datetime.now(timezone.utc)
        if now_utc - sent_dt > timedelta(minutes=MESSAGE_EDIT_WINDOW_MINUTES):
            raise HTTPException(status_code=403, detail="Message can only be edited within 15 minutes")

        updated_res = (
            supabase
            .from_("message")
            .update({
                "content": payload.content,
                "is_encrypted": payload.is_encrypted,
            })
            .eq("conversation_id", conversation_id)
            .eq("message_id", message_id)
            .execute()
        )

        updated = (updated_res.data or [None])[0]
        if not updated:
            refetched = (
                supabase
                .from_("message")
                .select("message_id, from_user, content, sent_datetime, conversation_id, is_encrypted")
                .eq("conversation_id", conversation_id)
                .eq("message_id", message_id)
                .maybe_single()
                .execute()
            )
            updated = refetched.data

        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update message")

        await broadcast_to_conversation(
            conversation_id,
            {
                "type": "message_edited",
                "message": updated,
            },
        )

        return updated

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}/messages/{message_id}")
async def delete_message(
    conversation_id: str,
    message_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    DELETE /api/conversations/{conversation_id}/messages/{message_id}
    Remove an existing message from the sender within 24 hours of sent time.
    """
    ensure_conversation_member(conversation_id, current_user["id"])

    try:
        existing = (
            supabase
            .from_("message")
            .select("message_id, from_user, sent_datetime, conversation_id")
            .eq("conversation_id", conversation_id)
            .eq("message_id", message_id)
            .maybe_single()
            .execute()
        )

        row = existing.data
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        if str(row.get("from_user")) != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="You can only delete your own messages")

        sent_dt = parse_sent_datetime(row.get("sent_datetime"))
        if not sent_dt:
            raise HTTPException(status_code=400, detail="Message has invalid sent timestamp")

        now_utc = datetime.now(timezone.utc)
        if now_utc - sent_dt > timedelta(hours=MESSAGE_DELETE_WINDOW_HOURS):
            raise HTTPException(status_code=403, detail="Message can only be removed within 24 hours")

        delete_res = (
            supabase
            .from_("message")
            .delete()
            .eq("conversation_id", conversation_id)
            .eq("message_id", message_id)
            .execute()
        )

        if delete_res.data is None:
            verify = (
                supabase
                .from_("message")
                .select("message_id")
                .eq("conversation_id", conversation_id)
                .eq("message_id", message_id)
                .maybe_single()
                .execute()
            )
            if verify.data:
                raise HTTPException(status_code=500, detail="Failed to delete message")

        await broadcast_to_conversation(
            conversation_id,
            {
                "type": "message_deleted",
                "message_id": message_id,
                "conversation_id": conversation_id,
            },
        )

        return {
            "success": True,
            "message_id": message_id,
            "conversation_id": conversation_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
