"""
Deterministic single-day itinerary builder.

Given a starting point (lat, lng) and a duration in hours, produces an ordered
list of stops drawn from OSM Overpass attractions. No external AI calls — the
ranking is a transparent weighted score over distance, notability, opening
hours and category diversity, and the route order is a greedy
nearest-neighbor walk.

Why this exists:
  - The trip planner needs a "give me a day in this city" feature that works
    in airplane mode after data has been pre-cached, without burning Gemini
    tokens or relying on Google's Trip Assist.
  - OSM Overpass already indexes every attraction in the world; we just need
    to pick a good subset.

The function's contract is small and side-effect-free so it's easy to test
and to call from a CLI / cache-warming job, not just the FastAPI handler.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, time
from typing import Iterable, Optional

# How long a typical visitor spends at a stop, by OSM tag value.
# These are crude averages — most travelers don't spend 3 hours at a viewpoint
# but do spend that much at a major museum. The numbers come from public
# travel-blog norms; nothing fancy.
DEFAULT_DWELL_MINUTES = 75
DWELL_BY_PLACE_TYPE = {
    "museum": 105,
    "gallery": 75,
    "zoo": 150,
    "theme_park": 240,
    "aquarium": 120,
    "viewpoint": 25,
    "monument": 25,
    "memorial": 25,
    "castle": 90,
    "ruins": 60,
    "archaeological_site": 60,
    "park": 60,
    "garden": 45,
    "nature_reserve": 90,
    "attraction": 60,
}

# Average walking pace in km/h. Used to convert distance between stops into a
# travel-time budget. Travelers with a transit pass will move faster but the
# rest of the algorithm (radius, dwell times) is built around walking.
WALKING_KMH = 4.5

# Earth radius for haversine — kilometers.
_EARTH_KM = 6371.0


@dataclass
class ItineraryStop:
    name: str
    lat: float
    lng: float
    place_type: str
    place_id: Optional[str]
    dwell_minutes: int
    arrival: str  # HH:MM
    departure: str  # HH:MM
    distance_km_from_prev: float
    walking_minutes_from_prev: int
    wikipedia: Optional[str]
    website: Optional[str]
    address: Optional[str]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometers between two (lat, lng) points."""
    a_lat, a_lng = math.radians(lat1), math.radians(lng1)
    b_lat, b_lng = math.radians(lat2), math.radians(lng2)
    dlat = b_lat - a_lat
    dlng = b_lng - a_lng
    h = math.sin(dlat / 2) ** 2 + math.cos(a_lat) * math.cos(b_lat) * math.sin(dlng / 2) ** 2
    return 2 * _EARTH_KM * math.asin(math.sqrt(h))


def _dwell_for(place_type: Optional[str]) -> int:
    if not place_type:
        return DEFAULT_DWELL_MINUTES
    return DWELL_BY_PLACE_TYPE.get(place_type, DEFAULT_DWELL_MINUTES)


def _is_open_at(opening_hours: Optional[str], dt: datetime) -> Optional[bool]:
    """Best-effort check of OSM `opening_hours` against `dt`.

    Returns True/False if we could parse, None if we couldn't (caller treats
    None as "assume open" so we don't penalize POIs without opening_hours data,
    which is most of them on OSM).

    The full osm_opening_hours grammar is huge — we recognize the simple
    cases that cover ~80 % of attractions:
      "24/7"
      "Mo-Su 09:00-17:00"
      "Tu-Su 10:00-18:00; Mo off"
      "10:00-18:00"
    """
    if not opening_hours:
        return None
    s = opening_hours.strip()
    if s == "24/7":
        return True

    weekday_map = {0: "Mo", 1: "Tu", 2: "We", 3: "Th", 4: "Fr", 5: "Sa", 6: "Su"}
    today = weekday_map[dt.weekday()]
    now = dt.time()

    for chunk in s.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            day_part, time_part = _split_day_time(chunk)
        except ValueError:
            return None
        if day_part and not _day_matches(day_part, today):
            continue
        if time_part is None:
            continue
        if time_part == "off":
            return False
        try:
            start, end = _parse_time_range(time_part)
        except ValueError:
            return None
        if start <= now <= end:
            return True
    return False


def _split_day_time(chunk: str) -> tuple[Optional[str], Optional[str]]:
    parts = chunk.split(" ", 1)
    if len(parts) == 1:
        # Could be a bare time range like "10:00-18:00" or a status like "off".
        token = parts[0]
        if ":" in token or "-" in token:
            return None, token
        return token, None
    return parts[0], parts[1]


def _day_matches(day_spec: str, today: str) -> bool:
    if "-" in day_spec:
        a, b = day_spec.split("-", 1)
        order = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        if a not in order or b not in order or today not in order:
            return False
        ai, bi, ti = order.index(a), order.index(b), order.index(today)
        if ai <= bi:
            return ai <= ti <= bi
        return ti >= ai or ti <= bi
    return day_spec == today


def _parse_time_range(s: str) -> tuple[time, time]:
    a, b = s.split("-", 1)
    return _parse_hm(a), _parse_hm(b)


def _parse_hm(s: str) -> time:
    h, m = s.split(":", 1)
    return time(int(h), int(m))


def _diversity_bonus(seen_types: set[str], place_type: str) -> float:
    """First member of a category gets +0.4, every subsequent one nothing.

    Encourages a museum + park + viewpoint mix instead of three museums.
    """
    if not place_type:
        return 0.0
    return 0.4 if place_type not in seen_types else 0.0


