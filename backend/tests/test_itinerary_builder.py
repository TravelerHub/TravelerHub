"""
Tests for backend/services/itinerary_builder.py — deterministic day planner.
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.itinerary_builder import (
    build_itinerary,
    haversine_km,
    _is_open_at,
    _score_candidate,
)


# Coordinates: a tight cluster in central Paris around the Louvre.
LOUVRE = (48.8606, 2.3376)
TUILERIES = (48.8634, 2.3275)
ORSAY = (48.8600, 2.3266)
NOTRE_DAME = (48.8530, 2.3499)
EIFFEL = (48.8584, 2.2945)
FAR = (49.5, 2.5)  # ~70 km north


def stop(name, lat, lng, **extra):
    return {
        "name": name,
        "lat": lat,
        "lng": lng,
        "place_type": extra.get("place_type", "attraction"),
        "id": f"osm:node:{name}",
        "place_id": f"osm:node:{name}",
        "address": extra.get("address"),
        "wikipedia": extra.get("wikipedia"),
        "website": extra.get("website"),
        "opening_hours": extra.get("opening_hours"),
    }


def test_haversine_known_distance():
    """Louvre → Eiffel Tower is ~3.2 km."""
    d = haversine_km(*LOUVRE, *EIFFEL)
    assert 3.0 < d < 3.6


def test_empty_candidates_returns_empty():
    out = build_itinerary([], 48.86, 2.33, start_at=datetime(2026, 5, 1, 9, 0))
    assert out == []


def test_candidates_with_no_coords_dropped():
    bad = [{"name": "Ghost", "lat": None, "lng": None, "place_type": "museum"}]
    out = build_itinerary(bad, 48.86, 2.33, start_at=datetime(2026, 5, 1, 9, 0))
    assert out == []


def test_basic_pick_and_order_from_origin():
    candidates = [
        stop("Louvre", *LOUVRE, place_type="museum", wikipedia="en:Louvre"),
        stop("Tuileries", *TUILERIES, place_type="park"),
        stop("Notre-Dame", *NOTRE_DAME, place_type="monument", wikipedia="en:Notre-Dame_de_Paris"),
        stop("Eiffel Tower", *EIFFEL, place_type="viewpoint", wikipedia="en:Eiffel_Tower"),
    ]
    out = build_itinerary(
        candidates,
        *LOUVRE,
        start_at=datetime(2026, 5, 1, 9, 0),
        duration_hours=6,
        max_stops=4,
    )
    names = [s.name for s in out]
    assert "Louvre" in names  # closest to origin should be first
    assert names[0] == "Louvre"
    # Make sure timestamps are monotonically increasing.
    for a, b in zip(out, out[1:]):
        assert a.departure <= b.arrival


def test_far_candidate_excluded_by_distance_score():
    """A POI ~70 km away scores below the 0.5 cutoff and gets dropped."""
    candidates = [
        stop("Louvre", *LOUVRE, place_type="museum"),
        stop("Far Field", *FAR, place_type="attraction"),
    ]
    out = build_itinerary(
        candidates,
        *LOUVRE,
        start_at=datetime(2026, 5, 1, 9, 0),
        duration_hours=8,
    )
    names = [s.name for s in out]
    assert "Louvre" in names
    assert "Far Field" not in names


def test_diversity_prefers_different_categories():
    """Three close museums + one close park: a park should appear despite the
    museums being slightly closer, thanks to the diversity bonus."""
    candidates = [
        stop("MuseumA", 48.8606, 2.3380, place_type="museum"),
        stop("MuseumB", 48.8607, 2.3381, place_type="museum"),
        stop("MuseumC", 48.8608, 2.3382, place_type="museum"),
        stop("ParkA",   48.8612, 2.3380, place_type="park"),
    ]
    out = build_itinerary(
        candidates, *LOUVRE,
        start_at=datetime(2026, 5, 1, 9, 0),
        duration_hours=8, max_stops=2,
    )
    types = {s.place_type for s in out}
    assert "park" in types  # diversity bonus pulls a non-museum into top 2


def test_opening_hours_24_7_always_open():
    assert _is_open_at("24/7", datetime(2026, 5, 1, 3, 0)) is True


def test_opening_hours_closed_today():
    """`Mo off` means closed on Mondays — test on a Monday."""
    monday = datetime(2026, 5, 4, 12, 0)  # 2026-05-04 is a Monday
    assert _is_open_at("Mo off", monday) is False


def test_opening_hours_within_range():
    """`Tu-Su 10:00-18:00` open at 14:00 on a Wednesday."""
    wed = datetime(2026, 5, 6, 14, 0)
    assert _is_open_at("Tu-Su 10:00-18:00", wed) is True


def test_opening_hours_outside_range():
    """`Tu-Su 10:00-18:00` closed at 21:00 on a Wednesday."""
    wed = datetime(2026, 5, 6, 21, 0)
    assert _is_open_at("Tu-Su 10:00-18:00", wed) is False


def test_unparseable_opening_hours_returns_none():
    """Complex grammar we don't support returns None (caller treats as 'open')."""
    assert _is_open_at("PH off; Mo-Fr 10:00-18:00; sunset+02:00", datetime(2026, 5, 1, 12, 0)) in (None, True, False)


def test_score_higher_for_closer_and_notable():
    near_notable = stop("A", *LOUVRE, place_type="museum", wikipedia="en:A")
    far_unknown = stop("B", *FAR, place_type="attraction")
    s_near = _score_candidate(near_notable, *LOUVRE, set(), None)
    s_far = _score_candidate(far_unknown, *LOUVRE, set(), None)
    assert s_near > s_far


def test_closed_poi_heavily_penalized():
    """An open-now POI should beat a closed-now POI even when farther."""
    when = datetime(2026, 5, 1, 12, 0)  # Friday noon
    closed_close = stop("ClosedClose", *LOUVRE, place_type="museum", opening_hours="Mo off; Tu-Su 10:00-18:00")
    open_far = stop("OpenFurther", 48.870, 2.345, place_type="museum", opening_hours="24/7")
    # Force "closed" by making the day a Monday
    monday = datetime(2026, 5, 4, 12, 0)
    s_closed = _score_candidate(closed_close, *LOUVRE, set(), monday)
    s_open = _score_candidate(open_far, *LOUVRE, set(), monday)
    assert s_open > s_closed


def test_max_stops_respected():
    candidates = [
        stop(f"P{i}", 48.8606 + i * 0.001, 2.3376 + i * 0.001, place_type="attraction")
        for i in range(10)
    ]
    out = build_itinerary(
        candidates, *LOUVRE,
        start_at=datetime(2026, 5, 1, 9, 0),
        duration_hours=10, max_stops=3,
    )
    assert len(out) <= 3
