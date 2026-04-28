"""
Marriott / Marriott Bonvoy confirmation email parser.

Marriott confirmations carry:
  - Confirmation Number: 9-digit
  - "Marriott", "Bonvoy", or specific brand names (Courtyard, Westin, ...)
  - Arrival / Departure dates in "Day, Month DD, YYYY" format
  - Room rate + total in $XXX.XX
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional


_BRAND_HINTS = (
    "marriott", "bonvoy", "courtyard", "westin", "ritz-carlton",
    "sheraton", "le méridien", "le meridien", "renaissance", "ac hotels",
    "fairfield", "residence inn", "springhill suites", "townplace suites",
    "moxy", "element hotels", "delta hotels", "tribute portfolio",
    "autograph collection", "jw marriott", "w hotels", "aloft",
)

_CONF_RE = re.compile(
    r"(?:confirmation|conf\.?)\s*(?:number|no\.?|#)?\s*[:#]?\s*(\d{8,10})",
    re.IGNORECASE,
)
# Tries to grab the hotel's marketing name. Looks for one of the well-known
# brand keywords and pulls the surrounding tokens on the same line. The
# character class avoids the regex-engine-confusing `\s` next to a `-` that
# python's `re` interprets as a range.
_HOTEL_RE = re.compile(
    r"^\s*((?:[A-Z][\w'.\-]*\s*){1,6}"
    r"(?:Marriott|Bonvoy|Courtyard|Westin|Ritz-Carlton|"
    r"Sheraton|Renaissance|Fairfield|Residence\s+Inn|JW\s+Marriott|W\s+Hotels|Aloft|Moxy)"
    r"(?:[\w'.\- ]{0,40}))",
    re.MULTILINE,
)
_DATE_RE = re.compile(
    r"(?:Arrival|Departure|Check[- ]?in|Check[- ]?out)\s*[:]?\s*"
    r"(?:\w+,?\s+)?"
    r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})",
    re.IGNORECASE,
)
_PRICE_RE = re.compile(
    r"(?:total|grand\s+total|estimated\s+total|amount\s+due)\s*[:]?\s*"
    r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)


def matches(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    has_brand = any(h in lowered for h in _BRAND_HINTS)
    return has_brand and bool(_CONF_RE.search(text))


def _parse_date(month_name: str, day: str, year: str) -> Optional[datetime]:
    base = f"{month_name} {day} {year}"
    for fmt in ["%B %d %Y", "%b %d %Y"]:
        try:
            return datetime.strptime(base, fmt)
        except ValueError:
            continue
    return None


def parse(text: str) -> dict:
    out: dict = {
        "type": "hotel",
        "vendor": "Marriott",
    }

    hotel_m = _HOTEL_RE.search(text)
    if hotel_m:
        out["title"] = hotel_m.group(1).strip()

    conf_m = _CONF_RE.search(text)
    if conf_m:
        out["confirmation_code"] = conf_m.group(1)

    dates: list[datetime] = []
    for m in _DATE_RE.finditer(text):
        dt = _parse_date(m.group(1), m.group(2), m.group(3))
        if dt:
            dates.append(dt)
    if dates:
        out["start_time"] = dates[0].isoformat()
        if len(dates) >= 2:
            out["end_time"] = dates[1].isoformat()

    price_m = _PRICE_RE.search(text)
    if price_m:
        try:
            out["cost"] = float(price_m.group(1).replace(",", ""))
            out["currency"] = "USD"
        except ValueError:
            pass

    return out
