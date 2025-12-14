import os
from supabase_client import supabase

def upload_and_save_image(filepath: str):
    filename = os.path.basename(filepath)
    bucket_name = "Media"

    try:
        # Upload to Storage Bucket
        # We open the file in binary mode ('rb')
        with open(filepath, 'rb') as f:
            response = supabase.storage.from_(bucket_name).upload(
                path=filename,
                file=f,
                file_options={"content-type": "image/jpeg"} # Change based on file type
            )
        
        # Construct the Public URL
        # (Only works if bucket is Public)
        public_url = supabase.storage.from_(bucket_name).get_public_url(filename)
        print(f"Uploaded to Bucket: {public_url}")

        # Insert Record into Database
        data = {
            "filename": filename,
            "url": public_url
        }
        
        # This inserts the row and returns the created data
        db_response = supabase.table("images").insert(data).execute()
        
        print("Database Record Created:")
        print(db_response.data)

    except Exception as e:
        print(f"An error occurred: {e}")

# Usage
if __name__ == "__main__":
    # Ensure you have a dummy image named 'test_image.jpg' in the same folder
    upload_and_save_image("test_image.jpg")