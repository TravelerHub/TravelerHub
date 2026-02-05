const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Search for places using Mapbox Geocoding API
 */
export const searchPlaces = async (query, options = {}) => {
  try {
    const {
      latitude,
      longitude,
      types = ['poi', 'address', 'place'],
      limit = 10
    } = options;

    // Build proximity parameter
    let proximityParam = '';
    if (latitude && longitude) {
      proximityParam = `&proximity=${longitude},${latitude}`;
    }

    // Build types parameter
    const typesParam = types.join(',');

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=${limit}&types=${typesParam}${proximityParam}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features) {
      return data.features.map(feature => ({
        id: feature.id,
        name: feature.place_name,
        shortName: feature.text,
        address: feature.place_name,
        coordinates: feature.center, // [lng, lat]
        category: feature.properties.category || feature.place_type.join(', '),
        context: feature.context || []
      }));
    }

    return [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
};

/**
 * Search for nearby places by category
 */
export const searchByCategory = async (category, latitude, longitude, limit = 10) => {
  const categoryQueries = {
    restaurants: 'restaurant',
    cafes: 'cafe coffee',
    bars: 'bar pub',
    hotels: 'hotel',
    attractions: 'museum theater landmark',
    gas_stations: 'gas station fuel',
    parking: 'parking'
  };

  const query = categoryQueries[category] || category;

  return searchPlaces(query, {
    latitude,
    longitude,
    types: ['poi'],
    limit
  });
};

/**
 * Search specifically for restaurants with cuisine filter
 */
export const searchRestaurants = async (options = {}) => {
  const {
    latitude,
    longitude,
    cuisine = null,
    limit = 10
  } = options;

  let query = cuisine ? `${cuisine} restaurant` : 'restaurant';

  return searchPlaces(query, {
    latitude,
    longitude,
    types: ['poi'],
    limit
  });
};

/**
 * Get place name from coordinates (reverse geocoding)
 */
export const getPlaceName = async (coordinates) => {
  try {
    const [lng, lat] = coordinates;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      return {
        name: data.features[0].place_name,
        shortName: data.features[0].text
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting place name:', error);
    return null;
  }
};


export const getPlaceDetails = async (placeId) => {
  try {
    // Mapbox provides details through the retrieve endpoint
    const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${placeId}?` +
      `session_token=${generateSessionToken()}&` +
      `access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      return {
        id: feature.id,
        name: feature.properties.name,
        address: feature.properties.full_address || feature.properties.place_formatted,
        coordinates: feature.geometry.coordinates,
        category: feature.properties.poi_category || feature.properties.category,
        phone: feature.properties.tel,
        website: feature.properties.url,
        // Mapbox doesn't provide photos/ratings directly
        // We'll add those separately
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};

// Helper to generate session token for search
let sessionToken = null;
const generateSessionToken = () => {
  if (!sessionToken) {
    sessionToken = Math.random().toString(36).substring(7);
  }
  return sessionToken;
};