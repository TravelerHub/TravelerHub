from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/media-comments", tags=["Media Comments"])


class CommentCreate(BaseModel):
    media_id: str
    trip_id: str
    body: str


@router.get("/")
def list_comments(media_id: str = Query(...), current_user=Depends(oauth2.get_current_user)):
    result = (
        supabase.table("media_comments")
        .select("*, users!media_comments_user_id_fkey(id, username, full_name, profile_picture_url)")
        .eq("media_id", media_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.post("/", status_code=201)
def add_comment(body: CommentCreate, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Comment body cannot be empty")
    result = supabase.table("media_comments").insert({
        "media_id": body.media_id,
        "trip_id": body.trip_id,
        "user_id": user_id,
        "body": body.body.strip()[:500],
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add comment")
    return result.data[0]


@router.delete("/{comment_id}", status_code=204)
def delete_comment(comment_id: str, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    existing = supabase.table("media_comments").select("user_id").eq("id", comment_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your comment")
    supabase.table("media_comments").delete().eq("id", comment_id).execute()
