"""
Generic booking-confirmation parser. Used when no vendor-specific module
matches. Best-effort extraction of:
  - confirmation_code  (alphanumeric, 5–14 chars, near keywords like "code")
  - start_time         (first parseable date/time)
  - end_time           (second parseable date/time, if any)
  - cost + currency    (largest currency-prefixed number we find)
  - title              (best guess: line containing "Hotel", "Flight",
                        "Reservation", or the first long line)

Pure regex / string ops. No external libraries beyond stdlib. No AI.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional


# ── Confirmation code ────────────────────────────────────────────────────────
# Look for "Confirmation #ABC123", "Booking ID: ...", "Reference: ...", etc.
# Codes tend to be 5–14 chars, uppercase letters + digits + dashes.
# `(?!\w)` after the keyword keeps "confirmed", "bookings", etc. from being
# mistakenly treated as the keyword and capturing the rest of the word as
# the code.
_CODE_RE = re.compile(
    r"\b(?:confirmation|reservation|booking|reference|record\s+locator|pnr)(?!\w)"
    r"\s*(?:number|no\.?|id|#)?\s*[:#]?\s*"
    r"([A-Z0-9][A-Z0-9\-]{4,14})\b",
    re.IGNORECASE,
)


def _extract_confirmation_code(text: str) -> Optional[str]:
    m = _CODE_RE.search(text)
    if not m:
        return None
    code = m.group(1).upper().strip("-")
    # Reject things that look like a date (`2026-04-30`) or a phone number.
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", code):
        return None
    if re.fullmatch(r"\d{7,14}", code) and "-" not in code:
        # Plain digit runs are likely phone numbers, not confirmations.
        return None
    return code


# ── Dates ────────────────────────────────────────────────────────────────────
# Several formats users routinely paste in:
#   "Aug 1, 2026"           -> Aug 01 2026
#   "August 1, 2026 3:00 PM"
#   "2026-08-01 15:00"
#   "08/01/2026"            (US-only assumption — see comment below)
#   "1 Aug 2026"            (international / Booking.com)
_DATE_FORMATS = [
    "%B %d, %Y %I:%M %p", "%B %d, %Y",
    "%b %d, %Y %I:%M %p", "%b %d, %Y",
    "%Y-%m-%dT%H:%M:%S",  "%Y-%m-%d %H:%M", "%Y-%m-%d",
    "%m/%d/%Y %I:%M %p", "%m/%d/%Y",
    "%d %B %Y %H:%M",    "%d %B %Y",
    "%d %b %Y %H:%M",    "%d %b %Y",
]

# Wide-net date matcher — captures common shapes; we run strptime() on each
# candidate to confirm it's actually parseable.
_DATE_CANDIDATE_RE = re.compile(
    r"(?:(?:[A-Za-z]+ \d{1,2},? \d{4}(?:[ ,]+\d{1,2}:\d{2}(?:\s?[APMapm]{2})?)?)"
    r"|(?:\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?)"
    r"|(?:\d{1,2}/\d{1,2}/\d{4}(?:\s+\d{1,2}:\d{2}\s?[APMapm]{2})?)"
    r"|(?:\d{1,2}\s+[A-Za-z]+\s+\d{4}(?:\s+\d{1,2}:\d{2})?)"
    r")"
)


def _parse_one_date(s: str) -> Optional[datetime]:
    s = s.strip().rstrip(",")
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _extract_dates(text: str) -> list[datetime]:
    """Return parsed datetimes in the order they appear, deduped within the
    same calendar minute (so the same date written twice doesn't both count)."""
    out: list[datetime] = []
    seen: set[str] = set()
    for m in _DATE_CANDIDATE_RE.finditer(text):
        dt = _parse_one_date(m.group(0))
        if not dt:
            continue
        key = dt.strftime("%Y-%m-%dT%H:%M")
        if key in seen:
            continue
        seen.add(key)
        out.append(dt)
    return out


# ── Money ────────────────────────────────────────────────────────────────────
# "$1,250.00", "USD 250", "€420.50", "£99.95", "1,250 USD"
_PRICE_RE = re.compile(
    r"(?:(?P<sym>\$|€|£|¥)\s?(?P<amt1>\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?))"
    r"|(?:(?P<cur>USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY)\s?(?P<amt2>\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?))"
    r"|(?:(?P<amt3>\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s?(?P<cur2>USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY))",
    re.IGNORECASE,
)

_SYM_TO_CUR = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}


