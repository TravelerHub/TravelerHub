"""
United Airlines confirmation parser. The same extraction shape works
reasonably well for Delta, American, Alaska, Southwest, JetBlue —
they all surface a "Confirmation #" / "Record locator" + flight legs
with city pairs + dates. Brand-detection narrows it to United for now;
sister vendors can be added by extending `_BRAND_HINTS`.

Extracts:
  - title:           "United UA 123 (LAX → JFK)"
  - confirmation:    6-character record locator (PNR)
  - start_time:      first leg departure
  - end_time:        last leg arrival (best-effort)
  - cost / currency: ticket total
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional


_BRAND_HINTS = ("united.com", "united airlines", "ualflights")
_PNR_RE = re.compile(
    r"(?:confirmation\s*(?:number|code)?|record\s+locator|pnr)\s*[:#]?\s*"
    r"([A-Z0-9]{5,7})",
    re.IGNORECASE,
)
# "UA 123" / "UA123" / "United Flight 123"
_FLIGHT_NO_RE = re.compile(
    r"\b(?:UA|UAL|United\s+Flight)\s*[:#]?\s*(\d{1,4})\b",
    re.IGNORECASE,
)
# Three-letter IATA pair like "LAX → JFK" or "LAX-JFK" or "LAX to JFK"
_LEG_RE = re.compile(
    r"\b([A-Z]{3})\s*(?:→|->|–|-|to)\s*([A-Z]{3})\b",
)
_DATE_RE = re.compile(
    r"(?:Departing|Arriving|Departure|Arrival|Depart|Arrive)\s*[:]?\s*"
    r"(?:\w+,?\s+)?"
    r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})"
    r"(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?",
    re.IGNORECASE,
)
_PRICE_RE = re.compile(
    r"(?:total|grand\s+total|amount\s+charged|fare)\s*[:]?\s*"
    r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
    re.IGNORECASE,
)


def matches(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    has_brand = any(h in lowered for h in _BRAND_HINTS)
    has_pnr = bool(_PNR_RE.search(text))
    return has_brand and has_pnr


def _parse_date(m: re.Match) -> Optional[datetime]:
    month_name, day, year = m.group(1), m.group(2), m.group(3)
    hour, minute, ampm = m.group(4), m.group(5), m.group(6)
    base = f"{month_name} {day} {year}"
    if hour and minute and ampm:
        full = f"{base} {hour}:{minute} {ampm.upper()}"
        for fmt in ["%b %d %Y %I:%M %p", "%B %d %Y %I:%M %p"]:
            try:
                return datetime.strptime(full, fmt)
            except ValueError:
                continue
    for fmt in ["%b %d %Y", "%B %d %Y"]:
        try:
            return datetime.strptime(base, fmt)
        except ValueError:
            continue
    return None


def parse(text: str) -> dict:
    out: dict = {
        "type": "flight",
        "vendor": "United Airlines",
    }

    pnr_m = _PNR_RE.search(text)
    if pnr_m:
        out["confirmation_code"] = pnr_m.group(1).upper()

    flight_no_m = _FLIGHT_NO_RE.search(text)
    leg_m = _LEG_RE.search(text)
    if flight_no_m and leg_m:
        out["title"] = f"United UA {flight_no_m.group(1)} ({leg_m.group(1)} → {leg_m.group(2)})"
    elif flight_no_m:
        out["title"] = f"United UA {flight_no_m.group(1)}"
    elif leg_m:
        out["title"] = f"United Airlines ({leg_m.group(1)} → {leg_m.group(2)})"

    dates: list[datetime] = []
    for m in _DATE_RE.finditer(text):
        dt = _parse_date(m)
        if dt:
            dates.append(dt)
    if dates:
        out["start_time"] = dates[0].isoformat()
        if len(dates) >= 2:
            # last in document order = final arrival for return / multi-leg trips
            out["end_time"] = dates[-1].isoformat()

    price_m = _PRICE_RE.search(text)
    if price_m:
        try:
            out["cost"] = float(price_m.group(1).replace(",", ""))
            out["currency"] = "USD"
        except ValueError:
            pass

    return out
