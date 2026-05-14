"""
Day-itinerary builder backed by OSM POIs + the deterministic ranker in
`services/itinerary_builder`.

Endpoint:
  POST /itinerary/build  body: { lat, lng, date?, start_time?, duration_hours?,
                                 radius_km?, max_stops? }
"""

import logging
from datetime import date as _date, datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.discovery_overpass import search_attractions_osm
from services.discovery_wikipedia import enrich_with_wikipedia
from services.itinerary_builder import build_itinerary, stops_to_dicts
from utils import oauth2

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("travelhub")

router = APIRouter(prefix="/itinerary", tags=["Itinerary"])


class BuildBody(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    date: Optional[_date] = None
    start_time: Optional[str] = Field(default="09:00", description="HH:MM")
    duration_hours: float = Field(default=8.0, gt=0, le=16)
    radius_km: float = Field(default=5.0, gt=0, le=25)
    max_stops: int = Field(default=6, ge=1, le=12)


def _parse_start_dt(body: BuildBody) -> datetime:
    target_date = body.date or datetime.utcnow().date()
    try:
        h, m = (body.start_time or "09:00").split(":", 1)
        return datetime.combine(target_date, time(int(h), int(m)))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="start_time must be HH:MM")


@router.post("/build")
@limiter.limit("20/minute")
async def build_day(
    request: Request,
    body: BuildBody,
    current_user=Depends(oauth2.get_current_user),
):
    start_dt = _parse_start_dt(body)

    osm = await search_attractions_osm(
        body.lat,
        body.lng,
        radius_km=body.radius_km,
        limit=40,
    )
    candidates = osm.get("data") or []

    if not candidates:
        warning = "No attractions found in radius."
        error = osm.get("error")
        if error:
            logger.warning("OSM attraction lookup failed: %s", error)
            warning = "Attractions lookup failed."
        return {
            "stops": [],
            "source": "osm",
            "warning": warning,
        }

    # Wikipedia enrichment is best-effort and only adds title/thumbnail/extract.
    # If it fails we still return the OSM-only itinerary.
    try:
        candidates = await enrich_with_wikipedia(candidates, title_key="wikipedia")
    except Exception:
        pass

    stops = build_itinerary(
        candidates,
        body.lat,
        body.lng,
        start_at=start_dt,
        duration_hours=body.duration_hours,
        max_stops=body.max_stops,
    )

    return {
        "stops": stops_to_dicts(stops),
        "source": "osm",
        "warning": None,
        "origin": {"lat": body.lat, "lng": body.lng},
        "start_at": start_dt.isoformat(),
    }
