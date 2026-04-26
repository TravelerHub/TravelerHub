"""Tests that the trip-membership guard is enforced on gallery and
media-comments endpoints. Mirrors the activity-feed test pattern: a
non-member must get 403, a member must succeed.

We invoke the FastAPI route functions directly so we don't need an HTTP
client or a real Supabase backend — only the guard's database calls are
mocked.
"""
import os
import sys
import asyncio
from unittest.mock import patch, MagicMock

import pytest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-anon-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException
from starlette.requests import Request

from routers import gallery, media_comments


class _Result:
    def __init__(self, data):
        self.data = data


# ── helpers ──────────────────────────────────────────────────────────────────

def _async_member_present():
    async def fake(qb):
        return _Result({"id": "m1"})
    return fake


def _async_no_membership():
    async def fake(qb):
        return _Result(None)
    return fake


def _sync_member_present():
    def fake(qb):
        return _Result({"id": "m1"})
    return fake


def _sync_no_membership():
    def fake(qb):
        return _Result(None)
    return fake


def _stub_request():
    """Build a real starlette Request that bypasses slowapi's rate limiter.

    The decorated handlers go through `Limiter.__call__`, which checks
    `request.app.state.limiter.enabled`. We construct an ASGI scope with an
    app that has a disabled limiter on its state.
    """
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, enabled=False)
    app = MagicMock()
    app.state.limiter = limiter

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "http_version": "1.1",
        "app": app,
        "root_path": "",
    }
    return Request(scope)


# ── gallery: GET /trips/{trip_id}/media ──────────────────────────────────────

def test_get_trip_media_rejects_non_member():
    user = {"id": "stranger"}
    with patch("utils.trip_access.async_safe_single", _async_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(gallery.get_trip_media(
                request=_stub_request(),
                trip_id="trip-1",
                limit=20,
                cursor=None,
                current_user=user,
            ))
        assert exc.value.status_code == 403


def test_get_trip_media_allows_member():
    user = {"id": "u1"}

    captured = {}

    class _FakeQuery:
        def select(self, *_a, **_kw): return self
        def eq(self, *_a, **_kw): return self
        def lt(self, *_a, **_kw): return self
        def in_(self, *_a, **_kw): return self
        def order(self, *_a, **_kw): return self
        def limit(self, *_a, **_kw): return self
        def execute(self):
            captured["called"] = True
            return _Result([])

    fake_supabase = MagicMock()
    fake_supabase.table.return_value = _FakeQuery()

    with patch("utils.trip_access.async_safe_single", _async_member_present()), \
         patch("utils.trip_access.supabase"), \
         patch("routers.gallery.supabase", fake_supabase):
        result = asyncio.run(gallery.get_trip_media(
            request=_stub_request(),
            trip_id="trip-1",
            limit=20,
            cursor=None,
            current_user=user,
        ))
        assert "photos" in result
        assert captured.get("called") is True


# ── gallery: POST /trips/{trip_id}/media/{id}/like ───────────────────────────

def test_toggle_like_rejects_non_member():
    user = {"id": "stranger"}
    with patch("utils.trip_access.async_safe_single", _async_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(gallery.toggle_like(
                request=_stub_request(),
                trip_id="trip-1",
                media_id="m1",
                current_user=user,
            ))
        assert exc.value.status_code == 403


# ── gallery: POST /trips/{trip_id}/media/{id}/save ───────────────────────────

def test_toggle_save_rejects_non_member():
    user = {"id": "stranger"}
    with patch("utils.trip_access.async_safe_single", _async_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(gallery.toggle_save(
                request=_stub_request(),
                trip_id="trip-1",
                media_id="m1",
                current_user=user,
            ))
        assert exc.value.status_code == 403


# ── gallery: GET /trips/{trip_id}/media/grouped ──────────────────────────────

def test_get_trip_media_grouped_rejects_non_member():
    user = {"id": "stranger"}
    with patch("utils.trip_access.async_safe_single", _async_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(gallery.get_trip_media_grouped(
                request=_stub_request(),
                trip_id="trip-1",
                current_user=user,
            ))
        # The handler wraps unexpected exceptions in 500; HTTPException(403)
        # should propagate as-is.
        assert exc.value.status_code == 403


# ── gallery: POST /trips/{trip_id}/upload ────────────────────────────────────

def test_upload_trip_media_rejects_non_member():
    user = {"id": "stranger"}
    fake_file = MagicMock()
    fake_file.content_type = "image/jpeg"
    fake_file.filename = "x.jpg"
    with patch("utils.trip_access.async_safe_single", _async_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(gallery.upload_trip_media(
                request=_stub_request(),
                trip_id="trip-1",
                file=fake_file,
                caption=None,
                current_user=user,
            ))
        assert exc.value.status_code == 403


# ── media_comments: POST / ───────────────────────────────────────────────────

def test_add_comment_rejects_non_member():
    body = media_comments.CommentCreate(media_id="m1", trip_id="trip-1", body="hi")
    user = {"id": "stranger"}
    with patch("utils.trip_access.safe_single", _sync_no_membership()), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            media_comments.add_comment(body=body, current_user=user)
        assert exc.value.status_code == 403


def test_add_comment_allows_member():
    body = media_comments.CommentCreate(media_id="m1", trip_id="trip-1", body="hi")
    user = {"id": "u1"}

    class _Insert:
        def insert(self, *_a, **_kw): return self
        def execute(self):
            return _Result([{"id": "c1", "body": "hi"}])

    fake_supabase = MagicMock()
    fake_supabase.table.return_value = _Insert()

    with patch("utils.trip_access.safe_single", _sync_member_present()), \
         patch("utils.trip_access.supabase"), \
         patch("routers.media_comments.supabase", fake_supabase):
        result = media_comments.add_comment(body=body, current_user=user)
        assert result["id"] == "c1"
