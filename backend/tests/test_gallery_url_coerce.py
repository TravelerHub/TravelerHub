"""
Tests for `_coerce_public_url` and `_add_image_variants` repair path —
the gallery's defense against supabase-py's get_public_url returning
inconsistent shapes across versions.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# These imports trigger supabase client init which requires env vars; stub
# them before importing the router.
os.environ.setdefault("VITE_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("VITE_SUPABASE_ANON_KEY", "stub-anon-key")

from routers.gallery import _coerce_public_url, _add_image_variants  # noqa: E402


def test_string_url_passes_through():
    out = _coerce_public_url(
        "https://example.supabase.co/storage/v1/object/public/trip-media/abc.jpg",
        "abc.jpg",
    )
    assert out == "https://example.supabase.co/storage/v1/object/public/trip-media/abc.jpg"


def test_trailing_question_mark_stripped():
    out = _coerce_public_url(
        "https://example.supabase.co/storage/v1/object/public/trip-media/abc.jpg?",
        "abc.jpg",
    )
    assert not out.endswith("?")


def test_dict_with_publicUrl_extracted():
    out = _coerce_public_url(
        {"publicUrl": "https://example.supabase.co/storage/v1/object/public/trip-media/x.png"},
        "x.png",
    )
    assert out == "https://example.supabase.co/storage/v1/object/public/trip-media/x.png"


def test_dict_with_publicURL_camelcase():
    out = _coerce_public_url(
        {"publicURL": "https://example.supabase.co/storage/v1/object/public/trip-media/y.png"},
        "y.png",
    )
    assert out.endswith("/y.png")


def test_dict_with_signedURL():
    out = _coerce_public_url(
        {"signedURL": "https://example.supabase.co/storage/v1/sign/trip-media/z.png?token=abc"},
        "z.png",
    )
    assert "trip-media/z.png" in out


def test_nested_data_publicUrl():
    out = _coerce_public_url(
        {"data": {"publicUrl": "https://example.supabase.co/storage/v1/object/public/trip-media/n.png"}},
        "n.png",
    )
    assert out.endswith("/n.png")


def test_unknown_shape_falls_back_to_canonical():
    """When the client returns something we can't unpack, build the URL ourselves."""
    out = _coerce_public_url({"weird": "shape"}, "trip-id/abc.jpg")
    assert out == (
        "https://example.supabase.co/storage/v1/object/public/trip-media/trip-id/abc.jpg"
    )


def test_none_falls_back_to_canonical():
    out = _coerce_public_url(None, "fallback.jpg")
    assert "/storage/v1/object/public/trip-media/fallback.jpg" in out


def test_add_image_variants_repairs_dict_blob():
    """Existing DB rows storing a JSON-stringified dict get rebuilt on read."""
    photo = {
        "public_url": '{"data":{"publicUrl":"https://example.supabase.co/storage/v1/object/public/trip-media/old.jpg"}}',
        "storage_path": "trip-1/old.jpg",
    }
    out = _add_image_variants(photo)
    assert "supabase" in out["public_url"]
    assert out["public_url"].endswith("/trip-1/old.jpg")
    assert out["thumbnail_url"].startswith(out["public_url"])


def test_add_image_variants_strips_trailing_question_mark():
    photo = {
        "public_url": "https://example.supabase.co/storage/v1/object/public/trip-media/a.jpg?",
        "storage_path": "a.jpg",
    }
    out = _add_image_variants(photo)
    assert out["public_url"] == "https://example.supabase.co/storage/v1/object/public/trip-media/a.jpg"
    assert "?width=300" in out["thumbnail_url"]


def test_add_image_variants_leaves_clean_url_alone():
    photo = {
        "public_url": "https://example.supabase.co/storage/v1/object/public/trip-media/a.jpg",
        "storage_path": "a.jpg",
    }
    out = _add_image_variants(photo)
    assert out["public_url"] == "https://example.supabase.co/storage/v1/object/public/trip-media/a.jpg"
    assert out["thumbnail_url"].endswith("?width=300&quality=60&resize=cover")


def test_add_image_variants_repairs_old_media_bucket_row():
    """Rows uploaded back when gallery.py used the 'Media' bucket should
    repair to point at /Media/, not the current /trip-media/."""
    photo = {
        "public_url": (
            '{"data":{"publicUrl":'
            '"https://example.supabase.co/storage/v1/object/public/Media/old-trip/x.jpg"}}'
        ),
        "storage_path": "old-trip/x.jpg",
    }
    out = _add_image_variants(photo)
    assert "/public/Media/old-trip/x.jpg" in out["public_url"]
    assert "/public/trip-media/" not in out["public_url"]


def test_add_image_variants_unknown_blob_falls_back_to_default():
    """Malformed string with no recognizable bucket falls back to
    the currently-configured default bucket."""
    photo = {
        "public_url": '{"weird": "shape"}',
        "storage_path": "trip-1/b.jpg",
    }
    out = _add_image_variants(photo)
    assert "/public/trip-media/trip-1/b.jpg" in out["public_url"]


def test_add_image_variants_rejects_junk_bucket_name():
    """If the malformed blob has something that smells like a bucket
    name but contains junk characters, fall back to the default."""
    photo = {
        "public_url": (
            '{"publicUrl":'
            '"https://x/storage/v1/object/public/some bucket with spaces!/file"}'
        ),
        "storage_path": "trip-1/c.jpg",
    }
    out = _add_image_variants(photo)
    assert "/public/trip-media/trip-1/c.jpg" in out["public_url"]
