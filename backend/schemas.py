from pydantic import BaseModel, EmailStr, BaseModel
from datetime import datetime
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

# ---- Chat Schemas ----
class MessageCreate(BaseModel):
    from_user: str
    to_user: Optional[str] = None
    content: str
    conversation_id: str

class MessageOut(BaseModel):
    message_id: str
    from_user: str
    to_user: Optional[str] = None
    content: str
    sent_datetime: datetime
    conversation_id: str

class ConversationCreate(BaseModel):
    conversation_name: Optional[str] = None
    members: Optional[List[str]] = None

class ConversationOut(BaseModel):
    conversation_id: str
    conversation_name: Optional[str] = None
    created_at: Optional[datetime] = None
    members: Optional[List[str]] = None

class GroupMemberCreate(BaseModel):
    conversation_id: str
    user_id: str

class GroupMemberOut(BaseModel):
    conversation_id: str
    user_id: str
    joined_datetime: Optional[datetime] = None
    left_datetime: Optional[datetime] = None