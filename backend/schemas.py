from pydantic import BaseModel

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    confirmPassword: str
    street: str
    city: str
    state: str
    zip_code: str

class LoginRequest(BaseModel):
    username: str
    password: str