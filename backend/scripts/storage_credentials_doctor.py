"""
Storage-credentials doctor — pinpoint why uploads return 503.

Run this on the production server (or anywhere with the same env vars) to
get a single-screen report of every common failure mode for the Supabase
storage credentials. Prints clear pass / fail / next-step lines so you
don't have to read FastAPI startup logs.

  cd backend
  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python -m scripts.storage_credentials_doctor

Or if env is already loaded into the process / .env:
  python -m scripts.storage_credentials_doctor
"""

from __future__ import annotations

import base64
import json
import os
import sys
import textwrap

# Allow running both as a module (`python -m scripts.storage_credentials_doctor`)
# and as a script (`python scripts/storage_credentials_doctor.py`).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Pick up env vars the same way supabase_client.py does (which calls
# load_dotenv at import time). Without this, running the doctor in a
# fresh shell over SSH would report "not set" for keys that the FastAPI
# app picks up just fine from the project's .env file. Best-effort:
# python-dotenv is a transitive dep of every backend deploy we've seen,
# but if it's somehow missing we fall back to whatever's already in os.environ.
try:
    from dotenv import load_dotenv
    # Walk up from this file: backend/scripts/ → backend/ → project root.
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(here, "..", ".env"),         # backend/.env
        os.path.join(here, "..", "..", ".env"),   # repo-root/.env
    ):
        if os.path.exists(candidate):
            load_dotenv(candidate, override=False)
    # Also try CWD just in case the operator's shell has its own .env.
    load_dotenv(override=False)
except Exception:
    pass

OK = "✓"
FAIL = "✗"
WARN = "!"


def _hr(label: str = "") -> None:
    bar = "─" * 70
    if label:
        print(f"\n{bar}\n {label}\n{bar}")
    else:
        print(bar)


def _ok(msg: str) -> None:
    print(f"  {OK} {msg}")


def _bad(msg: str) -> None:
    print(f"  {FAIL} {msg}")


def _warn(msg: str) -> None:
    print(f"  {WARN} {msg}")


def _hint(msg: str) -> None:
    print("    " + textwrap.fill(msg, width=68, subsequent_indent="    "))


def _read_env(name: str) -> tuple[str | None, str | None]:
    """Return (raw, cleaned). cleaned is what supabase_client._clean_env produces."""
    raw = os.getenv(name)
    if raw is None:
        return None, None
    cleaned = raw.strip().strip('"').strip("'").strip()
    return raw, (cleaned or None)


def _looks_like_jwt(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    parts = token.split(".")
    if len(parts) != 3:
        return False
    base64url = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_="
    )
    return all(seg and all(c in base64url for c in seg) for seg in parts)


def _decode_payload(token: str | None) -> dict | None:
    if not _looks_like_jwt(token):
        return None
    try:
        payload = token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(padded).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return None


def check_url() -> str | None:
    raw, cleaned = _read_env("SUPABASE_URL")
    if cleaned is None:
        # Fall back to the VITE_ alias
        raw, cleaned = _read_env("VITE_SUPABASE_URL")
    if cleaned is None:
        _bad("SUPABASE_URL is not set")
        _hint("Set this to your Supabase project URL "
              "(https://<projectref>.supabase.co) — both VITE_SUPABASE_URL "
              "and SUPABASE_URL are read.")
        return None

    if raw != cleaned:
        _warn(f"SUPABASE_URL had whitespace or quotes around it: {raw!r}")
        _hint("This works because we strip in code, but you should fix it "
              "in your env to avoid surprises.")
    if not cleaned.startswith("https://"):
        _bad(f"SUPABASE_URL doesn't start with https://: {cleaned!r}")
        return None
    if cleaned.endswith("/"):
        _warn("SUPABASE_URL ends with a trailing slash; harmless but ugly.")

    _ok(f"SUPABASE_URL is set: {cleaned}")
    return cleaned


