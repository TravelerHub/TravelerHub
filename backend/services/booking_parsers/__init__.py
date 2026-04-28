"""
Deterministic vendor-aware parsers for booking confirmation emails / texts /
OCR'd screenshots.

Goal: take the *text* of a booking confirmation (extracted client-side via
Tesseract.js or pasted by the user) and turn it into a structured
`BookingCreate` payload — without any LLM.

How it works:
  1. `detect(text)` looks for vendor signatures (sender domain, header
     phrases, logo alt text) and returns a parser ID.
  2. The parser module is loaded lazily and called with the text.
  3. Each parser returns a dict matching `ParsedBooking` below; missing
     fields are left as None and the user fills them in the Save modal.
  4. If no vendor matches, `generic.py` runs a "best effort" extraction
     based on regex for dates, currency amounts, confirmation codes.

Adding a new vendor: drop a `vendors/<name>.py` file with two functions:
  - matches(text: str) -> bool     # called by detect()
  - parse(text: str) -> dict       # returns ParsedBooking-ish dict

Then register it in `_VENDORS` below.
"""

from __future__ import annotations

import logging
from typing import Optional, TypedDict

logger = logging.getLogger(__name__)


class ParsedBooking(TypedDict, total=False):
    """Subset of BookingCreate that any parser may surface. Unfilled fields
    are simply omitted; the frontend prefills what's there and asks the
    user for the rest."""

    type: str               # hotel | flight | car | activity | other
    title: str              # human-readable headline
    vendor: str             # "Booking.com", "Marriott", "United Airlines", ...
    confirmation_code: str
    start_time: str         # ISO 8601 (date-only acceptable: "YYYY-MM-DD")
    end_time: str
    cost: float
    currency: str
    notes: str
    # Free-form: anything else useful, JSON-serializable. Stored on the
    # booking row's `details` column.
    details: dict


# Registry maps a stable parser-id → module path. The registry order is
# the detection order — more specific vendors should come before more
# general ones to avoid false matches (e.g., "Booking.com" before
# "generic" so a confirmation that mentions Booking.com isn't caught by
# the generic regex first).
_VENDORS: list[tuple[str, str]] = [
    ("booking_com", "services.booking_parsers.vendors.booking_com"),
    ("airbnb",      "services.booking_parsers.vendors.airbnb"),
    ("marriott",    "services.booking_parsers.vendors.marriott"),
    ("united",      "services.booking_parsers.vendors.united"),
]


def _import(module_path: str):
    """Lazy import so a parser module with a syntax error doesn't break the
    whole registry."""
    import importlib
    return importlib.import_module(module_path)


def detect(text: str) -> Optional[str]:
    """Return the vendor id whose `matches()` claims this text, or None."""
    if not text:
        return None
    for vid, mod_path in _VENDORS:
        try:
            mod = _import(mod_path)
            if mod.matches(text):
                return vid
        except Exception as e:
            logger.warning("Parser %s.matches() crashed: %s", vid, e, exc_info=True)
            continue
    return None


def parse(text: str) -> dict:
    """Run the best-matching vendor parser, falling back to the generic one.

    Always returns a dict with at least `parser` (= vendor id or "generic")
    and `raw_text_excerpt` (first 240 chars, for debugging in the UI).
    Never raises — parser failures fall through to `generic`.
    """
    vid = detect(text)
    result: ParsedBooking = {}
    parser_used = "generic"

    if vid:
        try:
            mod = _import(_VENDORS[[v[0] for v in _VENDORS].index(vid)][1])
            result = mod.parse(text) or {}
            parser_used = vid
        except Exception as e:
            logger.warning("Parser %s.parse() crashed; falling back to generic: %s", vid, e, exc_info=True)

    if not result:
        try:
            generic = _import("services.booking_parsers.vendors.generic")
            result = generic.parse(text) or {}
            parser_used = "generic"
        except Exception as e:
            logger.error("Generic parser crashed on input: %s", e, exc_info=True)
            result = {}

    out: dict = dict(result)
    out["parser"] = parser_used
    out["raw_text_excerpt"] = (text or "")[:240]
    return out
