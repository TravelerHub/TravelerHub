from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from supabase_client import supabase
from utils import oauth2
import uuid 

router = APIRouter(
    prefix="/images",
    tags=["Images"]
)

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...), 
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    Uploads an image to Supabase Storage and records it in the database.
    Requires authentication.
    """
    
    # 1. Generate a unique filepath
    # Structure: user_id/random_uuid.jpg (keeps bucket organized by user)
    file_ext = file.filename.split(".")[-1]
    file_path = f"{current_user['id']}/{uuid.uuid4()}.{file_ext}"
    
    # 2. Read file content
    file_content = await file.read()

    # 3. Upload to Supabase Storage
    bucket_name = "images"
    try:
        supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        print(f"Storage Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to upload image to storage"
        )

    # 4. Get the Public URL
    # Note: Ensure your bucket is set to "Public" in Supabase dashboard
    public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)

    # 5. Insert Record into Database
    try:
        data_to_insert = {
            "filename": file.filename,
            "url": public_url,
            # Optional: if you added a user_id column to your images table:
            # "user_id": current_user['id'] 
        }
        
        res = supabase.table("images").insert(data_to_insert).execute()
        
        # Return the created record
        return res.data[0]

    except Exception as e:
        print(f"Database Error: {e}")
        # Cleanup: If DB insert fails, you might want to delete the file from storage here
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to save image record"
        )