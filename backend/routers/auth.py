from fastapi import APIRouter, HTTPException
from supabase_client import supabase
from schemas import SignupRequest, LoginRequest

router = APIRouter(
    tags=["auth"]  # keep tag for docs
)

@router.post("/signup")
def signup(data: SignupRequest):
    existing_email = supabase.table("users").select("email").eq("email", data.email).execute()
    if len(existing_email.data) > 0:
        raise HTTPException(status_code=400, detail="Email already exists!")
    
    existing_username = supabase.table("users").select("username").eq("username", data.username).execute()
    if len(existing_username.data) > 0:
        raise HTTPException(status_code=400, detail="Username already exists!")

    res = supabase.table("users").insert({
        "email": data.email,
        "username": data.username,
        "password": data.password
    }).execute()

    return {"message": "Signup successful", "user": res.data}

@router.post("/login")
def login(data: LoginRequest):
    user = supabase.table("users")\
                   .select("*")\
                   .eq("username", data.username)\
                   .eq("password", data.password)\
                   .execute()
    if len(user.data) == 0:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {"message": "Login successful", "redirect": "/dashboard"}