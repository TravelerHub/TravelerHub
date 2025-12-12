from fastapi import APIRouter, HTTPException
from supabase_client import supabase
from schemas import SignupRequest, LoginRequest
import bcrypt

router = APIRouter(
    tags=["auth"]  # keep tag for docs
)

# ----------------
# SIGN UP
# ----------------
@router.post("/signup")
def signup(data: SignupRequest):
    existing_email = supabase.table("users").select("email").eq("email", data.email).execute()
    if len(existing_email.data) > 0:
        raise HTTPException(status_code=400, detail="Email already exists!")
    
    existing_username = supabase.table("users").select("username").eq("username", data.username).execute()
    if len(existing_username.data) > 0:
        raise HTTPException(status_code=400, detail="Username already exists!")

    if (data.password != data.confirmPassword):
        raise HTTPException(status_code=400, detail="Passwords do not match!")

    hashed_password = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt())

    res = supabase.table("users").insert({
        "email": data.email,
        "username": data.username,
        "password": hashed_password.decode("utf-8"),
        "street": data.street,
        "city": data.city,
        "state": data.state,
        "zip_code": data.zip_code
    }).execute()

    return {"message": "Signup successful", "user": res.data}

# ----------------
# LOGIN
# ----------------
@router.post("/login")
def login(data: LoginRequest):
    existing_username = supabase.table("users").select("*").eq("username", data.username).single().execute()
    if len(existing_username.data) == 0:
        raise HTTPException(status_code=400, detail="Username does not exist!")
    
    stored_password = existing_username.data['password']
    if not bcrypt.checkpw(data.password.encode("utf-8"), stored_password.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Incorrect password!")
    
    return {"message": "Login successful", "user": existing_username.data}