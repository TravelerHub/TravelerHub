import polyline from '@mapbox/polyline';
import { API_BASE } from '../config';

// Map our mode names to Google Directions API mode names
const MODE_MAP = {
  'driving': 'driving',
  'driving-traffic': 'driving',
  'walking': 'walking',
  'cycling': 'bicycling',
  'bicycling': 'bicycling',
  'transit': 'transit',
};

/**
 * Calculate a single-mode route via the backend proxy.
 * waypoints: array of [lng, lat] coordinates
 * mode: 'driving' | 'walking' | 'cycling' | 'transit'
 */
export async function getOptimizedRoute(waypoints, mode = 'driving') {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  const googleMode = MODE_MAP[mode] || 'driving';

  const origin = `${waypoints[0][1]},${waypoints[0][0]}`;
  const destination = `${waypoints[waypoints.length - 1][1]},${waypoints[waypoints.length - 1][0]}`;

  const params = new URLSearchParams({ origin, destination, mode: googleMode });

  // For transit, always send departure_time=now for better results
  if (googleMode === 'transit') {
    params.append('departure_time', 'now');
    params.append('alternatives', 'true');
  }

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

  // If transit returned alternatives, pick the best one (fewest transfers)
  let route = data.routes[0];
  if (googleMode === 'transit' && data.routes.length > 1) {
    route = pickBestTransitRoute(data.routes);
  }

  return parseGoogleRoute(route);
}


/**
 * Multi-modal route: each leg between consecutive waypoints can have a different mode.
 * waypoints: array of { coordinates: [lng, lat], title: string }
 * legModes:  array of mode strings, one per gap between waypoints
 *            e.g. for 3 waypoints: ['walking', 'transit'] (2 legs)
 */
export async function getMultiModalRoute(waypoints, legModes) {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }
  if (legModes.length !== waypoints.length - 1) {
    throw new Error('legModes must have exactly (waypoints - 1) entries');
  }

  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    legs.push({
      origin: waypoints[i].coordinates || waypoints[i],
      destination: waypoints[i + 1].coordinates || waypoints[i + 1],
      mode: MODE_MAP[legModes[i]] || legModes[i],
    });
  }

  const response = await fetch(`${API_BASE}/navigation/multi-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ legs, departure_time: 'now' }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Multi-route request failed (${response.status})`);
  }

  const data = await response.json();

  // Parse each leg and build a combined route with segment metadata
  const parsedLegs = [];
  let allSteps = [];
  let totalDuration = 0;
  let totalDistance = 0;
  const segments = []; // For per-segment map styling

  for (const legResult of data.legs) {
    if (legResult.status !== 'OK' || !legResult.routes?.length) {
      parsedLegs.push({ status: legResult.status, error: legResult.error, mode: legResult.mode });
      continue;
    }

    let gRoute = legResult.routes[0];
    if (legResult.mode === 'transit' && legResult.routes.length > 1) {
      gRoute = pickBestTransitRoute(legResult.routes);
    }

    const parsed = parseGoogleRoute(gRoute);
    parsedLegs.push({ ...parsed, mode: legResult.mode });

    // Accumulate totals
    totalDuration += parsed.duration;
    totalDistance += parsed.distance;

    // Build per-step segments for map styling
    for (const step of parsed.steps) {
      // Each step gets its own segment with the travel mode
      const stepMode = step.travel_mode || legResult.mode.toUpperCase();
      if (step.start_location && step.end_location) {
        // Decode the step polyline if available, otherwise use start→end
        segments.push({
          mode: stepMode,
          coordinates: step.polyline_coords || [step.start_location, step.end_location],
        });
      }
    }

    allSteps = allSteps.concat(parsed.steps.map(s => ({
      ...s,
      // Mark the leg index so the UI can show which leg this step belongs to
      _legIndex: legResult.leg_index,
      _legMode: legResult.mode,
    })));
  }

  // Build a combined geometry from all segments
  const allCoords = segments.flatMap(s => s.coordinates);

  return {
    geometry: { type: 'LineString', coordinates: allCoords },
    duration: totalDuration,
    distance: totalDistance,
    steps: allSteps,
    segments,  // Per-segment data for map styling (mode + coordinates)
    legs: parsedLegs,
    summary: {
      totalDistance: (totalDistance / 1000).toFixed(2) + ' km',
      totalDuration: formatDuration(totalDuration),
      estimatedArrival: calculateArrivalTime(totalDuration),
    },
  };
}