def _score_candidate(
    stop: dict,
    origin_lat: float,
    origin_lng: float,
    seen_types: set[str],
    when: Optional[datetime],
) -> float:
    """Compute a deterministic score for a candidate stop. Higher = better.

    Weights:
      - distance penalty (closer is better, falls off after ~3 km)
      - notability bonus (Wikipedia tag present)
      - opening-hours bonus (open right now, when we know)
      - diversity bonus (first of its category)
    """
    lat = stop.get("lat")
    lng = stop.get("lng")
    if lat is None or lng is None:
        return -1.0

    distance_km = haversine_km(origin_lat, origin_lng, lat, lng)
    distance_penalty = -0.15 * distance_km

    notability = 0.5 if stop.get("wikipedia") else 0.0

    opening_score = 0.0
    if when is not None:
        is_open = _is_open_at(stop.get("opening_hours"), when)
        if is_open is True:
            opening_score = 0.25
        elif is_open is False:
            opening_score = -1.0  # heavy penalty: don't route to a closed museum

    diversity = _diversity_bonus(seen_types, stop.get("place_type") or "")

    base = 1.0
    return base + distance_penalty + notability + opening_score + diversity


def _order_greedy(
    stops: list[dict],
    origin_lat: float,
    origin_lng: float,
) -> list[dict]:
    """Order picked stops by greedy nearest-neighbor starting from origin.

    Optimal TSP would be NP-hard — but we have <=10 stops in practice, and
    nearest-neighbor's worst case is well within the imprecision of "did the
    traveler stop for coffee on the way" anyway.
    """
    remaining = list(stops)
    cur_lat, cur_lng = origin_lat, origin_lng
    ordered: list[dict] = []
    while remaining:
        best_idx = 0
        best_dist = float("inf")
        for i, s in enumerate(remaining):
            d = haversine_km(cur_lat, cur_lng, s["lat"], s["lng"])
            if d < best_dist:
                best_dist = d
                best_idx = i
        chosen = remaining.pop(best_idx)
        chosen = dict(chosen)
        chosen["_distance_km_from_prev"] = best_dist
        ordered.append(chosen)
        cur_lat, cur_lng = chosen["lat"], chosen["lng"]
    return ordered


def _walk_minutes(distance_km: float) -> int:
    return max(1, int(round((distance_km / WALKING_KMH) * 60)))


def build_itinerary(
    candidates: Iterable[dict],
    origin_lat: float,
    origin_lng: float,
    *,
    start_at: datetime,
    duration_hours: float = 8.0,
    max_stops: int = 6,
) -> list[ItineraryStop]:
    """Pick + order stops from `candidates` to fill `duration_hours` of a day.

    `candidates` is the raw list returned by
    `discovery_overpass.search_attractions_osm(...)["data"]`. We rank each
    one, take the top N until the time budget runs out, then route them in
    nearest-neighbor order from `origin`.
    """
    pool = [c for c in candidates if c.get("lat") is not None and c.get("lng") is not None]
    if not pool:
        return []

    # Pick greedily one at a time, recomputing each candidate's score against
    # the running set of already-chosen categories. This is what makes the
    # diversity bonus actually shape the result — a single up-front sort
    # would miss it.
    picked: list[dict] = []
    seen_types: set[str] = set()
    remaining = list(pool)
    budget_minutes = duration_hours * 60.0
    cur_lat, cur_lng = origin_lat, origin_lng

    while remaining and len(picked) < max_stops:
        best_idx = -1
        best_score = 0.5  # cutoff
        for i, c in enumerate(remaining):
            s = _score_candidate(c, origin_lat, origin_lng, seen_types, start_at)
            if s <= best_score:
                continue
            walk_km = haversine_km(cur_lat, cur_lng, c["lat"], c["lng"])
            cost = _walk_minutes(walk_km) + _dwell_for(c.get("place_type"))
            if cost > budget_minutes:
                continue
            best_score = s
            best_idx = i

        if best_idx < 0:
            break

        chosen = remaining.pop(best_idx)
        walk_km = haversine_km(cur_lat, cur_lng, chosen["lat"], chosen["lng"])
        cost = _walk_minutes(walk_km) + _dwell_for(chosen.get("place_type"))
        budget_minutes -= cost
        picked.append(chosen)
        seen_types.add(chosen.get("place_type") or "")
        cur_lat, cur_lng = chosen["lat"], chosen["lng"]

    if not picked:
        return []

    ordered = _order_greedy(picked, origin_lat, origin_lng)

    # Convert to ItineraryStop with timestamps. We start the clock at
    # `start_at` and walk forward through dwell + travel.
    out: list[ItineraryStop] = []
    cursor = start_at
    for s in ordered:
        walk_km = s["_distance_km_from_prev"]
        walk_min = _walk_minutes(walk_km)
        cursor_after_walk = _add_minutes(cursor, walk_min)
        dwell_min = _dwell_for(s.get("place_type"))
        depart = _add_minutes(cursor_after_walk, dwell_min)
        out.append(
            ItineraryStop(
                name=s.get("name") or "Unnamed stop",
                lat=s["lat"],
                lng=s["lng"],
                place_type=s.get("place_type") or "attraction",
                place_id=s.get("place_id") or s.get("id"),
                dwell_minutes=dwell_min,
                arrival=cursor_after_walk.strftime("%H:%M"),
                departure=depart.strftime("%H:%M"),
                distance_km_from_prev=round(walk_km, 2),
                walking_minutes_from_prev=walk_min,
                wikipedia=s.get("wikipedia"),
                website=s.get("website"),
                address=s.get("address"),
            )
        )
        cursor = depart
    return out


def _add_minutes(dt: datetime, minutes: int) -> datetime:
    from datetime import timedelta
    return dt + timedelta(minutes=minutes)


def stops_to_dicts(stops: list[ItineraryStop]) -> list[dict]:
    return [s.__dict__ for s in stops]
