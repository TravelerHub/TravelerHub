import requests
import os

# 1. Configuration
BASE_URL = "http://127.0.0.1:8000"
USERNAME = "testuser"       # Ensure this user exists in your DB
PASSWORD = "password123"    # Ensure this matches the user's password

# Create a dummy image for testing if one doesn't exist
image_filename = "test_image.jpg"
if not os.path.exists(image_filename):
    with open(image_filename, "wb") as f:
        f.write(os.urandom(1024)) # Create 1KB of random data
    print(f"Created dummy file: {image_filename}")

def run_test():
    # -----------------------------
    # STEP A: Login to get Token
    # -----------------------------
    print(f"Logging in as {USERNAME}...")
    login_payload = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    login_res = requests.post(f"{BASE_URL}/login", json=login_payload)
    
    if login_res.status_code != 200:
        print("Login Failed!")
        print(login_res.text)
        return

    token = login_res.json().get("access_token")
    print(f"Login Successful! Token: {token[:10]}...")

    # -----------------------------
    # STEP B: Upload Image
    # -----------------------------
    print("\nUploading image...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    files = {
        "file": (image_filename, open(image_filename, "rb"), "image/jpeg")
    }

    upload_res = requests.post(
        f"{BASE_URL}/images/upload", 
        headers=headers, 
        files=files
    )

    if upload_res.status_code == 201: # We set status_code=201 in the router
        print("✅ Upload Successful!")
        print("Server Response:", upload_res.json())
        
        # Extract URL to verify
        img_url = upload_res.json().get("url")
        print(f"\nCheck your image here: {img_url}")
    else:
        print("❌ Upload Failed!")
        print(upload_res.text)

if __name__ == "__main__":
    # Ensure 'requests' is installed: pip install requests
    run_test()