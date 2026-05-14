"""
Booking.com confirmation email parser.

Confirmations from Booking.com follow a predictable layout:
  Subject: "Booking confirmation for <hotel name>"
  Confirmation number: <10 digit number>
  PIN code: <4 digit>
  Check-in:  <Day, DD Month YYYY> from <HH:MM>
  Check-out: <Day, DD Month YYYY> until <HH:MM>
  Total price: <symbol> <amount>

We anchor on the "booking.com" domain reference + the confirmation-number
shape (10 digits, distinctive) before claiming a match.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse
from datetime import datetime
from typing import Optional


_DATE_RE = re.compile(
    r"(?:\w+,\s+)?"                          # optional weekday
    r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})"     # 4 August 2026
    r"(?:\s+(?:from|until|at)\s+(\d{1,2}):(\d{2}))?",
    re.IGNORECASE,
)

_CONF_RE = re.compile(r"confirmation\s*number\s*[:#]?\s*(\d{10})", re.IGNORECASE)
_HOTEL_RE = re.compile(r"(?:booking\s+confirmation\s+for|your\s+booking\s+at)\s+([^\n\r]{3,80})", re.IGNORECASE)
_PRICE_RE = re.compile(
    r"total\s+price\s*[:]?\s*"
    r"(?:(?P<sym>[$€£¥])\s?(?P<amt1>\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})?)"
    r"|(?P<cur>USD|EUR|GBP|JPY)\s?(?P<amt2>\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})?))",
    re.IGNORECASE,
)
_SYM_TO_CUR = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}
_URL_RE = re.compile(r"https?://[^\s)]+", re.IGNORECASE)


def matches(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    has_brand = (
        _has_domain(text, "booking.com")
        or "booking.com" in lowered
        or ("booking confirmation" in lowered and "your stay" in lowered)
    )
    return has_brand and bool(_CONF_RE.search(text))


def _has_domain(text: str, domain: str) -> bool:
    for match in _URL_RE.findall(text):
        try:
            host = urlparse(match).hostname or ""
        except ValueError:
            continue
        host = host.lower()
        if host == domain or host.endswith(f".{domain}"):
            return True
    return False


def _parse_date_match(m: re.Match) -> Optional[datetime]:
    day, month_name, year = m.group(1), m.group(2), m.group(3)
    hour = m.group(4)
    minute = m.group(5)
    parts = f"{day} {month_name} {year}"
    fmts_no_time = ["%d %B %Y", "%d %b %Y"]
    fmts_with_time = ["%d %B %Y %H:%M", "%d %b %Y %H:%M"]
    if hour and minute:
        full = f"{parts} {hour}:{minute}"
        for fmt in fmts_with_time:
            try:
                return datetime.strptime(full, fmt)
            except ValueError:
                continue
    for fmt in fmts_no_time:
        try:
            return datetime.strptime(parts, fmt)
        except ValueError:
            continue
    return None


def parse(text: str) -> dict:
    out: dict = {
        "type": "hotel",
        "vendor": "Booking.com",
    }

    hotel_m = _HOTEL_RE.search(text)
    if hotel_m:
        out["title"] = hotel_m.group(1).strip().rstrip(".")

    conf_m = _CONF_RE.search(text)
    if conf_m:
        out["confirmation_code"] = conf_m.group(1)

    # Walk every "from/until/at" date — the first that pairs with "check-in"
    # nearby is the start, the next "check-out" is the end. Simpler: take
    # the first two parseable dates in document order.
    parsed_dates: list[datetime] = []
    for m in _DATE_RE.finditer(text):
        dt = _parse_date_match(m)
        if dt:
            parsed_dates.append(dt)
    if parsed_dates:
        out["start_time"] = parsed_dates[0].isoformat()
        if len(parsed_dates) >= 2:
            out["end_time"] = parsed_dates[1].isoformat()

    price_m = _PRICE_RE.search(text)
    if price_m:
        amt_raw = price_m.group("amt1") or price_m.group("amt2")
        if amt_raw:
            # Booking.com mixes EU + US number formats; normalize to dot decimal.
            cleaned = amt_raw.replace(",", "") if amt_raw.count(",") <= 1 else amt_raw.replace(".", "").replace(",", ".")
            try:
                out["cost"] = float(cleaned)
            except ValueError:
                pass
            sym = price_m.group("sym")
            cur = price_m.group("cur") or _SYM_TO_CUR.get(sym, "USD")
            out["currency"] = cur.upper()

    return out
