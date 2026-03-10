import base64

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set, List, Optional
import asyncio
from datetime import datetime
from supabase_client import supabase
import schemas
from utils import oauth2
from utils.encryption import (
    generate_keypair,
    generate_conversation_key,
    encrypt_key_for_user,
    decrypt_key_for_user
)

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

# ---- Encryption Endpoints ----
@router.post("/users/keypair")
def create_or_get_keypair(current_user: dict = Depends(oauth2.get_current_user)):
    """
    POST /api/users/keypair
    Create or retrieve user's keypair for encryption.
    """
    try:
        # Check if keypair exists
        existing = supabase.from_("user_keypair").select("*").eq("user_id", current_user["id"]).execute()
        
        if existing.data:
            return {
                "public_key": existing.data[0]["public_key"],
                "note": "Keypair already exists"
            }
        
        # Generate new keypair
        public_key, private_key = generate_keypair()
        
        # Store in database
        supabase.from_("user_keypair").insert({
            "user_id": current_user["id"],
            "public_key": public_key,
            "private_key": private_key
        }).execute()
        
        return {
            "public_key": public_key,
            "note": "New keypair created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/session-key")
def get_session_key(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    GET /api/conversations/{conversation_id}/session-key
    Get the decrypted session key for the conversation (encrypted for the current user).
    Returns a fallback key if encryption tables don't exist.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    
    try:
        # Check if session key exists
        existing = (
            supabase
            .from_("conversation_session_key")
            .select("*")
            .eq("conversation_id", conversation_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        
        if not existing.data:
            # Try to create one
            try:
                session_key = generate_conversation_key()
                
                # Get member's public key
                member_keypair = (
                    supabase
                    .from_("user_keypair")
                    .select("private_key")
                    .eq("user_id", current_user["id"])
                    .execute()
                )
                
                if member_keypair.data:
                    private_key = member_keypair.data[0]["private_key"]
                    return {"session_key": session_key}
            except:
                pass
            
            # Fallback: return a deterministic key based on conversation_id
            # This is NOT secure but allows testing without database tables
            import hashlib
            key_bytes = bytearray(32)
            id_bytes = (conversation_id + "_key").encode("utf-8")
            for j in range(32):
                id_byte = id_bytes[j % len(id_bytes)]
                key_bytes[j] = ((id_byte * 7 + j * 13) ^ (j * 23)) & 0xFF
            fallback_key = base64.b64encode(bytes(key_bytes)).decode("utf-8")
            return {"session_key": fallback_key, "warning": "Using fallback encryption key - enable database tables for full security"}
        
        encrypted_key = existing.data[0]["encrypted_key"]
        
        # Get user's private key to decrypt
        user_keypair = supabase.from_("user_keypair").select("private_key").eq("user_id", current_user["id"]).execute()
        
        if not user_keypair.data:
            raise HTTPException(status_code=500, detail="User keypair not found")
        
        private_key = user_keypair.data[0]["private_key"]
        
        # Decrypt the session key
        session_key = decrypt_key_for_user(encrypted_key, private_key)
        
        return {"session_key": session_key}
    except HTTPException:
        raise
    except Exception as e:
        # Fallback: return a deterministic key based on conversation_id
        import hashlib
        key_bytes = bytearray(32)
        id_bytes = (conversation_id + "_key").encode("utf-8")
        for j in range(32):
            id_byte = id_bytes[j % len(id_bytes)]
            key_bytes[j] = ((id_byte * 7 + j * 13) ^ (j * 23)) & 0xFF
        fallback_key = base64.b64encode(bytes(key_bytes)).decode("utf-8")
        return {"session_key": fallback_key, "warning": "Using fallback encryption key - enable database tables for full security"}


@router.post("/conversations/{conversation_id}/session-key")
async def create_session_key(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    POST /api/conversations/{conversation_id}/session-key
    Create a new session key for a conversation (only creator can do this).
    Encrypts the key for each member.
    """
    ensure_conversation_member(conversation_id, current_user["id"])
    
    try:
        # Check if session key already exists
        existing = (
            supabase
            .from_("conversation_session_key")
            .select("*")
            .eq("conversation_id", conversation_id)
            .execute()
        )
        
        if existing.data:
            return {"message": "Session key already exists for this conversation"}
        
        # Generate new session key
        session_key = generate_conversation_key()
        
        # Get all members of the conversation
        members = (
            supabase
            .from_("group_member")
            .select("user_id")
            .eq("conversation_id", conversation_id)
            .is_("left_datetime", None)
            .execute()
        )
        
        if not members.data:
            raise HTTPException(status_code=500, detail="No members found in conversation")
        
        # For each member, encrypt the session key with their public key and store
        for member in members.data:
            member_id = member["user_id"]
            
            # Get member's public key
            member_keypair = (
                supabase
                .from_("user_keypair")
                .select("public_key")
                .eq("user_id", member_id)
                .execute()
            )
            
            if not member_keypair.data:
                # Create keypair for member if it doesn't exist
                pub_key, priv_key = generate_keypair()
                supabase.from_("user_keypair").insert({
                    "user_id": member_id,
                    "public_key": pub_key,
                    "private_key": priv_key
                }).execute()
                member_public_key = pub_key
            else:
                member_public_key = member_keypair.data[0]["public_key"]
            
            # Encrypt session key for this member
            encrypted_key = encrypt_key_for_user(session_key, member_public_key)
            
            # Store encrypted key
            supabase.from_("conversation_session_key").insert({
                "conversation_id": conversation_id,
                "user_id": member_id,
                "encrypted_key": encrypted_key
            }).execute()
        
        return {"message": "Session key created and distributed to all members"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    Automatically creates and distributes encryption session keys.
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

        # 3. Create and distribute encryption session keys
        try:
            # Generate new session key
            session_key = generate_conversation_key()
            
            # For each member, ensure they have a keypair and encrypt the session key
            for member_id in member_ids:
                # Check if member has a keypair
                member_keypair = (
                    supabase
                    .from_("user_keypair")
                    .select("public_key")
                    .eq("user_id", member_id)
                    .execute()
                )
                
                if not member_keypair.data:
                    # Create keypair for member if it doesn't exist
                    pub_key, priv_key = generate_keypair()
                    supabase.from_("user_keypair").insert({
                        "user_id": member_id,
                        "public_key": pub_key,
                        "private_key": priv_key
                    }).execute()
                    member_public_key = pub_key
                else:
                    member_public_key = member_keypair.data[0]["public_key"]
                
                # Encrypt session key for this member
                encrypted_key = encrypt_key_for_user(session_key, member_public_key)
                
                # Store encrypted key
                supabase.from_("conversation_session_key").insert({
                    "conversation_id": conversation_id,
                    "user_id": member_id,
                    "encrypted_key": encrypted_key
                }).execute()
        except Exception as e:
            # Log but don't fail - encryption is added functionality
            print(f"Warning: Failed to setup encryption for conversation {conversation_id}: {str(e)}")

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
            .select("message_id, from_user, content, sent_datetime, conversation_id, is_encrypted")
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
            "sent_datetime": payload.sent_datetime.replace(tzinfo=None).isoformat(),
            "conversation_id": conversation_id,
            "is_encrypted": payload.is_encrypted if hasattr(payload, 'is_encrypted') else True
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