def check_service_role_key() -> str | None:
    raw, cleaned = _read_env("SUPABASE_SERVICE_ROLE_KEY")
    if cleaned is None:
        _bad("SUPABASE_SERVICE_ROLE_KEY is not set")
        _hint("Photo uploads require the *service_role* key. Get it from "
              "Supabase dashboard → Settings → API → Project API keys → "
              "service_role (NOT anon).")
        return None

    if raw != cleaned:
        _warn(
            f"Key had {len(raw) - len(cleaned)} byte(s) of whitespace / "
            f"surrounding quotes that got stripped."
        )
        _hint("This is fine at runtime but means your env file has a "
              "newline, leading/trailing space, or wrapping quotes you "
              "should clean up.")

    if not _looks_like_jwt(cleaned):
        _bad("Key does NOT look like a JWT (expected 3 base64-url parts).")
        _hint("Re-paste the service_role key from the dashboard. Make sure "
              "you copied the whole thing — JWTs are typically 200+ chars.")
        return None
    _ok(f"Key looks like a JWT (length {len(cleaned)})")

    payload = _decode_payload(cleaned)
    if payload is None:
        _bad("Couldn't decode JWT payload — key is corrupted.")
        return None

    role = payload.get("role")
    if role == "service_role":
        _ok("JWT role claim is 'service_role'")
    elif role == "anon":
        _bad("JWT role claim is 'anon' — this is the wrong key.")
        _hint("You pasted the *anon* key into SUPABASE_SERVICE_ROLE_KEY. "
              "RLS will block every server-side upload. Get the "
              "service_role key from the dashboard instead.")
        return None
    else:
        _bad(f"JWT role claim is {role!r} — expected 'service_role'.")
        return None

    iss = payload.get("iss")
    if iss:
        _ok(f"JWT issuer: {iss}")

    return cleaned


def check_url_key_match(url: str | None, key: str | None) -> None:
    """The JWT carries a `ref` claim that must match the project ref in the URL."""
    if not url or not key:
        return
    payload = _decode_payload(key) or {}
    ref = payload.get("ref")
    if not ref:
        _warn("JWT has no `ref` claim; can't verify URL/key project match.")
        return
    if ref in url:
        _ok(f"JWT `ref` claim ({ref}) matches the URL.")
    else:
        _bad(
            f"JWT `ref` claim is {ref!r} but URL is {url!r}. "
            "The key is for a different project."
        )
        _hint("Re-export the service_role key for the *current* project.")


def try_storage_call(url: str, key: str) -> None:
    """Attempt a real Supabase storage call so we see what the server says."""
    try:
        import httpx
    except Exception as e:
        _warn(f"httpx not installed; skipping live storage probe ({e}).")
        return

    target = url.rstrip("/") + "/storage/v1/bucket"
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(target, headers=headers)
    except Exception as e:
        _bad(f"HTTP request to /storage/v1/bucket failed: {e}")
        return

    if resp.status_code == 200:
        try:
            buckets = resp.json()
            names = [b.get("name") for b in buckets if isinstance(b, dict)]
        except Exception:
            names = []
        _ok(f"Storage call succeeded. Buckets visible: {names!r}")
        if "trip-media" not in names:
            _warn("Bucket 'trip-media' is missing from the project.")
            _hint("Create the bucket (Public) in the Supabase dashboard "
                  "before uploads can work.")
        if "Media" not in names and any(
            n and n.lower() == "media" for n in names
        ):
            _warn(
                "There is a bucket whose name differs from 'Media' only "
                "in case — case-mismatched bucket names will not match "
                "the read-side repair logic."
            )
        return

    _bad(f"Storage call failed: {resp.status_code} {resp.reason_phrase}")
    body = (resp.text or "").strip()
    if body:
        # Trim, never echo a JWT back to the operator's screen
        snippet = body[:300]
        _hint(f"Response body: {snippet}")
    if resp.status_code == 401:
        _hint("401 = the key was rejected. Most likely it's been rotated "
              "in Supabase since you last set the env var. Generate a new "
              "service_role key and update the env.")
    elif resp.status_code == 403:
        _hint("403 with a service_role key usually means the storage API "
              "is gated by additional Supabase IP rules. Check Project → "
              "Settings → API → Restrictions.")
    elif resp.status_code in (502, 503, 504):
        _hint("5xx from Supabase itself — try again in a minute.")


def main() -> int:
    _hr("TravelerHub — Storage Credentials Doctor")
    print(
        "Reads the same env vars supabase_client.py reads, applies the\n"
        "same cleaning + validation, and probes the real Supabase API.\n"
        "Run this on the production server when uploads return 503."
    )

    _hr("1. SUPABASE_URL")
    url = check_url()

    _hr("2. SUPABASE_SERVICE_ROLE_KEY")
    key = check_service_role_key()

    if url and key:
        _hr("3. URL and key match the same project?")
        check_url_key_match(url, key)

        _hr("4. Live storage probe")
        try_storage_call(url, key)

    _hr("Done")
    return 0 if (url and key) else 1


if __name__ == "__main__":
    sys.exit(main())
