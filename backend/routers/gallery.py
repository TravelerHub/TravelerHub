import secrets
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from supabase_client import supabase
from utils import oauth2

router = APIRouter(
    prefix="/trips",
    tags=["Gallery"],
)

BUCKET_NAME = "Media"

# Helper to match how billing.py extracts the user ID
def _current_user_id(current_user: dict) -> str:
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id


# ── GET: Fetch all photos for a trip ──────────────────────────────────────────
@router.get("/{trip_id}/media")
async def get_trip_media(
    trip_id: str, 
    current_user=Depends(oauth2.get_current_user) # Uses your actual auth
):
    """
    Fetches all media associated with a specific trip group.
    """
    try:
        # Ensures user is authenticated (even if we don't strictly need their ID for the query)
        _current_user_id(current_user)

        response = (
            supabase.table("trip_media")
            .select("*")
            .eq("trip_id", trip_id)
            .order("created_at", desc=True)
            .execute()
        )
        
        return response.data

    except Exception as e:
        print(f"Error fetching media: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch media")


# ── POST: Upload a new photo ──────────────────────────────────────────────────
@router.post("/{trip_id}/upload")
async def upload_trip_media(
    trip_id: str, 
    file: UploadFile = File(...),
    current_user=Depends(oauth2.get_current_user) # Uses your actual auth
):
    """
    Receives an image file, uploads it to Supabase Storage, 
    and saves the metadata to the database.
    """
    user_id = _current_user_id(current_user)

    # 1. Generate a unique, safe filename
    random_hex = secrets.token_hex(4)
    safe_filename = file.filename.replace(" ", "_")
    file_path = f"{trip_id}/{random_hex}_{safe_filename}"

    try:
        # 2. Upload the file to Supabase Storage
        file_content = await file.read()
        storage_res = supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type}
        )

        # 3. Get the public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

        # 4. Save the record in the database
        db_record = {
            "trip_id": trip_id,
            "storage_path": file_path,
            "public_url": public_url,
            "uploaded_by": user_id,
            # If your token payload includes a username/email, you can extract it like this:
            "uploaded_by_name": current_user.get("username") or current_user.get("email") or "Group Member"
        }
        
        db_res = supabase.table("trip_media").insert(db_record).execute()
        
        saved = (db_res.data or [None])[0]
        if not saved:
            raise Exception("Database insert returned empty.")

        return saved

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading media: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload media")