from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

# Use the existing URL from env
url = os.getenv("VITE_SUPABASE_URL")

# --- PASTE YOUR SERVICE ROLE KEY DIRECTLY HERE FOR TESTING ---
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpbGpkdXh4aHhncWt4eWd4cmhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTMyMTYxMCwiZXhwIjoyMDgwODk3NjEwfQ.crfevqxaRWhjKcOYL-jRmz71qljSAzPoFbVI2Jf27Kg" 

supabase = create_client(url, key)

def check_buckets():
    print("--- Connecting to Supabase ---")
    try:
        # 1. Ask Supabase to list all buckets
        res = supabase.storage.list_buckets()
        
        print(f"Found {len(res)} buckets:")
        for bucket in res:
            print(f" - Name: '{bucket.name}', Public: {bucket.public}")

    except Exception as e:
        print("Error listing buckets:", e)

if __name__ == "__main__":
    check_buckets()