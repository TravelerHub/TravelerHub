"""
Weather-Aware Routing API — route-level forecast alerts.

Uses Open-Meteo (free, no API key required) to fetch hourly forecasts
at waypoints along a route. Alerts the user if rain/snow/storms
impact travel time or safety.
"""

import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from utils import oauth2
from fastapi import Depends

router = APIRouter(prefix="/weather", tags=["Weather"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes grouped by severity
HAZARD_CODES = {45, 48, 55, 65, 75, 95, 96, 99}  # fog, heavy rain/snow, thunderstorm, hail
RAIN_CODES = {51, 53, 61, 63, 80, 81, 82}         # drizzle, rain, showers
SNOW_CODES = {71, 73}                               # light/moderate snow

WMO_DESCRIPTIONS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Showers", 81: "Heavy showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
}


def _travel_time_impact(code: int) -> dict:
    """Estimate how weather impacts driving time and provide safety advice."""
    if code in HAZARD_CODES:
        return {
            "severity": "high",
            "time_increase_pct": 30,
            "advice": "Hazardous conditions. Consider delaying departure or choosing an alternate route.",
        }
    elif code in RAIN_CODES:
        return {
            "severity": "medium",
            "time_increase_pct": 15,
            "advice": "Rain expected. Allow extra travel time and drive cautiously.",
        }
    elif code in SNOW_CODES:
        return {
            "severity": "medium",
            "time_increase_pct": 25,
            "advice": "Snow expected. Check road conditions and consider chains/winter tires.",
        }
    return {
        "severity": "low",
        "time_increase_pct": 0,
        "advice": "Clear conditions. No weather impact expected.",
    }


@router.get("/route-forecast")
async def get_route_weather_forecast(
    waypoints: str = Query(..., description="Pipe-separated lat,lng pairs (e.g. 34.05,-118.24|36.17,-115.14)"),
    departure_time: Optional[str] = Query(None, description="ISO datetime for departure"),
    route_duration_minutes: Optional[int] = Query(None, description="Total route duration in minutes"),
    current_user=Depends(oauth2.get_current_user),
):
    """
    Fetch hourly weather forecasts at each waypoint along a route.

    For each waypoint, estimates when the traveller will arrive (based on
    departure_time + fraction of route_duration) and checks that hour's forecast.

    Returns alerts if any segment has rain/snow/storm, plus the estimated
    travel time increase.
    """
    points = []
    for w in waypoints.split("|"):
        parts = w.strip().split(",")
        if len(parts) == 2:
            points.append((float(parts[0]), float(parts[1])))

    if not points:
        raise HTTPException(status_code=400, detail="No valid waypoints provided")

    dep = datetime.fromisoformat(departure_time.replace("Z", "+00:00")) if departure_time else datetime.now()
    total_minutes = route_duration_minutes or (30 * len(points))

    alerts = []
    forecasts = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for i, (lat, lng) in enumerate(points):
            # Estimate arrival at this waypoint
            fraction = i / max(len(points) - 1, 1)
            est_arrival = dep + timedelta(minutes=total_minutes * fraction)
            target_hour = est_arrival.strftime("%Y-%m-%dT%H:00")

            try:
                resp = await client.get(OPEN_METEO_URL, params={
                    "latitude": lat,
                    "longitude": lng,
                    "hourly": "weathercode,temperature_2m,precipitation_probability,windspeed_10m",
                    "forecast_days": 3,
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                })
                data = resp.json()
            except Exception:
                continue

            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            codes = hourly.get("weathercode", [])
            precip = hourly.get("precipitation_probability", [])
            wind = hourly.get("windspeed_10m", [])
            temps = hourly.get("temperature_2m", [])

            # Find the hour matching our estimated arrival
            hour_idx = None
            for j, t in enumerate(times):
                if t == target_hour:
                    hour_idx = j
                    break

            if hour_idx is None:
                continue

            code = codes[hour_idx] if hour_idx < len(codes) else 0
            impact = _travel_time_impact(code)

            forecast_entry = {
                "waypoint_index": i,
                "lat": lat,
                "lng": lng,
                "estimated_arrival": est_arrival.isoformat(),
                "weather_code": code,
                "weather_description": WMO_DESCRIPTIONS.get(code, "Unknown"),
                "temperature_f": temps[hour_idx] if hour_idx < len(temps) else None,
                "precipitation_pct": precip[hour_idx] if hour_idx < len(precip) else None,
                "wind_mph": wind[hour_idx] if hour_idx < len(wind) else None,
                "impact": impact,
            }
            forecasts.append(forecast_entry)

            if impact["severity"] in ("high", "medium"):
                alerts.append({
                    **forecast_entry,
                    "message": (
                        f"Waypoint {i + 1}: {WMO_DESCRIPTIONS.get(code, 'Bad weather')} expected "
                        f"around {est_arrival.strftime('%I:%M %p')}. "
                        f"Estimated +{impact['time_increase_pct']}% travel time. "
                        f"{impact['advice']}"
                    ),
                })

    # Compute aggregate impact
    max_increase = max((f["impact"]["time_increase_pct"] for f in forecasts), default=0)
    adjusted_duration = round(total_minutes * (1 + max_increase / 100))

    return {
        "forecasts": forecasts,
        "alerts": alerts,
        "has_hazards": any(f["impact"]["severity"] == "high" for f in forecasts),
        "has_rain": any(f["impact"]["severity"] == "medium" for f in forecasts),
        "original_duration_minutes": total_minutes,
        "weather_adjusted_duration_minutes": adjusted_duration,
        "max_time_increase_pct": max_increase,
    }


@router.get("/destination-forecast")
async def get_destination_forecast(
    lat: float = Query(...),
    lng: float = Query(...),
    days: int = Query(3, ge=1, le=7),
    current_user=Depends(oauth2.get_current_user),
):
    """
    Get a multi-day forecast for a destination.
    Useful for trip planning — shows daily conditions for Days 1-7.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OPEN_METEO_URL, params={
            "latitude": lat,
            "longitude": lng,
            "daily": "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
            "forecast_days": days,
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "timezone": "auto",
        })
        data = resp.json()

    daily = data.get("daily", {})
    dates = daily.get("time", [])
    codes = daily.get("weathercode", [])
    highs = daily.get("temperature_2m_max", [])
    lows = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_sum", [])
    wind = daily.get("windspeed_10m_max", [])

    forecast_days = []
    for i, date in enumerate(dates):
        code = codes[i] if i < len(codes) else 0
        impact = _travel_time_impact(code)
        forecast_days.append({
            "date": date,
            "day_number": i + 1,
            "weather_code": code,
            "description": WMO_DESCRIPTIONS.get(code, "Unknown"),
            "high_f": highs[i] if i < len(highs) else None,
            "low_f": lows[i] if i < len(lows) else None,
            "precipitation_mm": precip[i] if i < len(precip) else None,
            "wind_max_mph": wind[i] if i < len(wind) else None,
            "travel_impact": impact["severity"],
            "advice": impact["advice"],
        })

    return {
        "lat": lat,
        "lng": lng,
        "days": forecast_days,
    }
