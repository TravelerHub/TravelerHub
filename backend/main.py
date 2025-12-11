from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from supabase_client import supabase
from schemas import SignupRequest, LoginRequest

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)