from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set, Optional
import asyncio
from datetime import datetime
from supabase_client import supabase
import schemas
from utils import oauth2

# conversation_id -> set of connected websockets
rooms: Dict[str, Set[WebSocket]] = {}
rooms_lock = asyncio.Lock()


async def broadcast_to_conversation(conversation_id: str, message: dict):
    async with rooms_lock:
        sockets = list(rooms.get(conversation_id, set()))

    dead = []
    for ws in sockets:
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


# ── WebSocket ──────────────────────────────────────────────────────────────────

@router.websocket("/ws/conversations/{conversation_id}")
async def ws_conversation(websocket: WebSocket, conversation_id: str):
    await websocket.accept()

    async with rooms_lock:
        rooms.setdefault(conversation_id, set()).add(websocket)

    try:
        while True:
            await websocket.receive_text()
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
