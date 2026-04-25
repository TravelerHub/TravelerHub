# supabase_client.py
from supabase import create_client, Client
import os
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("Supabase URL or anon key not set in environment")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Optional privileged client for server-side operations that must bypass RLS
# (for example, Storage uploads after backend authorization checks).
supabase_admin: Optional[Client] = None
if SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Replace the postgrest httpx session with one that uses HTTP/1.1.
# The default session uses HTTP/2 (h2 is installed), which causes
# "Server disconnected" errors when idle connections are reused after
# Supabase closes them server-side.
_old_session = supabase.postgrest.session
supabase.postgrest.session = httpx.Client(
    base_url=str(_old_session.base_url),
    headers=dict(_old_session.headers),
    http2=False,
)

if supabase_admin:
    _old_admin_session = supabase_admin.postgrest.session
    supabase_admin.postgrest.session = httpx.Client(
        base_url=str(_old_admin_session.base_url),
        headers=dict(_old_admin_session.headers),
        http2=False,
    )