def _extract_largest_price(text: str) -> tuple[Optional[float], Optional[str]]:
    """Return (amount, currency) for the largest detected price.

    Confirmation emails routinely list per-night prices and totals;
    the *total* is what we want to record, and it's almost always the
    largest number. Coarse but works."""
    best: tuple[float, str] = (-1.0, "USD")
    found = False
    for m in _PRICE_RE.finditer(text):
        amt_str = m.group("amt1") or m.group("amt2") or m.group("amt3")
        if not amt_str:
            continue
        try:
            amt = float(amt_str.replace(",", ""))
        except ValueError:
            continue
        sym = m.group("sym")
        cur = (m.group("cur") or m.group("cur2") or _SYM_TO_CUR.get(sym, "USD")).upper()
        if amt > best[0]:
            best = (amt, cur)
            found = True
    return (best[0], best[1]) if found else (None, None)


# ── Title / type heuristics ─────────────────────────────────────────────────
_TYPE_KEYWORDS = [
    ("flight",    [r"\bflight\b", r"\bdeparture\b", r"\bboarding\b", r"\bairline\b", r"\bgate\b"]),
    ("hotel",     [r"\bhotel\b", r"\bcheck[- ]?in\b", r"\bcheck[- ]?out\b", r"\broom rate\b", r"\bnightly\b"]),
    ("car",       [r"\brental\s+car\b", r"\bpick[- ]?up\b.+\bdrop[- ]?off\b", r"\bvehicle\b"]),
    ("activity",  [r"\btour\b", r"\bticket\b", r"\badmission\b", r"\bentry\b"]),
]


def _guess_type(text: str) -> str:
    lowered = text.lower()
    for ttype, patterns in _TYPE_KEYWORDS:
        for p in patterns:
            if re.search(p, lowered):
                return ttype
    return "other"


def _guess_title(text: str, type_: str) -> Optional[str]:
    # Prefer the first non-empty line that contains the type keyword.
    keywords = {
        "hotel":   ["hotel", "inn", "resort", "lodge", "suite"],
        "flight":  ["flight", "airline", "boarding"],
        "car":     ["rental", "vehicle"],
        "activity":["tour", "ticket", "experience"],
    }.get(type_, [])
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for line in lines:
        low = line.lower()
        if any(k in low for k in keywords) and 5 <= len(line) <= 80:
            return line
    # Fallback: the first reasonably long line.
    for line in lines:
        if 10 <= len(line) <= 80:
            return line
    return None


# ── Main entry ──────────────────────────────────────────────────────────────

def matches(text: str) -> bool:
    """Generic always matches (it's the fallback). Registry never asks
    generic via detect(); it's invoked directly by parse()."""
    return True


def parse(text: str) -> dict:
    if not text:
        return {}

    code = _extract_confirmation_code(text)
    dates = _extract_dates(text)
    price, currency = _extract_largest_price(text)
    type_ = _guess_type(text)
    title = _guess_title(text, type_)

    out: dict = {"type": type_}
    if title:
        out["title"] = title
    if code:
        out["confirmation_code"] = code
    if dates:
        out["start_time"] = dates[0].isoformat()
        if len(dates) >= 2:
            out["end_time"] = dates[1].isoformat()
    if price is not None:
        out["cost"] = price
        out["currency"] = currency or "USD"
    return out
