from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

from dotenv import load_dotenv
import os

import schemas
from supabase_client import supabase 

# load env variable from .env file
load_dotenv()

# Environment variables for JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# define the OAuth2 password flow, expecting token to be sent to this URL

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


#create jwt access token
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """
    Create a JWT access token with expiration.

    Args:
        data (dict): Payload. Must contain either 'sub' or 'user_id'.
        expires_delta (timedelta, optional): Custom expiration time.

    Returns:
        str: Encoded JWT token.
    """
    to_encode = data.copy()

    # Normalize the subject (user id)
    user_id = to_encode.get("sub") or to_encode.get("user_id")
    if user_id is None:
        raise ValueError("Token payload must include 'sub' or 'user_id'")

    to_encode["sub"] = str(user_id)

    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})

    # encode the token with secret and algorithms
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    print("token created")
    return encoded_jwt


# verify JWT access token
def verify_access_token(token: str, credentials_exception):
    """
    Verify and decode a JWT access token.

    Args:
        token (str): The JWT token to decode.
        credentials_exception (HTTPException): The exception to raise if verification fails.

    Returns:
        TokenData: Contains the decoded user ID from token.
    """
    try:
        # decode the JWT token using secret and algorithms
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        id: str = payload.get("sub")  # get the user_id from the sub field

        # raise error if there is no ID found
        if id is None:
            raise credentials_exception

        token_data = schemas.TokenData(id=id)

    except JWTError:
        # if token is invalid or expired
        raise credentials_exception

    return token_data  # Return the token data if verification is successful


# get current user from token
def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Get the current user from the JWT token (Supabase-backed).

    Args:
        token (str): The JWT token from Authorization header.

    Returns:
        dict: The user data from Supabase.

    Raises:
        HTTPException: If the token is invalid/expired or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # verify and decode the token
    token_data = verify_access_token(token, credentials_exception)

    # fetch user from Supabase using the id from the token
    try:
        res = (
            supabase
            .table("users")
            .select("*")
            .eq("id", token_data.id)
            .single()
            .execute()
        )
        user = res.data
    except Exception:
        raise credentials_exception

    if not user:
        raise credentials_exception

    # return the user object 
    return user
