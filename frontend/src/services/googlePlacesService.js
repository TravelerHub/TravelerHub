const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

/**
 * Search for nearby places using Google Places API
 */
export const searchNearbyPlaces = async (latitude, longitude, type = 'restaurant', radius = 1500) => {
  try {
    // Using Nearby Search (New) - this is the recommended API
    const url = `https://places.googleapis.com/v1/places:searchNearby`;
    
    const requestBody = {
      includedTypes: [type],
      maxResultCount: 10,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: {
            latitude: latitude,
            longitude: longitude
          },
          radius: radius
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.photos,places.regularOpeningHours'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Places API error:', error);
      return [];
    }

    const data = await response.json();
    
    if (!data.places) {
      return [];
    }

    return data.places.map(place => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || '',
      coordinates: [place.location.longitude, place.location.latitude],
      rating: place.rating || null,
      ratingCount: place.userRatingCount || 0,
      priceLevel: place.priceLevel || null,
      types: place.types || [],
      photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx
      })) : [],
      isOpen: place.regularOpeningHours?.openNow || null,
      openingHours: place.regularOpeningHours?.weekdayDescriptions || []
    }));
  } catch (error) {
    console.error('Error searching nearby places:', error);
    return [];
  }
};

/**
 * Get photo URL from Google Places photo reference
 */
export const getPhotoUrl = (photoName, maxWidth = 400) => {
  if (!photoName) return null;
  
  // New Places API photo format
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
};

/**
 * Get place details by ID
 */
export const getPlaceDetails = async (placeId) => {
  try {
    const url = `https://places.googleapis.com/v1/${placeId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,photos,regularOpeningHours,internationalPhoneNumber,websiteUri,reviews,googleMapsUri'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error getting place details:', error);
      return null;
    }

    const place = await response.json();
    
    return {
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || '',
      coordinates: [place.location.longitude, place.location.latitude],
      rating: place.rating || null,
      ratingCount: place.userRatingCount || 0,
      priceLevel: place.priceLevel || null,
      types: place.types || [],
      photos: place.photos ? place.photos.slice(0, 5).map(photo => ({
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
        attributions: photo.authorAttributions || []
      })) : [],
      isOpen: place.regularOpeningHours?.openNow || null,
      openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
      phone: place.internationalPhoneNumber || null,
      website: place.websiteUri || null,
      reviews: place.reviews ? place.reviews.slice(0, 3).map(review => ({
        author: review.authorAttribution?.displayName || 'Anonymous',
        rating: review.rating,
        text: review.text?.text || '',
        time: review.publishTime
      })) : [],
      googleMapsUri: place.googleMapsUri || null,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};

/**
 * Text search for places
 */
export const searchPlacesByText = async (query, latitude, longitude) => {
  try {
    const url = `https://places.googleapis.com/v1/places:searchText`;
    
    const requestBody = {
      textQuery: query,
      maxResultCount: 10,
      locationBias: {
        circle: {
          center: {
            latitude: latitude,
            longitude: longitude
          },
          radius: 5000
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.types'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google Places text search error:', error);
      return [];
    }

    const data = await response.json();
    
    if (!data.places) {
      return [];
    }

    return data.places.map(place => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || '',
      coordinates: [place.location.longitude, place.location.latitude],
      rating: place.rating || null,
      ratingCount: place.userRatingCount || 0,
      types: place.types || [],
      photos: place.photos ? place.photos.slice(0, 1).map(photo => ({
        name: photo.name,
        width: photo.widthPx,
        height: photo.heightPx
      })) : []
    }));
  } catch (error) {
    console.error('Error searching places by text:', error);
    return [];
  }
};

/**
 * Get price level symbol
 */
export const getPriceLevelSymbol = (priceLevel) => {
  const levels = {
    'PRICE_LEVEL_FREE': 'Free',
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$',
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
  };
  return levels[priceLevel] || '';
};

/**
 * Search for hidden gems — lesser-known but high-quality places nearby.
 * Searches for scenic viewpoints, local favorites, and unique spots,
 * then filters for high rating + low review count (not tourist-packed).
 */
export const searchHiddenGems = async (latitude, longitude, radius = 3000) => {
  const queries = ['scenic viewpoint', 'local favorite spot', 'hidden gem'];

  try {
    const allResults = await Promise.all(
      queries.map(q => searchPlacesByText(q, latitude, longitude))
    );

    // Flatten, deduplicate, and filter for quality + low popularity
    const seen = new Set();
    return allResults
      .flat()
      .filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        // High quality but not tourist-overrun
        return (p.rating || 0) >= 4.0 && (p.ratingCount || 0) < 500;
      })
      .slice(0, 10);
  } catch (error) {
    console.error('Error searching hidden gems:', error);
    return [];
  }
};