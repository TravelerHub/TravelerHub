/**
 * Weather Service — route-level forecasts and destination weather.
 */
import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

/**
 * Get weather forecasts and alerts along a route.
 * @param {Array<{lat: number, lng: number}>} waypoints
 * @param {string|null} departureTime - ISO datetime
 * @param {number|null} routeDurationMinutes
 */
export async function getRouteWeather(waypoints, departureTime = null, routeDurationMinutes = null) {
  const waypointStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
  const params = new URLSearchParams({ waypoints: waypointStr });
  if (departureTime) params.append('departure_time', departureTime);
  if (routeDurationMinutes) params.append('route_duration_minutes', String(routeDurationMinutes));

  const res = await fetch(`${API_BASE}/weather/route-forecast?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch route weather');
  }
  return res.json();
}

/**
 * Get multi-day forecast for a destination.
 * @param {number} lat
 * @param {number} lng
 * @param {number} days - 1 to 7
 */
export async function getDestinationForecast(lat, lng, days = 3) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    days: String(days),
  });
  const res = await fetch(`${API_BASE}/weather/destination-forecast?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch destination forecast');
  }
  return res.json();
}
