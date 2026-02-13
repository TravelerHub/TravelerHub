from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
from supabase_client import supabase
import schemas

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

# Retrieve
@router.get("/conversations")
def get_conversations(userId: str = Query(..., description="Current user's UUID")):
    """
    GET /api/conversations?userId=...
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
            .eq("user_id", userId)
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

@router.get("/conversations/{conversation_id}/members")
def get_members(conversation_id: str):
    """
    GET /api/conversations/:conversationId/members
    Return all active users in a conversation (via group_member -> users).
    """
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
def get_messages(conversation_id: str):
    """
    GET /api/conversations/:conversationId/messages
    Return messages in a conversation ordered by sent_datetime.
    """
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
async def post_message(conversation_id: str, payload: schemas.MessageCreate):
    """
    POST /api/conversations/:conversationId/messages
    Create a new message in the conversation.
    """
    try:
        # Basic validation (in real app, add more robust checks)
        if not payload.from_user or not payload.content:
            raise HTTPException(status_code=400, detail="Missing required fields")

        new_message = {
            "from_user": payload.from_user,
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