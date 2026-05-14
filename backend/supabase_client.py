# supabase_client.py
from supabase import create_client, Client
import asyncio
import logging
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("supabase_client")


def _clean_env(name: str) -> str | None:
    """Read an env var and strip whitespace / accidentally-quoted characters.

    Common deploy hazards:
      - Trailing newline copied in from a `.env` line
      - Leading/trailing spaces from shell pasting
      - Wrapping single or double quotes from `.env` files where the runtime
        doesn't strip them itself

    Without this, the JWT we pass to Supabase comes back as
    `JWS Protected Header is invalid` and the user sees a 503 with no clue
    that the env var is just malformed.
    """
    raw = os.getenv(name)
    if raw is None:
        return None
    cleaned = raw.strip().strip('"').strip("'").strip()
    if cleaned != raw:
        logger.warning(
            "env var %s contained whitespace or surrounding quotes — using stripped value",
            name,
        )
    return cleaned or None


def _looks_like_jwt(token: str | None) -> bool:
    """True if `token` is shaped like a Supabase JWT (three base64url segments)."""
    if not token or "." not in token:
        return False
    parts = token.split(".")
    if len(parts) != 3:
        return False
    # Each segment should be non-empty and contain only base64url chars.
    base64url = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_="
    )
    return all(seg and all(c in base64url for c in seg) for seg in parts)


def _jwt_role(token: str | None) -> str | None:
    """Decode the JWT payload (no signature verification) and return the
    `role` claim. Used to detect the most common deploy mistake — pasting
    the anon key into the SUPABASE_SERVICE_ROLE_KEY env var. Both keys
    are valid JWTs so `_looks_like_jwt` passes for both, but only the
    real service-role key has `role: service_role`.
    """
    if not _looks_like_jwt(token):
        return None
    try:
        import base64
        import json
        payload = token.split(".")[1]
        # JWT base64url payloads omit padding. Restore it before decoding.
        padded = payload + "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded).decode("utf-8")
        data = json.loads(decoded)
        role = data.get("role")
        return role if isinstance(role, str) else None
    except Exception:
        return None


SUPABASE_URL = _clean_env("VITE_SUPABASE_URL") or _clean_env("SUPABASE_URL")
SUPABASE_ANON_KEY = _clean_env("VITE_SUPABASE_ANON_KEY") or _clean_env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _clean_env("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("Supabase URL or anon key not set in environment")

# Validate JWT shape early. A malformed key turns into the opaque
# "JWS Protected Header is invalid" error from Supabase Storage / Postgrest
# and crashes uploads with no actionable signal in the logs.
if not _looks_like_jwt(SUPABASE_ANON_KEY):
    logger.error(
        "SUPABASE_ANON_KEY does not look like a JWT (expected three "
        "dot-separated base64 segments). Storage and Postgrest will reject "
        "every request with 'JWS Protected Header is invalid'. Re-paste the "
        "key from the Supabase dashboard, with no surrounding whitespace."
    )

if SUPABASE_SERVICE_ROLE_KEY and not _looks_like_jwt(SUPABASE_SERVICE_ROLE_KEY):
    logger.error(
        "SUPABASE_SERVICE_ROLE_KEY is set but does not look like a JWT. "
        "Photo uploads and any service-role-only writes will fail with "
        "'JWS Protected Header is invalid'. Re-paste the key from the "
        "Supabase dashboard, with no surrounding whitespace."
    )
elif SUPABASE_SERVICE_ROLE_KEY:
    # Common deploy mistake: pasting the anon key into the service-role
    # slot. Both are valid JWTs so the shape check above passes — but RLS
    # still blocks every server-side upload because the role claim is
    # `anon` rather than `service_role`. Detect that here so the
    # operator gets a clear message instead of a runtime 503.
    role = _jwt_role(SUPABASE_SERVICE_ROLE_KEY)
    if role and role != "service_role":
        logger.error(
            "SUPABASE_SERVICE_ROLE_KEY is a valid JWT but its `role` claim is "
            "%r, not 'service_role'. This is almost certainly the anon key "
            "pasted into the wrong slot. Photo uploads will fail with RLS "
            "errors. Copy the *service_role* key from "
            "Supabase dashboard → Settings → API → Project API keys.",
            role,
        )

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
# Falls back to the anon client if the key is not configured. Callers can read
# `has_service_role` to surface a clear error in that case rather than letting
# RLS reject the operation with an opaque storage / DB error.
has_service_role: bool = bool(SUPABASE_SERVICE_ROLE_KEY) and _looks_like_jwt(SUPABASE_SERVICE_ROLE_KEY)
supabase_admin: Client = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if has_service_role
    else supabase
)

if has_service_role:
    _old_admin_session = supabase_admin.postgrest.session
    supabase_admin.postgrest.session = httpx.Client(
        base_url=str(_old_admin_session.base_url),
        headers=dict(_old_admin_session.headers),
        http2=False,
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
