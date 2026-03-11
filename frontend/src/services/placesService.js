import { searchNearbyPlaces } from './googlePlacesService';

const categoryTypeMap = {
  restaurants: 'restaurant',
  cafes: 'cafe',
  hotels: 'lodging',
  attractions: 'tourist_attraction',
  gas_stations: 'gas_station',
  parking: 'parking',
  bars: 'bar',
  shopping: 'shopping_mall',
};

export async function searchByCategory(category, latitude, longitude, limit = 10) {
  const type = categoryTypeMap[category] || category;
  const results = await searchNearbyPlaces(latitude, longitude, type, 2000);
  return results.slice(0, limit).map(place => ({
    id: place.id,
    shortName: place.name,
    name: place.address,
    coordinates: place.coordinates,
    category: place.types?.[0] || category,
    address: place.address,
  }));
}
