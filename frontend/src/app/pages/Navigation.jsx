import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../../components/Map';
import { searchPlaces, getPlaceName } from '../../services/geocodingService';
import { getOptimizedRoute } from '../../services/routeService';

import { 
  searchNearbyPlaces, 
  searchPlacesByText, 
  getPlaceDetails,
  getPhotoUrl,
  getPriceLevelSymbol 
} from '../../services/googlePlacesService';

// Add these new icons
import {
  // ... existing imports
  PhotoIcon,
  StarIcon,
  PhoneIcon,
  GlobeAltIcon,
  ClockIcon as ClockIconOutline,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

// Import Heroicons
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  BookmarkIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  BuildingStorefrontIcon,
  CakeIcon,
  BuildingOfficeIcon,
  MapIcon,
  BoltIcon,
  Square3Stack3DIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  FunnelIcon,
  CheckIcon,
  FireIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';

// Import places service
import { searchByCategory } from '../../services/placesService';

function Navigation() {
  const navigate = useNavigate();
  
  // Markers state
  const [markers, setMarkers] = useState([
    {
      coordinates: [-118.2437, 34.0522],
      title: 'Starting Point',
      description: 'Los Angeles, California'
    }
  ]);

  // Location search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Route state
  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  // Places search state
  const [showPlacesSearch, setShowPlacesSearch] = useState(false);
  const [placesQuery, setPlacesQuery] = useState('');
  const [placesResults, setPlacesResults] = useState([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Saved routes state
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);

  // Categories for places search
  const categories = [
    { id: 'all', label: 'All', Icon: MagnifyingGlassIcon },
    { id: 'restaurants', label: 'Restaurants', Icon: BuildingStorefrontIcon },
    { id: 'cafes', label: 'Cafes', Icon: CakeIcon },
    { id: 'hotels', label: 'Hotels', Icon: BuildingOfficeIcon },
    { id: 'attractions', label: 'Attractions', Icon: MapIcon },
    { id: 'gas_stations', label: 'Gas', Icon: BoltIcon },
    { id: 'parking', label: 'Parking', Icon: Square3Stack3DIcon }
  ];


  const [enhancedPlaces, setEnhancedPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  // Load saved routes on mount
  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('http://localhost:8000/routes/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedRoutes(data);
      }
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  };

  // Handle location search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a location to search');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    
    try {
      const results = await searchPlaces(searchQuery, { limit: 5 });
      
      if (results.length === 0) {
        setSearchError('No results found. Try a different search term.');
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Add location from search results
  const handleAddLocation = (result) => {
    const newMarker = {
      coordinates: result.coordinates,
      title: result.shortName,
      description: result.name
    };
    
    setMarkers([...markers, newMarker]);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError('');
  };

  // Remove marker
  const handleRemoveMarker = (index) => {
    const updatedMarkers = markers.filter((_, i) => i !== index);
    setMarkers(updatedMarkers);
    
    // Clear route if less than 2 markers
    if (updatedMarkers.length < 2) {
      setCurrentRoute(null);
    }
  };

  // Handle marker drag
  const handleMarkerDrag = (index, newCoordinates) => {
    const updatedMarkers = [...markers];
    updatedMarkers[index] = {
      ...updatedMarkers[index],
      coordinates: newCoordinates
    };
    setMarkers(updatedMarkers);
    
    // Clear route when markers are dragged
    setCurrentRoute(null);
  };

  // Clear all markers and route
  const handleClearAll = () => {
    if (confirm('Clear all locations and route?')) {
      setMarkers([]);
      setCurrentRoute(null);
      setRouteError('');
    }
  };

  // Get current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        
        try {
          const place = await getPlaceName(coords);
          
          const newMarker = {
            coordinates: coords,
            title: 'Current Location',
            description: place ? place.name : 'Your current location'
          };
          
          setMarkers([...markers, newMarker]);
        } catch (error) {
          console.error('Error getting location name:', error);
          
          const newMarker = {
            coordinates: coords,
            title: 'Current Location',
            description: 'Your current location'
          };
          
          setMarkers([...markers, newMarker]);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        
        let errorMessage = 'Unable to get your location. ';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage += 'Please enable location permissions.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage += 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMessage += 'Location request timed out.';
        }
        
        alert(errorMessage);
      }
    );
  };

  // Plan route
  const handlePlanRoute = async () => {
    if (markers.length < 2) {
      setRouteError('Please add at least 2 locations');
      return;
    }

    setRouteLoading(true);
    setRouteError('');

    try {
      const waypoints = markers.map(m => m.coordinates);
      const route = await getOptimizedRoute(waypoints);
      setCurrentRoute(route);
    } catch (error) {
      setRouteError('Unable to calculate route. Please try again.');
      console.error(error);
    } finally {
      setRouteLoading(false);
    }
  };

  // Places search
  const handleSearchPlaces = async () => {
    if (!placesQuery.trim() && selectedCategory === 'all') {
      return;
    }

    setSearchingPlaces(true);

    try {
      const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
      const latitude = center[1];
      const longitude = center[0];

      let results;
      
      if (selectedCategory === 'all') {
        results = await searchPlaces(placesQuery, {
          latitude,
          longitude,
          limit: 10
        });
      } else {
        results = await searchByCategory(
          selectedCategory,
          latitude,
          longitude,
          10
        );
      }

      setPlacesResults(results);
    } catch (error) {
      console.error('Places search error:', error);
    } finally {
      setSearchingPlaces(false);
    }
  };

  // Add this new function after handleSearchPlaces
  const handleSearchGooglePlaces = async () => {
    if (!placesQuery.trim() && selectedCategory === 'all') {
    return;
  }

  setSearchingPlaces(true);

  try {
    const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
    const latitude = center[1];
    const longitude = center[0];

    let results;
    
    if (placesQuery.trim()) {
      // Text search
      results = await searchPlacesByText(placesQuery, latitude, longitude);
    } else {
      // Category search
      const categoryTypeMap = {
        restaurants: 'restaurant',
        cafes: 'cafe',
        hotels: 'lodging',
        attractions: 'tourist_attraction',
        gas_stations: 'gas_station',
        parking: 'parking'
      };
      
      const type = categoryTypeMap[selectedCategory] || 'restaurant';
      results = await searchNearbyPlaces(latitude, longitude, type);
    }

    setEnhancedPlaces(results);
    setPlacesResults([]); // Clear Mapbox results
  } catch (error) {
    console.error('Google Places search error:', error);
  } finally {
    setSearchingPlaces(false);
  }
  };

  // Function to view place details
  const handleViewPlaceDetails = async (place) => {
    setSelectedPlace(place);
    setShowPlaceDetails(true);
    setLoadingPlaceDetails(true);

    try {
      const details = await getPlaceDetails(place.id);
      if (details) {
        setSelectedPlace(details);
      }
    } catch (error) {
      console.error('Error loading place details:', error);
    } finally {
      setLoadingPlaceDetails(false);
    }
  };

  // Add place to route
  const handleAddPlaceToRoute = (place) => {
    const newMarker = {
      coordinates: place.coordinates,
      title: place.shortName || place.name,
      description: place.address
    };

    setMarkers([...markers, newMarker]);
    setPlacesResults([]);
    setPlacesQuery('');
  };

  // Save route
  const handleSaveRoute = async () => {
    if (!currentRoute || markers.length < 2) {
      alert('Please plan a route first');
      return;
    }

    setSavingRoute(true);

    try {
      const token = localStorage.getItem('token');
      
      const routeData = {
        name: routeName || `Route ${new Date().toLocaleDateString()}`,
        waypoints: markers.map(m => ({
          name: m.title,
          address: m.description,
          coordinates: m.coordinates
        })),
        route_data: currentRoute.geometry,
        total_distance: currentRoute.distance,
        total_duration: currentRoute.duration
      };

      const response = await fetch('http://localhost:8000/routes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(routeData)
      });

      if (response.ok) {
        setShowSaveModal(false);
        setRouteName('');
        loadSavedRoutes();
        alert('Route saved successfully!');
      }
    } catch (error) {
      console.error('Error saving route:', error);
      alert('Failed to save route');
    } finally {
      setSavingRoute(false);
    }
  };

  // Load saved route
  const handleLoadRoute = (route) => {
    setMarkers(route.waypoints.map(w => ({
      coordinates: w.coordinates,
      title: w.name,
      description: w.address
    })));
    
    setCurrentRoute({
      geometry: route.route_data,
      distance: route.total_distance,
      duration: route.total_duration,
      summary: {
        totalDistance: (route.total_distance / 1000).toFixed(2) + ' km',
        totalDuration: formatDuration(route.total_duration),
        estimatedArrival: calculateArrivalTime(route.total_duration)
      },
      steps: []
    });
  };

  // Delete saved route
  const handleDeleteRoute = async (routeId, routeName) => {
    if (!confirm(`Delete route "${routeName}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/routes/${routeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadSavedRoutes();
      }
    } catch (error) {
      console.error('Error deleting route:', error);
    }
  };

  // Optimize route order
  const handleOptimizeRoute = async () => {
    if (markers.length < 3) {
      alert('Need at least 3 stops to optimize');
      return;
    }

    setRouteLoading(true);

    try {
      const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
      const coordinates = markers.map(m => m.coordinates.join(',')).join(';');

      const response = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?source=first&destination=last&roundtrip=false&access_token=${MAPBOX_TOKEN}`
      );

      const data = await response.json();

      if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
        const optimizedTrip = data.trips[0];
        
        // Reorder markers based on waypoint order
        const newOrder = optimizedTrip.waypoints.map(wp => markers[wp.waypoint_index]);
        setMarkers(newOrder);

        // Automatically plan route with new order
        setTimeout(() => {
          handlePlanRoute();
        }, 500);
        
        alert('Route optimized successfully!');
      } else {
        console.error('Optimization response:', data);
        alert('Could not optimize route. Try with different locations.');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Failed to optimize route. Please try again.');
    } finally {
      setRouteLoading(false);
    }
  };

  // Helper functions
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const calculateArrivalTime = (durationSeconds) => {
    const now = new Date();
    const arrival = new Date(now.getTime() + durationSeconds * 1000);
    return arrival.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-7 h-7 text-blue-600" />
              Navigation
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Search Destinations Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MagnifyingGlassIcon className="w-5 h-5 text-blue-600" />
                Search Destinations
              </h2>

              {/* Search Input */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for a location..."
                    disabled={isSearching}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 disabled:bg-gray-100"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSearching ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <MagnifyingGlassIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Try: "coffee shop", "123 Main St", or "Central Park"
                </p>
                
                {searchError && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <XMarkIcon className="w-3 h-3" />
                    {searchError}
                  </p>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm max-h-64 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </div>
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddLocation(result)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {result.shortName}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {result.name}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {result.category}
                          </div>
                        </div>
                        <PlusIcon className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Saved Locations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4" />
                    Waypoints ({markers.length})
                  </h3>
                  {markers.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <TrashIcon className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {markers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MapPinIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No locations added yet</p>
                    </div>
                  ) : (
                    markers.map((marker, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-2 flex-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              index === 0 ? 'bg-green-500' : 
                              index === markers.length - 1 && markers.length > 1 ? 'bg-red-500' : 
                              'bg-blue-500'
                            }`}>
                              {index === 0 ? 'A' : index === markers.length - 1 && markers.length > 1 ? 'B' : index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">
                                {marker.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {marker.description}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {marker.coordinates[1].toFixed(4)}, {marker.coordinates[0].toFixed(4)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMarker(index)}
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"
                            title="Remove location"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Places Search Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <button 
                onClick={() => setShowPlacesSearch(!showPlacesSearch)}
                className="w-full flex items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-5 h-5 text-purple-600" />
                  Find Nearby Places
                </h2>
                {showPlacesSearch ? (
                  <ChevronUpIcon className="w-5 h-5" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5" />
                )}
              </button>

              {showPlacesSearch && (
                <div className="mt-4 space-y-3">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const Icon = cat.Icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            if (cat.id !== 'all') {
                              setPlacesQuery(cat.label.toLowerCase());
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                            selectedCategory === cat.id
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={placesQuery}
                      onChange={(e) => setPlacesQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchPlaces()}
                      placeholder="Search restaurants, hotels, etc..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleSeaerchGooglePlaces}
                      disabled={searchingPlaces}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {searchingPlaces ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Places Results */}
                  {placesResults.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="text-xs text-gray-500 font-medium">
                        Found {placesResults.length} places
                      </div>
                      {placesResults.map((place, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50 transition cursor-pointer group"
                          onClick={() => handleAddPlaceToRoute(place)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3 flex-1">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 flex-shrink-0">
                                {place.category?.includes('restaurant') && <BuildingStorefrontIcon className="w-5 h-5" />}
                                {place.category?.includes('cafe') && <CakeIcon className="w-5 h-5" />}
                                {place.category?.includes('hotel') && <BuildingOfficeIcon className="w-5 h-5" />}
                                {!place.category && <MapPinIcon className="w-5 h-5" />}
                              </div>
                              
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm group-hover:text-purple-700">
                                  {place.shortName || place.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <MapPinIcon className="w-3 h-3" />
                                  {place.address}
                                </div>
                                {place.category && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                      {place.category}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button className="text-purple-600 group-hover:text-purple-700 p-2 hover:bg-purple-100 rounded-lg transition">
                              <PlusIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FireIcon className="w-4 h-4" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button 
                  onClick={handleGetCurrentLocation}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                >
                  <MapPinIcon className="w-5 h-5" />
                  <span>Add Current Location</span>
                </button>
                
                <button 
                  onClick={handlePlanRoute}
                  disabled={routeLoading || markers.length < 2}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {routeLoading ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowPathIcon className="w-5 h-5" />
                  )}
                  <span>{routeLoading ? 'Planning...' : 'Plan Route'}</span>
                </button>

                <button 
                  onClick={handleOptimizeRoute}
                  disabled={markers.length < 3}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BoltIcon className="w-5 h-5" />
                  <span>Optimize Route</span>
                </button>
                
                <button 
                  onClick={() => setShowSaveModal(true)}
                  disabled={!currentRoute || markers.length < 2}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookmarkIcon className="w-5 h-5" />
                  <span>Save Route</span>
                </button>
              </div>
            </div>

            {/* Saved Routes Card */}
            {savedRoutes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MapIcon className="w-4 h-4" />
                  Saved Routes ({savedRoutes.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedRoutes.map(route => (
                    <div
                      key={route.id}
                      className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition group"
                    >
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => handleLoadRoute(route)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                            {route.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {route.waypoints.length} stops • {(route.total_distance / 1000).toFixed(1)} km
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoute(route.id, route.name);
                          }}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[700px]">
              <Map 
                markers={markers} 
                center={markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522]} 
                zoom={12}
                route={currentRoute}
                onMarkerDragEnd={handleMarkerDrag}
              />
            </div>
          </div>
        </div>

        {/* Route Details */}
        {currentRoute && currentRoute.steps && currentRoute.steps.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
              Route Overview & Directions
            </h2>
            
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
                    <MapPinIcon className="w-4 h-4" />
                    <span className="font-medium">Total Distance</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {currentRoute.summary.totalDistance}
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
                    <ClockIcon className="w-4 h-4" />
                    <span className="font-medium">Travel Time</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {currentRoute.summary.totalDuration}
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-700 text-sm mb-1">
                    <ClockIcon className="w-4 h-4" />
                    <span className="font-medium">Arrival Time</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {currentRoute.summary.estimatedArrival}
                  </div>
                </div>
              </div>

              {/* Turn-by-turn directions */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
                  Turn-by-Turn Directions ({currentRoute.steps.length} steps)
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {currentRoute.steps.map((step, index) => {
                    // Get maneuver type for icon
                    const maneuverType = step.maneuver.type;
                    const modifier = step.maneuver.modifier;
                    
                    // Determine icon based on maneuver
                    let icon = '➡️';
                    if (maneuverType === 'turn') {
                      if (modifier === 'left') icon = '⬅️';
                      else if (modifier === 'right') icon = '➡️';
                      else if (modifier === 'sharp left') icon = '↖️';
                      else if (modifier === 'sharp right') icon = '↗️';
                      else if (modifier === 'slight left') icon = '↰';
                      else if (modifier === 'slight right') icon = '↱';
                    } else if (maneuverType === 'depart') {
                      icon = '🚀';
                    } else if (maneuverType === 'arrive') {
                      icon = '🏁';
                    } else if (maneuverType === 'roundabout') {
                      icon = '🔄';
                    } else if (maneuverType === 'merge') {
                      icon = '🔀';
                    }

                    return (
                      <div 
                        key={index} 
                        className="flex gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
                      >
                        {/* Step number */}
                        <div className="flex items-start justify-center flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full font-bold text-sm flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </div>

                        {/* Instruction */}
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-2xl">{icon}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 leading-relaxed">
                                {step.maneuver.instruction}
                              </p>
                              {step.name && step.name !== step.maneuver.instruction && (
                                <p className="text-xs text-blue-600 mt-1 font-medium">
                                  on {step.name}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Distance and duration */}
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                              <MapPinIcon className="w-3 h-3" />
                              {step.distance >= 1000 
                                ? `${(step.distance / 1000).toFixed(1)} km`
                                : `${Math.round(step.distance)} m`
                              }
                            </span>
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                              <ClockIcon className="w-3 h-3" />
                              {step.duration >= 60
                                ? `${Math.round(step.duration / 60)} min`
                                : `${Math.round(step.duration)} sec`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Route State */}
        {!currentRoute && markers.length >= 2 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8 text-gray-500">
              <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium">Ready to plan your route!</p>
              <p className="text-sm mt-1">
                Click "Plan Route" to get directions between your {markers.length} locations
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Route Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BookmarkIcon className="w-6 h-6 text-blue-600" />
              Save Route
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route Name
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g., Day 1 Sightseeing"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPinIcon className="w-4 h-4" />
                <span>{markers.length} waypoints</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                <span>{currentRoute?.summary.totalDistance}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveRoute}
                disabled={savingRoute}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {savingRoute ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Save Route
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={savingRoute}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Navigation;