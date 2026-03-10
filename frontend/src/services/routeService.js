import polyline from '@mapbox/polyline';

const API_BASE = 'http://localhost:8000';

// Map our mode names to Google Directions API mode names
const MODE_MAP = {
  'driving': 'driving',
  'driving-traffic': 'driving',
  'walking': 'walking',
  'cycling': 'bicycling',
  'bicycling': 'bicycling',
  'transit': 'transit',
};

// Calculate a route via the backend proxy (which calls Google Directions API).
// Google Directions API is server-side only — direct browser calls fail due to CORS.
// waypoints: array of [lng, lat] coordinates
// mode: 'driving' | 'walking' | 'cycling' | 'transit'
export async function getOptimizedRoute(waypoints, mode = 'driving') {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  const googleMode = MODE_MAP[mode] || 'driving';

  // Google expects lat,lng order (opposite of Mapbox's lng,lat)
  const origin = `${waypoints[0][1]},${waypoints[0][0]}`;
  const destination = `${waypoints[waypoints.length - 1][1]},${waypoints[waypoints.length - 1][0]}`;

  const params = new URLSearchParams({ origin, destination, mode: googleMode });

  if (waypoints.length > 2) {
    const midpoints = waypoints
      .slice(1, -1)
      .map(w => `${w[1]},${w[0]}`)
      .join('|');
    params.append('waypoints', midpoints);
  }

  const response = await fetch(`${API_BASE}/navigation/route?${params}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Route request failed (${response.status})`);
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`No route found: ${data.status}`);
  }

  const route = data.routes[0];

  // Decode Google's encoded polyline → [lat,lng] → flip to [lng,lat] for GeoJSON/Mapbox
  const decodedPoints = polyline.decode(route.overview_polyline.points);
  const coordinates = decodedPoints.map(([lat, lng]) => [lng, lat]);

  const geometry = { type: 'LineString', coordinates };

  const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
  const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);

  // Normalize steps — preserve all fields needed for rich display
  // Google's step.maneuver is the modifier string (e.g. "turn-right", "turn-left")
  // transit_details is only present on TRANSIT steps
  const steps = route.legs.flatMap(leg =>
    leg.steps.map(step => ({
      maneuver: {
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
        // step.maneuver holds the modifier string like "turn-right", "ramp-left", etc.
        type: step.maneuver || null,
      },
      name: step.name || null,
      distance: step.distance.value,
      duration: step.duration.value,
      travel_mode: step.travel_mode,
      // Coordinates for real-time navigation (GPS position → step matching)
      // Google returns {lat, lng} — flip to [lng, lat] for Mapbox consistency
      start_location: step.start_location
        ? [step.start_location.lng, step.start_location.lat]
        : null,
      end_location: step.end_location
        ? [step.end_location.lng, step.end_location.lat]
        : null,
      // Preserved only for TRANSIT steps — null for all others
      transit: step.transit_details ? {
        vehicleType: step.transit_details.line?.vehicle?.type || 'BUS',
        lineName: step.transit_details.line?.name || null,
        lineShortName: step.transit_details.line?.short_name || null,
        headsign: step.transit_details.headsign || null,
        departureStop: step.transit_details.departure_stop?.name || null,
        arrivalStop: step.transit_details.arrival_stop?.name || null,
        numStops: step.transit_details.num_stops || null,
        departureTime: step.transit_details.departure_time?.text || null,
        arrivalTime: step.transit_details.arrival_time?.text || null,
      } : null,
    }))
  );

  return {
    geometry,
    duration: totalDuration,
    distance: totalDistance,
    steps,
    summary: {
      totalDistance: (totalDistance / 1000).toFixed(2) + ' km',
      totalDuration: formatDuration(totalDuration),
      estimatedArrival: calculateArrivalTime(totalDuration),
    },
  };
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function calculateArrivalTime(durationSeconds) {
  const now = new Date();
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  return arrival.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
