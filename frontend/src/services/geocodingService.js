export async function searchPlaces(query, options = {}) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `limit=${options.limit || 5}&` +
      `access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    return data.features.map(feature => ({
      id: feature.id,
      name: feature.place_name,
      shortName: feature.text,
      coordinates: feature.geometry.coordinates,
      category: feature.place_type[0],
      address: feature.properties.address || '',
      context: feature.context || []
    }));
  } catch (error) {
    console.error('Geocoding search error:', error);
    throw error;
  }
}

export async function getPlaceName(coordinates) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?` +
      `limit=1&` +
      `access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Reverse geocoding error: ${response.status}`);
    }

    const data = await response.json();

    if (data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    return {
      name: feature.place_name,
      coordinates: feature.geometry.coordinates,
      address: feature.properties.address || ''
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

export async function searchNearLocation(query, proximity) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `proximity=${proximity[0]},${proximity[1]}&` +
      `limit=10&` +
      `access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Proximity search error: ${response.status}`);
    }

    const data = await response.json();

    return data.features.map(feature => ({
      id: feature.id,
      name: feature.place_name,
      shortName: feature.text,
      coordinates: feature.geometry.coordinates,
      category: feature.place_type[0],
      address: feature.properties.address || ''
    }));
  } catch (error) {
    console.error('Proximity search error:', error);
    throw error;
  }
}