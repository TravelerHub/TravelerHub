from tokenize import String
from pydantic import BaseModel, EmailStr, BaseModel
from typing import List, Optional

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None              
    

class LoginRequest(BaseModel):
    username: str
    password: str


# USER SCHEMAS
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str  
    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None              
    

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# OTP request schema (frontend will send email to check)
class OtpRequest(BaseModel):
    email: EmailStr


# OTP verification request schema
class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

# ---- OUTPUT SCHEMAS (what API returns) ----
class UserOut(BaseModel):
    id: str
    email: EmailStr
    username: str


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class TokenData(BaseModel):
    id: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# --- INPUT SCHEMAS ---
class PollOptionCreate(BaseModel):
    text: str
    description: Optional[str] = None

class PollCreate(BaseModel):
    title: str
    description: Optional[str] = None
    options: List[PollOptionCreate]

class VoteCreate(BaseModel):
    poll_id: int
    option_id: int

# --- OUTPUT SCHEMAS ---
class PollOptionResponse(BaseModel):
    id: int
    text: str
    vote_count: int  # Computed field
    
    class Config:
        from_attributes = True

class PollResponse(BaseModel):
    id: int
    title: str
    is_active: bool
    options: List[PollOptionResponse]
    user_vote_id: Optional[int] = None # ID of the option the current user voted for
    
    class Config:
        from_attributes = True