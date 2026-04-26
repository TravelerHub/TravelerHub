# supabase_client.py
from supabase import create_client, Client
import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("Supabase URL or anon key not set in environment")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

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

# Admin client using service role key — bypasses RLS for server-side storage ops.
# Falls back to the anon client if the key is not configured.
supabase_admin: Client = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if SUPABASE_SERVICE_ROLE_KEY
    else supabase
)


def safe_single(query_builder):
    """
    Execute a maybe_single() query and return the result.
    Works around a postgrest-py 2.x bug where a 204 (no rows) response
    raises APIError instead of returning data=None.
    """
    try:
        return query_builder.maybe_single().execute()
    except Exception as e:
        msg = str(e)
        if "'204'" in msg or '"204"' in msg or "Missing response" in msg:
            class _Empty:
                data = None
            return _Empty()
        raise


async def async_safe_single(query_builder):
    """Async version of safe_single for use in async route handlers.
    Runs the blocking maybe_single().execute() in a thread pool so the
    event loop is not blocked.
    """
    try:
        return await asyncio.to_thread(lambda: query_builder.maybe_single().execute())
    except Exception as e:
        msg = str(e)
        if "'204'" in msg or '"204"' in msg or "Missing response" in msg:
            class _Empty:
                data = None
            return _Empty()
        raise
