from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

import schemas
from utils import oauth2, hasing

from supabase_client import supabase  

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


#  get current user
@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user =  Depends(oauth2.get_current_user)):
    # NOTE: This still depends on how oauth2.get_current_user is implemented.
    # If oauth2 currently uses SQLAlchemy, you'll want to migrate that to Supabase too.
    return current_user


#get all user lists

@router.get("/", response_model=List[schemas.UserOut])
def get_users():
    try:
        # SELECT * FROM users;
        response = supabase.table("users").select("*").execute()
        users = response.data  # list[dict]
        return users
    except Exception as e:
        print("Error fetching users from Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching users"
        )


#get user by ID

@router.get("/{id}", response_model=schemas.UserOut)
def get_user(id: int):
    try:
        # SELECT * FROM users WHERE id = id LIMIT 1;
        response = (
            supabase
            .table("users")
            .select("*")
            .eq("id", id)
            .single()
            .execute()
        )

        user = response.data
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {id} not found"
            )

        return user

    except Exception as e:
        # If Supabase throws an error for not found, handle it here too
        print("Error fetching user from Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {id} not found"
        )


# create a new user in supabase
@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate):
    # check if email already exists
    try:
        existing = (
            supabase
            .table("users")
            .select("id")
            .eq("email", user.email)
            .execute()
        )

        if existing.data:  # if exist, alert user to log in
            raise HTTPException(status_code=400, detail="Email already registered")

    except HTTPException:
        # Re-raise the HTTPException above
        raise
    except Exception as e:
        print("Error checking existing user in Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking existing user"
        )

    # Hash password
    hashed_password = hasing.hash_password(user.password)

    # Insert into Supabase
    try:
        insert_payload = {
            "email": user.email,
            "username": user.username,
            "password": hashed_password,
            "street": user.street,
            "city": user.city,
            "state": user.state,
            "zip_code": user.zip_code
            
        }

        # Insert and return the new row in one shot
        response = (
            supabase
            .table("users")
            .insert(insert_payload)
            .select("*")
            .single()
            .execute()
        )

        created_user = response.data
        return created_user

    except Exception as e:
        print("Error inserting user into Supabase:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )
