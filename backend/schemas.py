from pydantic import BaseModel, EmailStr, BaseModel

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