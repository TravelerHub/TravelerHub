from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from utils import oauth2
from supabase_client import supabase

router = APIRouter(prefix="/todos", tags=["Trip Todos"])


class TodoCreate(BaseModel):
    trip_id: str
    text: str
    priority: str = "medium"
    category: str = "other"
    due_date: Optional[date] = None


class TodoUpdate(BaseModel):
    text: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[date] = None
    done: Optional[bool] = None


@router.get("/")
def list_todos(trip_id: str = Query(...), current_user=Depends(oauth2.get_current_user)):
    result = (
        supabase.table("trip_todos")
        .select("*, users!trip_todos_created_by_fkey(username, full_name)")
        .eq("trip_id", trip_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/", status_code=201)
def create_todo(body: TodoCreate, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]
    payload = {
        "trip_id": body.trip_id,
        "created_by": user_id,
        "text": body.text.strip(),
        "priority": body.priority,
        "category": body.category,
        "due_date": body.due_date.isoformat() if body.due_date else None,
    }
    result = supabase.table("trip_todos").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create todo")
    return result.data[0]


@router.patch("/{todo_id}")
def update_todo(todo_id: str, body: TodoUpdate, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]

    existing = supabase.table("trip_todos").select("created_by, done").eq("id", todo_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Todo not found")

    payload = {}
    if body.text is not None:
        payload["text"] = body.text.strip()
    if body.priority is not None:
        payload["priority"] = body.priority
    if body.category is not None:
        payload["category"] = body.category
    if body.due_date is not None:
        payload["due_date"] = body.due_date.isoformat()
    if body.done is not None:
        payload["done"] = body.done
        if body.done:
            from datetime import datetime, timezone
            payload["done_by"] = user_id
            payload["done_at"] = datetime.now(timezone.utc).isoformat()
        else:
            payload["done_by"] = None
            payload["done_at"] = None
    if not payload:
        return existing.data[0]

    from datetime import datetime, timezone
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = supabase.table("trip_todos").update(payload).eq("id", todo_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update todo")
    return result.data[0]


@router.delete("/{todo_id}", status_code=204)
def delete_todo(todo_id: str, current_user=Depends(oauth2.get_current_user)):
    user_id = current_user["id"]

    existing = supabase.table("trip_todos").select("created_by").eq("id", todo_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Todo not found")
    if existing.data[0]["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this todo")

    supabase.table("trip_todos").delete().eq("id", todo_id).execute()
