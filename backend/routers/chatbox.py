from fastapi import APIRouter, HTTPException, Query
from supabase_client import supabase
import schemas

router = APIRouter(prefix="/api", tags=["chat"])




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

@router.post("/conversations/{conversation_id}/messages")
def post_message(conversation_id: str, payload: schemas.MessageCreate):
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

        return resp.data[0]  # return the created message

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))