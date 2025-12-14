import requests

BASE_URL = "http://127.0.0.1:8000"

payload = {
    "email": "testuser@example.com",
    "username": "testuser",
    "password": "pass",
    "street": "123 Test St",
    "city": "Test City",
    "state": "CA",
    "zip_code": "90210"
}

response = requests.post(f"{BASE_URL}/signup", json=payload)

if response.status_code == 201:
    print("✅ User created successfully!")
elif response.status_code == 400:
    print("User already exists (that's fine, you can proceed to test_upload.py)")
else:
    print("❌ Signup failed:", response.text)