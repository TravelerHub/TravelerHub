"""
Airbnb reservation confirmation parser.

Airbnb confirmations have an opinionated layout:
  Subject: "<host name> confirmed your reservation"
  Confirmation code: HMXXXXXXXX (alphanumeric, starts with HM)
  Check-in:  <DAY> <MMM> <D>, <YYYY> after <h:mm AM/PM>
  Checkout:  <DAY> <MMM> <D>, <YYYY> before <h:mm AM/PM>
  Total:     $<amount>
"""

from __future__ import annotations

import re
from urllib.parse import urlparse
from datetime import datetime
from typing import Optional


_CONF_RE = re.compile(r"\b(HM[A-Z0-9]{6,12})\b")  # Airbnb codes
_BRAND_RE = re.compile(r"\bairbnb\b", re.IGNORECASE)
_PROPERTY_RE = re.compile(
    r"(?:reservation\s+at|your\s+stay\s+at|home\s+at)\s+([^\n\r]{3,80})",
    re.IGNORECASE,
)
_URL_RE = re.compile(r"https?://[^\s)]+", re.IGNORECASE)
_DATE_RE = re.compile(
    r"(?:Check[- ]?in|Check[- ]?out|Arrive|Depart)\s*[:]?\s*"
    r"(?:\w+,?\s+)?"                                       # optional weekday
    r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})"                # Aug 1 2026
    r"(?:\s+(?:after|before|at)\s+(\d{1,2}):(\d{2})\s*(AM|PM))?",
    re.IGNORECASE,
)
_PRICE_RE = re.compile(
    r"(?:total|grand\s+total|charged)\s*[:]?\s*"
    r"(?:(?P<sym>[$€£¥])\s?(?P<amt1>\d{1,3}(?:,\d{3})*(?:\.\d{2})?)"
    r"|(?P<cur>USD|EUR|GBP|JPY)\s?(?P<amt2>\d{1,3}(?:,\d{3})*(?:\.\d{2})?))",
    re.IGNORECASE,
)
_SYM_TO_CUR = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}


def matches(text: str) -> bool:
    if not text:
        return False
    has_brand = bool(_BRAND_RE.search(text)) or _has_domain(text, "airbnb.com")
    has_code = bool(_CONF_RE.search(text))
    return has_brand and has_code


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


def _parse_date(m: re.Match) -> Optional[datetime]:
    month_name, day, year = m.group(1), m.group(2), m.group(3)
    hour, minute, ampm = m.group(4), m.group(5), m.group(6)
    base = f"{month_name} {day} {year}"
    fmts_no_time = ["%b %d %Y", "%B %d %Y"]
    if hour and minute and ampm:
        full = f"{base} {hour}:{minute} {ampm.upper()}"
        for fmt in ["%b %d %Y %I:%M %p", "%B %d %Y %I:%M %p"]:
            try:
                return datetime.strptime(full, fmt)
            except ValueError:
                continue
    for fmt in fmts_no_time:
        try:
            return datetime.strptime(base, fmt)
        except ValueError:
            continue
    return None


def parse(text: str) -> dict:
    out: dict = {
        "type": "hotel",       # Airbnb maps to lodging in our schema
        "vendor": "Airbnb",
    }

    prop_m = _PROPERTY_RE.search(text)
    if prop_m:
        out["title"] = prop_m.group(1).strip().rstrip(".")

    code_m = _CONF_RE.search(text)
    if code_m:
        out["confirmation_code"] = code_m.group(1)

    dates: list[datetime] = []
    for m in _DATE_RE.finditer(text):
        dt = _parse_date(m)
        if dt:
            dates.append(dt)
    if dates:
        out["start_time"] = dates[0].isoformat()
        if len(dates) >= 2:
            out["end_time"] = dates[1].isoformat()

    price_m = _PRICE_RE.search(text)
    if price_m:
        amt_raw = price_m.group("amt1") or price_m.group("amt2")
        if amt_raw:
            try:
                out["cost"] = float(amt_raw.replace(",", ""))
            except ValueError:
                pass
            sym = price_m.group("sym")
            cur = price_m.group("cur") or _SYM_TO_CUR.get(sym, "USD")
            out["currency"] = cur.upper()

    return out
