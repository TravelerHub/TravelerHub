"""
Tests for the deterministic booking parsers.

Real-shape fixtures (slightly redacted) so we know the regex actually
matches against text users will paste in. Each parser has:
  - a "matches" test (its `matches()` claims this text)
  - a "doesn't match" test (it doesn't claim other vendors' text)
  - a "fields extracted" test (the structured payload looks right)
"""

from services.booking_parsers import parse as parse_booking, detect


# ── Fixtures (real shapes, no PII) ─────────────────────────────────────────────

BOOKING_COM_HOTEL = """\
From: customer.service@booking.com
Subject: Booking confirmation for Hotel Le Marais

Dear traveler,

Booking confirmation for Hotel Le Marais
Confirmation number: 4239876120
PIN code: 1234

Check-in: Friday, 1 August 2026 from 15:00
Check-out: Monday, 4 August 2026 until 11:00

Total price: $620.50

Thanks for booking with Booking.com.
"""

AIRBNB_STAY = """\
Your reservation at Cozy Loft in Mission District is confirmed.

Confirmation code: HMABCDE12F
Check-in: Sat, Aug 1, 2026 after 3:00 PM
Checkout: Tue, Aug 4, 2026 before 11:00 AM
Total: $720.00

— Airbnb
"""

MARRIOTT_HOTEL = """\
Marriott Bonvoy

Marriott Downtown San Francisco
Confirmation Number: 884217901

Arrival: Friday, August 1, 2026
Departure: Monday, August 4, 2026

Estimated Total: $645.50

Thank you for choosing Marriott.
"""

UNITED_FLIGHT = """\
United Airlines

Confirmation: ABC123
Flight UA 234 LAX -> JFK

Departing: Aug 1, 2026 7:30 AM
Arriving:  Aug 1, 2026 4:00 PM

Total: $279.99

Visit united.com to manage your trip.
"""

GENERIC_FREEFORM = """\
Your hotel reservation at Atlas Inn is confirmed.

Confirmation #: ATLAS-9821
Check-in: 2026-08-01
Check-out: 2026-08-04

Total: $415.00
"""


# ── Routing tests ─────────────────────────────────────────────────────────────

def test_detect_routes_to_correct_vendor():
    assert detect(BOOKING_COM_HOTEL) == "booking_com"
    assert detect(AIRBNB_STAY) == "airbnb"
    assert detect(MARRIOTT_HOTEL) == "marriott"
    assert detect(UNITED_FLIGHT) == "united"
    # Generic doesn't claim anything specifically — detect() returns None
    # and parse() falls back to generic.
    assert detect(GENERIC_FREEFORM) is None


def test_detect_does_not_cross_match():
    # Booking.com text shouldn't trip the Airbnb code-shape match.
    assert detect(BOOKING_COM_HOTEL) != "airbnb"
    # Marriott shouldn't claim a United text just because both have
    # confirmation numbers.
    assert detect(UNITED_FLIGHT) != "marriott"


# ── Parser output tests ───────────────────────────────────────────────────────

def test_booking_com_extracts_core_fields():
    out = parse_booking(BOOKING_COM_HOTEL)
    assert out["parser"] == "booking_com"
    assert out["type"] == "hotel"
    assert out["vendor"] == "Booking.com"
    assert out["confirmation_code"] == "4239876120"
    assert "Hotel Le Marais" in (out.get("title") or "")
    assert out["start_time"].startswith("2026-08-01")
    assert out["end_time"].startswith("2026-08-04")
    assert out["cost"] == 620.50
    assert out["currency"] == "USD"


def test_airbnb_extracts_core_fields():
    out = parse_booking(AIRBNB_STAY)
    assert out["parser"] == "airbnb"
    assert out["type"] == "hotel"
    assert out["vendor"] == "Airbnb"
    assert out["confirmation_code"] == "HMABCDE12F"
    assert out["start_time"].startswith("2026-08-01")
    assert out["end_time"].startswith("2026-08-04")
    assert out["cost"] == 720.00
    assert out["currency"] == "USD"


def test_marriott_extracts_core_fields():
    out = parse_booking(MARRIOTT_HOTEL)
    assert out["parser"] == "marriott"
    assert out["type"] == "hotel"
    assert out["vendor"] == "Marriott"
    assert out["confirmation_code"] == "884217901"
    assert out["start_time"].startswith("2026-08-01")
    assert out["end_time"].startswith("2026-08-04")
    assert out["cost"] == 645.50
    assert out["currency"] == "USD"


def test_united_extracts_core_fields():
    out = parse_booking(UNITED_FLIGHT)
    assert out["parser"] == "united"
    assert out["type"] == "flight"
    assert out["vendor"] == "United Airlines"
    assert out["confirmation_code"] == "ABC123"
    assert "UA 234" in (out.get("title") or "")
    assert "LAX" in (out.get("title") or "")
    assert "JFK" in (out.get("title") or "")
    assert out["start_time"].startswith("2026-08-01T07:30")
    assert out["cost"] == 279.99


def test_generic_handles_unknown_vendor():
    out = parse_booking(GENERIC_FREEFORM)
    assert out["parser"] == "generic"
    assert out["type"] == "hotel"   # keyword guess from "hotel reservation" / "Check-in"
    assert out["confirmation_code"] == "ATLAS-9821"
    assert out["start_time"].startswith("2026-08-01")
    assert out["end_time"].startswith("2026-08-04")
    assert out["cost"] == 415.00
    assert out["currency"] == "USD"


def test_empty_text_does_not_crash():
    out = parse_booking("")
    assert out["parser"] == "generic"
    # Generic has no signal to work with — fields just absent.
    assert "confirmation_code" not in out


def test_garbage_text_does_not_crash():
    out = parse_booking("just some random words with no booking info")
    assert out["parser"] == "generic"
    # No prices, no dates, no codes — but it still returns a `type` guess.
    assert "type" in out


def test_excerpt_is_truncated():
    long_text = "A" * 1000 + "Confirmation #: ABC123 hotel"
    out = parse_booking(long_text)
    assert len(out["raw_text_excerpt"]) <= 240