/**
 * Parse a Google Directions route object into our normalized format.
 * Now also decodes per-step polylines for accurate segment rendering.
 */
function parseGoogleRoute(route) {
  const decodedPoints = polyline.decode(route.overview_polyline.points);
  const coordinates = decodedPoints.map(([lat, lng]) => [lng, lat]);
  const geometry = { type: 'LineString', coordinates };

  const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
  const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);

  const steps = route.legs.flatMap(leg =>
    leg.steps.map(step => {
      // Decode per-step polyline for accurate segment-level rendering
      let polylineCoords = null;
      if (step.polyline?.points) {
        const decoded = polyline.decode(step.polyline.points);
        polylineCoords = decoded.map(([lat, lng]) => [lng, lat]);
      }

      return {
        maneuver: {
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          type: step.maneuver || null,
        },
        name: step.name || null,
        distance: step.distance.value,
        duration: step.duration.value,
        travel_mode: step.travel_mode,
        start_location: step.start_location
          ? [step.start_location.lng, step.start_location.lat]
          : null,
        end_location: step.end_location
          ? [step.end_location.lng, step.end_location.lat]
          : null,
        polyline_coords: polylineCoords,
        transit: step.transit_details ? {
          vehicleType: step.transit_details.line?.vehicle?.type || 'BUS',
          lineName: step.transit_details.line?.name || null,
          lineShortName: step.transit_details.line?.short_name || null,
          lineColor: step.transit_details.line?.color || null,
          headsign: step.transit_details.headsign || null,
          departureStop: step.transit_details.departure_stop?.name || null,
          arrivalStop: step.transit_details.arrival_stop?.name || null,
          numStops: step.transit_details.num_stops || null,
          departureTime: step.transit_details.departure_time?.text || null,
          arrivalTime: step.transit_details.arrival_time?.text || null,
        } : null,
      };
    })
  );

  // Build segments from steps for per-mode map styling
  const segments = [];
  for (const step of steps) {
    const mode = step.travel_mode || 'DRIVING';
    const coords = step.polyline_coords || (
      step.start_location && step.end_location
        ? [step.start_location, step.end_location]
        : []
    );
    if (coords.length > 0) {
      segments.push({ mode, coordinates: coords, transit: step.transit });
    }
  }

  return {
    geometry,
    duration: totalDuration,
    distance: totalDistance,
    steps,
    segments,
    summary: {
      totalDistance: (totalDistance / 1000).toFixed(2) + ' km',
      totalDuration: formatDuration(totalDuration),
      estimatedArrival: calculateArrivalTime(totalDuration),
    },
  };
}


/**
 * Pick the best transit route: fewest transfers, then shortest duration.
 */
function pickBestTransitRoute(routes) {
  return routes.reduce((best, route) => {
    const transferCount = route.legs.reduce((sum, leg) =>
      sum + leg.steps.filter(s => s.travel_mode === 'TRANSIT').length, 0
    );
    const bestTransfers = best.legs.reduce((sum, leg) =>
      sum + leg.steps.filter(s => s.travel_mode === 'TRANSIT').length, 0
    );

    if (transferCount < bestTransfers) return route;
    if (transferCount === bestTransfers) {
      const routeDur = route.legs.reduce((s, l) => s + l.duration.value, 0);
      const bestDur = best.legs.reduce((s, l) => s + l.duration.value, 0);
      return routeDur < bestDur ? route : best;
    }
    return best;
  });
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
