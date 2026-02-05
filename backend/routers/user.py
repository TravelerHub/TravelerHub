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
    
# Update current user's profile
@router.put("/me", response_model=schemas.UserOut)
def update_me(
    user_update: schemas.UserUpdate,
    current_user=Depends(oauth2.get_current_user)
):
    try:
        # Build update payload with only provided fields
        update_data = {}
        if user_update.username is not None:
            update_data["username"] = user_update.username
        if user_update.email is not None:
            update_data["email"] = user_update.email
        # if user_update.phone is not None:
        #     update_data["phone"] = user_update.phone

        if not update_data:
            return current_user  # Nothing to update

        # Update user in Supabase
        response = (
            supabase
            .table("users")
            .update(update_data)
            .eq("id", current_user["id"])
            .execute()
        )

        updated_user = response.data[0] if response.data else current_user
        return updated_user

    except Exception as e:
        print("Error updating user:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating profile"
        )
    
# Change password
@router.put("/me/password")
def change_password(
    password_data: schemas.PasswordChange,
    current_user=Depends(oauth2.get_current_user)
):
    try:
        # Verify current password
        if not hasing.verify_password(password_data.current_password, current_user["password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Hash new password
        new_hashed = hasing.hash_password(password_data.new_password)

        # Update in Supabase
        response = (
            supabase
            .table("users")
            .update({"password": new_hashed})
            .eq("id", current_user["id"])
            .execute()
        )

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print("Error changing password:", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error changing password"
        )
