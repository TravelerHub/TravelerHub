from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from utils import oauth2
from supabase_client import supabase

router = APIRouter(
    prefix="/checklists",
    tags=["Checklists"]
)


# ---- Schemas ----
class ChecklistItemCreate(BaseModel):
    text: str

class ChecklistCreate(BaseModel):
    document_title: Optional[str] = None
    document_type: Optional[str] = None
    source_location: Optional[str] = None
    source_address: Optional[str] = None
    trip_id: Optional[str] = None
    items: List[str]

class ChecklistItemToggle(BaseModel):
    is_completed: bool


# ---- Endpoints ----

@router.post("/")
def create_checklist(body: ChecklistCreate, current_user=Depends(oauth2.get_current_user)):
    """Save a checklist extracted from document analysis."""
    user_id = current_user["id"]

    # Insert the checklist parent row
    checklist_data = {
        "user_id": user_id,
        "document_title": body.document_title,
        "document_type": body.document_type,
        "source_location": body.source_location,
        "source_address": body.source_address,
    }
    if body.trip_id:
        checklist_data["trip_id"] = body.trip_id

    result = supabase.table("document_checklists").insert(checklist_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create checklist")

    checklist_id = result.data[0]["id"]

    # Insert each checklist item
    items_data = [
        {"checklist_id": checklist_id, "text": item_text}
        for item_text in body.items
    ]
    if items_data:
        supabase.table("checklist_items").insert(items_data).execute()

    return {"id": checklist_id, "items_count": len(body.items)}


@router.get("/")
def get_checklists(current_user=Depends(oauth2.get_current_user)):
    """List all checklists for the current user."""
    user_id = current_user["id"]

    checklists = (
        supabase.table("document_checklists")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    result = []
    for cl in checklists.data or []:
        items = (
            supabase.table("checklist_items")
            .select("*")
            .eq("checklist_id", cl["id"])
            .order("created_at")
            .execute()
        )
        cl["items"] = items.data or []
        result.append(cl)

    return result


@router.patch("/items/{item_id}")
def toggle_checklist_item(item_id: str, body: ChecklistItemToggle, current_user=Depends(oauth2.get_current_user)):
    """Toggle a checklist item's completion status."""
    user_id = current_user["id"]

    # Verify the item belongs to the user
    item = supabase.table("checklist_items").select("*, document_checklists!inner(user_id)").eq("id", item_id).execute()
    if not item.data or item.data[0]["document_checklists"]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = {"is_completed": body.is_completed}
    if body.is_completed:
        from datetime import datetime, timezone
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    else:
        update_data["completed_at"] = None

    supabase.table("checklist_items").update(update_data).eq("id", item_id).execute()
    return {"status": "updated"}


@router.delete("/{checklist_id}")
def delete_checklist(checklist_id: str, current_user=Depends(oauth2.get_current_user)):
    """Delete a checklist and its items."""
    user_id = current_user["id"]

    # Verify ownership
    cl = supabase.table("document_checklists").select("*").eq("id", checklist_id).eq("user_id", user_id).execute()
    if not cl.data:
        raise HTTPException(status_code=404, detail="Checklist not found")

    # CASCADE will delete items automatically
    supabase.table("document_checklists").delete().eq("id", checklist_id).execute()
    return {"status": "deleted"}
