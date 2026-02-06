from fastapi import APIRouter, HTTPException, status
from supabase_client import supabase

from schemas import SignupRequest, LoginRequest, OtpRequest, OtpVerifyRequest  

# hasing: hash_password, verify_password; oauth2: create_access_token
from utils import hasing, oauth2, otp

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
        "user": user
    }



@router.post("/resetpassword")
def check_email_for_otp(data: OtpRequest):
    """Check email existence and generate/send OTP.
    
    After verifying the email exists:
    1. Generate a random 6-digit OTP
    2. Store OTP with expiry timestamp (10 mins default)
    3. Send OTP to user's email
    4. Return success message
    """
    try:
        res = (
            supabase
            .table("users")
            .select("id")
            .eq("email", data.email)
            .single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing database"
        )

    # If Supabase returned an error payload, treat as server error
    if getattr(res, "error", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking email"
        )

    # If no user found, return a friendly, non-error response so frontend can show a message
    if not res.data:
        return {"exists": False, "message": "Email not found"}

    # Email exists! Now generate and send OTP
    try:
        # Generate and store OTP
        success, otp_code = otp.store_otp(data.email)
        
        # Send OTP via email
        # email_sent = otp.send_otp_email(data.email, otp_code)
        
        if not success:
            # Log the error but don't fail the request completely
            print(f"Warning: OTP email failed to send to {data.email}, but OTP was generated")
            return {
                "exists": True,
                "message": "Email verified, but OTP delivery failed. Please check your connection.",
                "warning": "email_not_sent"
            }
        
        return {
            "exists": True,
            "message": "OTP sent to your email. Please check your inbox.",
            "email": data.email
        }
        
    except Exception as e:
        print(f"Error generating/sending OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error sending OTP. Please try again."
        )


@router.post("/verify-otp")
def verify_otp_code(data: OtpVerifyRequest):
    """Verify OTP code submitted by user.
    
    Requires:
    - email: User's email
    - otp: 6-digit OTP code
    
    Returns:
    - success with message if OTP is valid
    - error if OTP is invalid, expired, or max attempts exceeded
    """
    try:
        # Verify OTP using the otp utility function
        is_valid, message = otp.verify_otp(data.email, data.otp)
        
        if not is_valid:
            # OTP is invalid, expired, or max attempts exceeded
            return {
                "success": False,
                "message": message
            }
        
        # OTP is valid! Return success
        return {
            "success": True,
            "message": "OTP verified successfully. You can now reset your password.",
            "email": data.email
        }
        
    except Exception as e:
        print(f"Error verifying OTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying OTP. Please try again."
        )



@router.post("/updatepassword")
def update_password(payload: dict):
    """Update user password after OTP verification.

    Expected payload: { "email": str, "new_password": str }
    """
    try:
        email = payload.get("email")
        new_password = payload.get("new_password")

        if not email or not new_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and new_password are required")

        # Hash the new password
        hashed = hasing.hash_password(new_password)

        # Update the password in Supabase
        res = (
            supabase
            .table("users")
            .update({"password": hashed})
            .eq("email", email)
            .execute()
        )

        # Supabase returns data on success
        if getattr(res, "error", None):
            print(f"Supabase update error: {res.error}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")

        if not res.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user updated. Check the email provided.")

        return {"success": True, "message": "Password updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while updating password")

