from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set, List, Optional
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

# Helper to check membership
def ensure_conversation_member(conversation_id: str, user_id: str):
    membership = (
        supabase
        .from_("group_member")
        # table uses composite key (conversation_id, user_id) instead of a single id
        .select("conversation_id")
        .eq("conversation_id", conversation_id)
        .eq("user_id", user_id)
        .is_("left_datetime", None)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

# Retrieve
@router.get("/conversations")
def get_conversations(current_user: dict = Depends(oauth2.get_current_user)):
    """
    GET /api/conversations
    Return conversations that the user is a member of (via group_member).
    """
    try:
        # group_member -> conversation (FK join)
        resp = (
            supabase
            .from_("group_member")
            .select("""
                conversation_id,
                join_datetime,
                left_datetime,
                conversation:conversation_id (
                  conversation_id,
                  conversation_name
                )
            """)
            .eq("user_id", current_user["id"])
            .is_("left_datetime", None)  # active memberships only
            .execute()
        )

        if resp.data is None:
            return []

        # normalize to simple conversation list + de-dupe
        convo_map = {}
        for row in resp.data:
            convo = row.get("conversation")
            if convo and convo.get("conversation_id"):
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
    Create a new conversation (group or 1-on-1).
    """
    try:
        # 1. Create the conversation record
        convo_data = {
            "conversation_name": payload.conversation_name or "New Conversation"
        }
        res = supabase.from_("conversation").insert(convo_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        
        conversation = res.data[0]
        conversation_id = conversation["conversation_id"]

        # 2. Add members
        member_ids = set(payload.members or [])
        member_ids.add(current_user["id"])  # Always include creator

        now = datetime.utcnow().isoformat()
        members_to_insert = [
            {"conversation_id": conversation_id, "user_id": uid, "join_datetime": now}
            for uid in member_ids
        ]

        m_res = supabase.from_("group_member").insert(members_to_insert).execute()
        if not m_res.data:
            # Cleanup conversation if member insertion fails
            supabase.from_("conversation").delete().eq("conversation_id", conversation_id).execute()
            raise HTTPException(status_code=500, detail="Failed to add members")

        return conversation

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
    # Verify current user is in the conversation before they can add others
    ensure_conversation_member(conversation_id, current_user["id"])

    try:
        # Check if already a member
        existing = (
            supabase.from_("group_member")
            # query on composite key fields since no 'id' column exists
            .select("conversation_id")
            .eq("conversation_id", conversation_id)
            .eq("user_id", user_id)
            .is_("left_datetime", None)
            .execute()
        )
        if existing.data:
            return {"message": "User is already a member"}

        # Add member
        now = datetime.utcnow().isoformat()
        res = supabase.from_("group_member").insert({
            "conversation_id": conversation_id,
            "user_id": user_id,
            "join_datetime": now
        }).execute()

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to add member")
        
        return {"message": "Member added successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{conversation_id}/members")
def get_members(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/conversations/:conversationId/members
    Return all active users in a conversation (via group_member -> users).
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

        # normalize to list of users + de-dupe
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
    GET /api/conversations/:conversationId/messages
    Return messages in a conversation ordered by sent_datetime.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    try:
        resp = (
            supabase
            .from_("message")
            .select("message_id, from_user, content, sent_datetime, conversation_id")
            .eq("conversation_id", conversation_id)
            .order("sent_datetime", desc=False)
            .execute()
        )

        return resp.data or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create
@router.websocket("/ws/conversations/{conversation_id}")
async def ws_conversation(websocket: WebSocket, conversation_id: str):
    # NOTE: In production, you should authenticate here using a token in query params
    await websocket.accept()

    async with rooms_lock:
        rooms.setdefault(conversation_id, set()).add(websocket)

    try:
        while True:
            # keep alive / optionally handle typing events
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
    POST /api/conversations/:conversationId/messages
    Create a new message in the conversation.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    try:
        # Basic validation (in real app, add more robust checks)
        if not payload.content:
            raise HTTPException(status_code=400, detail="Missing required fields")

        new_message = {
            "from_user": current_user["id"], # Force sender to be the current user
            "content": payload.content,
            "sent_datetime": payload.sent_datetime.isoformat(),
            "conversation_id": conversation_id
        }

        resp = supabase.from_("message").insert(new_message).execute()
        created = resp.data[0]

        # broadcast to everyone currently viewing this conversation
        await broadcast_to_conversation(conversation_id, created)

        return created
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
