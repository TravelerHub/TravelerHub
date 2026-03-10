const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

// Forward geocoding: text query → coordinates
// Returns same shape as before so callers in Navigation.jsx don't change
export async function searchPlaces(query, options = {}) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(query)}&` +
      `key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Geocoding API error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const limit = options.limit || 5;
    return (data.results || []).slice(0, limit).map(result => ({
      id: result.place_id,
      name: result.formatted_address,
      shortName: result.address_components?.[0]?.long_name || result.formatted_address,
      coordinates: [result.geometry.location.lng, result.geometry.location.lat], // [lng, lat]
      category: result.types?.[0] || 'address',
      address: result.formatted_address,
      context: result.address_components || [],
    }));
  } catch (error) {
    console.error('Geocoding search error:', error);
    throw error;
  }
}

// Alias used in some callers
export const searchPlacesByText = searchPlaces;

// Reverse geocoding: [lng, lat] coordinates → place name
export async function getPlaceName(coordinates) {
  try {
    // coordinates is [lng, lat] (Mapbox convention) — Google expects lat,lng
    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `latlng=${coordinates[1]},${coordinates[0]}&` +
      `key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Reverse geocoding error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'OK' || data.results.length === 0) return null;

    const result = data.results[0];
    return {
      name: result.formatted_address,
      coordinates: [result.geometry.location.lng, result.geometry.location.lat],
      address: result.formatted_address,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

// Proximity-biased search: query near a [lng, lat] point
export async function searchNearLocation(query, proximity) {
  try {
    // Use Google Geocoding with a location bias bounding box (~10km around proximity)
    const [lng, lat] = proximity;
    const delta = 0.1; // ~11km
    const bounds = `${lat - delta},${lng - delta}|${lat + delta},${lng + delta}`;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(query)}&` +
      `bounds=${encodeURIComponent(bounds)}&` +
      `key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Proximity search error: ${response.status}`);

    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Proximity search failed: ${data.status}`);
    }

    return (data.results || []).slice(0, 10).map(result => ({
      id: result.place_id,
      name: result.formatted_address,
      shortName: result.address_components?.[0]?.long_name || result.formatted_address,
      coordinates: [result.geometry.location.lng, result.geometry.location.lat],
      category: result.types?.[0] || 'address',
      address: result.formatted_address,
    }));
  } catch (error) {
    console.error('Proximity search error:', error);
    throw error;
  }
}
