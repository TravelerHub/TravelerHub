/**
 * Build a Google Maps directions URL from an array of waypoints.
 * waypoints: [{lat, lng, name?}, ...]
 */
export function buildGoogleMapsUrl(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const middle = waypoints.slice(1, -1);
  const waypointsParam = middle.length > 0
    ? '&waypoints=' + middle.map(w => `${w.lat},${w.lng}`).join('|')
    : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}`;
}

/**
 * Build a Waze URL — Waze only supports a single destination.
 * Uses the last waypoint as destination.
 */
export function buildWazeUrl(waypoints) {
  if (!waypoints || waypoints.length < 1) return null;
  const dest = waypoints[waypoints.length - 1];
  return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
}

/**
 * Build an Apple Maps URL.
 * Supports origin + destination; middle waypoints not supported by URL scheme.
 */
export function buildAppleMapsUrl(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const dest = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  return `https://maps.apple.com/?saddr=${origin}&daddr=${dest}&dirflg=d`;
}
