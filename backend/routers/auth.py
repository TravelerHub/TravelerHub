from fastapi import APIRouter, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase_client import supabase

limiter = Limiter(key_func=get_remote_address)

from schemas import SignupRequest, LoginRequest, OtpRequest, OtpVerifyRequest

# hasing: hash_password, verify_password; oauth2: create_access_token
from utils import hasing, oauth2, otp
from utils.encryption import generate_conversation_key
from utils.logger import get_logger

from datetime import timedelta
from jose import JWTError, jwt as _jwt

logger = get_logger(__name__)

router = APIRouter(
    tags=["auth"]
)


# Reset tokens are short-lived JWTs marked with `purpose: "password_reset"`,
# minted only after a successful OTP verification and required by
# /updatepassword. Without this gate the endpoint accepts {email, new_password}
# from any caller — full account takeover with just an email.
_PASSWORD_RESET_TTL = timedelta(minutes=5)
_PASSWORD_RESET_PURPOSE = "password_reset"


def _create_password_reset_token(email: str) -> str:
    payload = {
        "sub": email,
        "purpose": _PASSWORD_RESET_PURPOSE,
    }
    return oauth2.create_access_token(payload, expires_delta=_PASSWORD_RESET_TTL)


def _verify_password_reset_token(token: str) -> str:
    """Return the email bound to a valid reset token, or raise 401."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired reset token. Re-verify your OTP.",
    )
    try:
        decoded = _jwt.decode(token, oauth2.JWT_SECRET, algorithms=[oauth2.JWT_ALGORITHM])
    except JWTError:
        raise invalid
    if decoded.get("purpose") != _PASSWORD_RESET_PURPOSE:
        raise invalid
    email = decoded.get("sub")
    if not isinstance(email, str) or not email:
        raise invalid
    return email


# Fields we never want to ship back to the client. `password` is the bcrypt
# hash; the others are kept for parity if/when more sensitive columns get
# added to the users table.
_SENSITIVE_USER_FIELDS = {"password", "password_hash"}


def _safe_user(user: dict) -> dict:
    """Strip credentials from a users-table row before returning to the client."""
    if not user:
        return user
    return {k: v for k, v in user.items() if k not in _SENSITIVE_USER_FIELDS}


def _get_or_create_user_symmetric_key(user_id: str) -> str:
    """Return the user's symmetric key, creating one on first signup/login."""
    existing = (
        supabase
        .table("user_security_keys")
        .select("symmetric_key")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if existing.data and len(existing.data) > 0:
        return existing.data[0]["symmetric_key"]

    symmetric_key = generate_conversation_key()

    supabase.table("user_security_keys").insert(
        {
            "user_id": user_id,
            "symmetric_key": symmetric_key,
        }
    ).execute()

    return symmetric_key

# sign up for the new user

@router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def signup(request: Request, data: SignupRequest):
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

    symmetric_key = _get_or_create_user_symmetric_key(new_user["id"])


    # auto-login after signup (issue token)
    access_token = oauth2.create_access_token(data={"user_id": new_user["id"]})

    return {
        "message": "Signup successful",
        "user": _safe_user(new_user),
        "symmetric_key": symmetric_key,
        "access_token": access_token,
        "token_type": "bearer",
    }


# login

# ----------------
# LOGIN
# ----------------
@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest):
    # Get user by username — .single() raises in supabase-py v2 when no row found
    try:
        res = (
            supabase
            .table("users")
            .select("*")
            .eq("username", data.username)
            .single()
            .execute()
        )
        user = res.data
    except Exception:
        user = None

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
    symmetric_key = _get_or_create_user_symmetric_key(user["id"])

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": _safe_user(user),
        "symmetric_key": symmetric_key,
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
            logger.warning("OTP email failed to send to %s, but OTP was generated", data.email)
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
        logger.error("Error generating/sending OTP: %s", e, exc_info=True)
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
        
        # OTP is valid. Mint a short-lived reset token that /updatepassword
        # requires — without it, the password-update endpoint would accept an
        # email + new_password from any anonymous caller.
        reset_token = _create_password_reset_token(data.email)
        return {
            "success": True,
            "message": "OTP verified successfully. You can now reset your password.",
            "email": data.email,
            "reset_token": reset_token,
        }
        
    except Exception as e:
        logger.error("Error verifying OTP: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error verifying OTP. Please try again."
        )



@router.post("/updatepassword")
@limiter.limit("5/minute")
def update_password(request: Request, payload: dict):
    """Update user password after OTP verification.

    Expected payload: { "reset_token": str, "new_password": str }
    The reset_token is issued by /verify-otp; the email is read from the
    token's `sub` claim, not the request body.
    """
    try:
        reset_token = payload.get("reset_token")
        new_password = payload.get("new_password")

        if not reset_token or not new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="reset_token and new_password are required",
            )

        email = _verify_password_reset_token(reset_token)

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
            logger.error("Supabase update error: %s", res.error)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")

        if not res.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user updated. Check the email provided.")

        return {"success": True, "message": "Password updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating password: %s", e, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred while updating password")

