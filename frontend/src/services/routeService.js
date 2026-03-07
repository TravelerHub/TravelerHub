// Function to calculate optimized route
export async function getOptimizedRoute(waypoints) {
  // Build coordinates string: "lng,lat;lng,lat;lng,lat"
  const coords = waypoints
    .map(coord => `${coord[0]},${coord[1]}`)
    .join(';');

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?` +
    `geometries=geojson&` +
    `steps=true&` +
    `access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok') {
    throw new Error('Unable to calculate route');
  }

  const route = data.routes[0];

  return {
    geometry: route.geometry,           // Route line coordinates
    duration: route.duration,           // Seconds
    distance: route.distance,           // Meters
    steps: route.legs.flatMap(leg => leg.steps),     // Turn-by-turn directions
    summary: {
      totalDistance: (route.distance / 1000).toFixed(2) + ' km',
      totalDuration: formatDuration(route.duration),
      estimatedArrival: calculateArrivalTime(route.duration)
    }
  };
}

// Helper: Format seconds to "2h 30m" or "45m"
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper: Calculate arrival time
function calculateArrivalTime(durationSeconds) {
  const now = new Date();
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  
  return arrival.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}