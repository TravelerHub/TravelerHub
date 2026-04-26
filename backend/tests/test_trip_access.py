"""Tests for the shared trip-membership guard used by gallery, media-comments,
and activity routers. Mirrors the activity-feed membership test by exercising
the helper directly with a mocked Supabase client.
"""
import os
import sys
import asyncio
from unittest.mock import patch

import pytest

# Provide fake Supabase env so supabase_client import works under the test runner.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-anon-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException

from utils.trip_access import require_trip_member, require_trip_member_sync


class _Result:
    def __init__(self, data):
        self.data = data


def _patch_async(member_data, owner_data):
    """Build an async_safe_single replacement that returns member then owner result."""
    calls = {"n": 0}

    async def fake(query_builder):
        calls["n"] += 1
        if calls["n"] == 1:
            return _Result(member_data)
        return _Result(owner_data)

    return fake


def _patch_sync(member_data, owner_data):
    calls = {"n": 0}

    def fake(query_builder):
        calls["n"] += 1
        if calls["n"] == 1:
            return _Result(member_data)
        return _Result(owner_data)

    return fake


# ── async helper ─────────────────────────────────────────────────────────────

def test_require_trip_member_allows_active_member():
    """A user with an unleft trip_members row is allowed."""
    with patch("utils.trip_access.async_safe_single", _patch_async({"id": "m1"}, None)), \
         patch("utils.trip_access.supabase"):
        # No exception means pass.
        asyncio.run(require_trip_member("trip-1", "user-1"))


def test_require_trip_member_allows_owner_when_not_member_row():
    """When trip_members has no row but the user owns the trip, allow."""
    with patch("utils.trip_access.async_safe_single", _patch_async(None, {"id": "trip-1"})), \
         patch("utils.trip_access.supabase"):
        asyncio.run(require_trip_member("trip-1", "owner-1"))


def test_require_trip_member_rejects_outsider():
    """A user who is neither a member nor an owner gets 403."""
    with patch("utils.trip_access.async_safe_single", _patch_async(None, None)), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(require_trip_member("trip-1", "stranger"))
        assert exc.value.status_code == 403
        assert "member" in exc.value.detail.lower()


# ── sync helper ──────────────────────────────────────────────────────────────

def test_require_trip_member_sync_allows_active_member():
    with patch("utils.trip_access.safe_single", _patch_sync({"id": "m1"}, None)), \
         patch("utils.trip_access.supabase"):
        require_trip_member_sync("trip-1", "user-1")


def test_require_trip_member_sync_allows_owner():
    with patch("utils.trip_access.safe_single", _patch_sync(None, {"id": "trip-1"})), \
         patch("utils.trip_access.supabase"):
        require_trip_member_sync("trip-1", "owner-1")


def test_require_trip_member_sync_rejects_outsider():
    with patch("utils.trip_access.safe_single", _patch_sync(None, None)), \
         patch("utils.trip_access.supabase"):
        with pytest.raises(HTTPException) as exc:
            require_trip_member_sync("trip-1", "stranger")
        assert exc.value.status_code == 403
