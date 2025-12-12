from fastapi import APIRouter, HTTPException, status
from supabase_client import supabase

from schemas import SignupRequest, LoginRequest  

# hasing: hash_password, verify_password; oauth2: create_access_token
from utils import hasing, oauth2  

router = APIRouter(
    tags=["auth"]
)

# sign up for the new user

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest):
    # Check email uniqueness
    existing_email = (
        supabase
        .table("users")
        .select("id")
        .eq("email", data.email)
        .execute()
    )
    if existing_email.data and len(existing_email.data) > 0:
        raise HTTPException(status_code=400, detail="Email already exists!")

    # Check username uniqueness
    existing_username = (
        supabase
        .table("users")
        .select("id")
        .eq("username", data.username)
        .execute()
    )
    if existing_username.data and len(existing_username.data) > 0:
        raise HTTPException(status_code=400, detail="Username already exists!")

    # Hash the password before saving
    hashed_password = hasing.hash_password(data.password)

    # Insert new user into Supabase
    # Add any extra fields you need (role, created_at, etc.)
    res = (
    supabase
    .table("users")
    .insert({
            "email": data.email,
            "username": data.username,
            "password": hashed_password,
            "street": data.street,
            "city": data.city,
            "state": data.state,
            "zip_code": data.zip_code,
        })
    .execute()
    )

    if not res.data or len(res.data) == 0:
        raise HTTPException(
            status_code=500,
            detail="Error creating user"
        )

    new_user = res.data[0]


    # auto-login after signup (issue token)
    access_token = oauth2.create_access_token(data={"user_id": new_user["id"]})

    return {
        "message": "Signup successful",
        "user": new_user,
        "access_token": access_token,
        "token_type": "bearer",
    }


# login

# ----------------
# LOGIN
# ----------------
@router.post("/login")
def login(data: LoginRequest):
    # Get user by username
    res = (
        supabase
        .table("users")
        .select("*")
        .eq("username", data.username)
        .single()
        .execute()
    )

    user = res.data

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Verify password (hashed vs plain)
    
    is_valid = hasing.verify_password(data.password, user["password"])
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    #Create JWT token
   
    access_token = oauth2.create_access_token(data={"user_id": user["id"]})

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        # keep this if your frontend is using it:
        "redirect": "/dashboard",
    }
