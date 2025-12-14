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

# ---- OUTPUT SCHEMAS (what API returns) ----
class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class TokenData(BaseModel):
    id: str | None = None