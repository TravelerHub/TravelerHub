import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { haversineDistance } from '../../utils/haversine';
import Map from '../../components/Map';
import { searchPlaces, getPlaceName } from '../../services/geocodingService';
import { getOptimizedRoute } from '../../services/routeService';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import {
  searchNearbyPlaces,
  searchPlacesByText,
  getPlaceDetails,
  getPhotoUrl,
  getPriceLevelSymbol,
  searchHiddenGems,
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
  ArrowsRightLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';

// Import places service
import { searchByCategory } from '../../services/placesService';

function Navigation() {
  const navigate = useNavigate();

  const mapRef = useRef(null);
  
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
    { id: 'parking', label: 'Parking', Icon: Square3Stack3DIcon },
    { id: 'hidden_gems', label: 'Hidden Gems', Icon: FireIcon }
  ];


  const [enhancedPlaces, setEnhancedPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

  // Transport mode state
  const [transportMode, setTransportMode] = useState('driving');

  // User preferences state
  const [userPreferences, setUserPreferences] = useState(null);

  // Auto-suggest places state
  const [suggestedPlaces, setSuggestedPlaces] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Real-time navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userPosition, setUserPosition] = useState(null);
  const stepListRef = useRef(null);
  const [searchParams] = useSearchParams();

  // Custom pins state (user-placed pins via map click)
  const [customPins, setCustomPins] = useState([]);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [pinLabel, setPinLabel] = useState('');
  const [addPinMode, setAddPinMode] = useState(false);

  // Load saved routes on mount
  useEffect(() => {
    loadSavedRoutes();
  }, []);

  // Add this useEffect near your other useEffects
  useEffect(() => {
    // Make function available to map markers
    window.handleViewPlaceDetails = handleViewPlaceDetails;

    return () => {
      delete window.handleViewPlaceDetails;
    };
  }, []);

  // Fetch user preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch('http://localhost:8000/preferences/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const prefs = await response.json();
          setUserPreferences(prefs);
        }
        // 401 = expired token; fail silently — navigation works without preferences
      } catch (error) {
        console.warn('Could not load preferences:', error.message);
      }
    };
    fetchPreferences();
  }, []);

  // Auto-suggest places when first marker is added
  useEffect(() => {
    if (markers.length === 0) {
      setSuggestedPlaces([]);
      return;
    }
    if (markers.length === 1 && userPreferences?.preferred_categories?.length > 0) {
      fetchSuggestedPlaces(markers[0].coordinates);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.length, userPreferences]);

  const fetchSuggestedPlaces = async (coordinates) => {
    const [lng, lat] = coordinates;
    setLoadingSuggestions(true);
    try {
      const categoryTypeMap = {
        restaurants: 'restaurant',
        cafes: 'cafe',
        hotels: 'lodging',
        attractions: 'tourist_attraction',
        bars: 'bar',
        shopping: 'shopping_mall',
      };
      const categoriesToFetch = (userPreferences?.preferred_categories || []).slice(0, 3);
      const results = await Promise.all(
        categoriesToFetch.map(cat => {
          const type = categoryTypeMap[cat] || cat;
          return searchNearbyPlaces(lat, lng, type, 2000);
        })
      );
      // Flatten and deduplicate by id
      const seen = new Set();
      const combined = results.flat().filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setSuggestedPlaces(combined.slice(0, 8));
    } catch (error) {
      console.error('Auto-suggest error:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // ── Real-time navigation handlers ────────────────────────────────
  const handleStartNavigation = () => {
    if (!currentRoute || !currentRoute.steps?.length) return;
    setIsNavigating(true);
    setCurrentStepIndex(0);
  };

  const handleExitNavigation = () => {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    setUserPosition(null);
  };

  // Handle map click — add a custom pin when in pin mode
  const handleMapClick = useCallback((lngLat) => {
    if (!addPinMode) return;
    setPendingPin(lngLat);
    setPinLabel('');
    setShowPinPrompt(true);
    setAddPinMode(false);
  }, [addPinMode]);

  const handleConfirmPin = () => {
    if (pendingPin) {
      setCustomPins(prev => [...prev, {
        lng: pendingPin.lng,
        lat: pendingPin.lat,
        label: pinLabel.trim() || 'My Pin',
        address: `${pendingPin.lat.toFixed(5)}, ${pendingPin.lng.toFixed(5)}`,
      }]);
    }
    setShowPinPrompt(false);
    setPendingPin(null);
    setPinLabel('');
  };

  const handleRemovePin = (index) => {
    setCustomPins(prev => prev.filter((_, i) => i !== index));
  };

  const handleUserPositionUpdate = useCallback((pos) => {
    setUserPosition(pos);

    if (!currentRoute?.steps) return;

    const userCoord = [pos.lng, pos.lat];
    const steps = currentRoute.steps;

    // Determine proximity threshold based on transport mode
    const threshold = transportMode === 'walking' ? 30
      : transportMode === 'cycling' ? 50
      : 100; // driving / transit

    // Check if user has reached the next step (or any step ahead)
    setCurrentStepIndex(prev => {
      for (let i = prev + 1; i < steps.length; i++) {
        if (steps[i].start_location) {
          const dist = haversineDistance(userCoord, steps[i].start_location);
          if (dist < threshold) {
            // Auto-scroll step list to current step
            if (stepListRef.current) {
              const stepEl = stepListRef.current.querySelector(`[data-step-index="${i}"]`);
              if (stepEl) stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return i;
          }
        }
      }
      return prev;
    });
  }, [currentRoute, transportMode]);

  // Handle ?destination= query param from Vision → Navigation link
  useEffect(() => {
    const dest = searchParams.get('destination');
    if (dest) {
      // Auto-search and add as second marker
      import('../../services/geocodingService').then(({ searchPlaces }) => {
        searchPlaces(dest).then(results => {
          if (results?.length > 0) {
            const place = results[0];
            setMarkers(prev => [
              ...prev,
              {
                coordinates: place.coordinates || [place.lng, place.lat],
                title: place.name || dest,
                description: place.address || dest,
              },
            ]);
          }
        });
      });
    }
  }, [searchParams]);

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
      // Get center coordinates for location-biased search
      const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
      const latitude = center[1];
      const longitude = center[0];

      // Search using Google Places
      const results = await searchPlacesByText(searchQuery, latitude, longitude);
      
      // Format results to match what the search results list expects
      const formattedResults = results.map(place => ({
        id: place.id,
        shortName: place.name,
        name: place.address,
        coordinates: place.coordinates,
        category: place.types?.[0] || 'Place',
        address: place.address
      }));

      if (formattedResults.length === 0) {
        setSearchError('No results found. Try a different search term.');
      } else {
        setSearchResults(formattedResults);
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
  const handleMarkerDrag = async (index, newCoordinates) => {
    const updatedMarkers = [...markers];
    updatedMarkers[index] = {
      ...updatedMarkers[index],
      coordinates: newCoordinates,
      description: 'Loading address...'
    };
    setMarkers(updatedMarkers);
    
    // Clear route when markers are dragged
    setCurrentRoute(null);

    // Reverse geocode to get new location name
    try {
      const place = await getPlaceName(newCoordinates);
      if (place) {
        const refreshedMarkers = [...updatedMarkers];
        refreshedMarkers[index] = {
          ...refreshedMarkers[index],
          title: place.name.split(',')[0],
          description: place.name
        };
        setMarkers(refreshedMarkers);
      }
    } catch (error) {
      console.error('Error getting new location name:', error);
    }
  };

  const handleDragEnd = (result) => {
    // If dropped outside the list, do nothing
    if (!result.destination) return;

    // If dropped in same position, do nothing
    if (result.source.index === result.destination.index) return;

    // Reorder markers array
    const reordered = [...markers];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setMarkers(reordered);
    setCurrentRoute(null); // Clear route since order changed
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
      const route = await getOptimizedRoute(waypoints, transportMode);
      setCurrentRoute(route);
      // Fetch suggestions along the calculated route
      fetchAlongRouteSuggestions(route);
    } catch (error) {
      setRouteError(error.message || 'Unable to calculate route. Please try again.');
      console.error('Route error:', error);
    } finally {
      setRouteLoading(false);
    }
  };

  // Fetch interesting places along the calculated route
  const fetchAlongRouteSuggestions = async (route) => {
    if (!route?.geometry?.coordinates || !userPreferences?.preferred_categories?.length) return;
    setLoadingSuggestions(true);
    try {
      const coords = route.geometry.coordinates;
      const numSamples = 5;
      const samplePoints = [];
      for (let i = 1; i < numSamples; i++) {
        const idx = Math.floor((i * coords.length) / (numSamples + 1));
        samplePoints.push(coords[idx]);
      }

      const categoryTypeMap = {
        restaurant: 'restaurant', cafe: 'cafe', lodging: 'lodging',
        tourist_attraction: 'tourist_attraction', museum: 'museum',
        park: 'park', shopping_mall: 'shopping_mall',
      };
      const topCategories = userPreferences.preferred_categories.slice(0, 2);

      const allResults = await Promise.all(
        samplePoints.flatMap(([lng, lat]) =>
          topCategories.map(cat => {
            const type = categoryTypeMap[cat] || cat;
            return searchNearbyPlaces(lat, lng, type, 1000);
          })
        )
      );

      // Deduplicate by id
      const seen = new Set();
      const combined = allResults.flat().filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      // Apply avoid_types filter
      const avoidTypes = userPreferences.avoid_types || [];
      const filtered = combined.filter(p => {
        if (avoidTypes.length > 0 && p.types) {
          if (avoidTypes.some(avoid => p.types.includes(avoid))) return false;
        }
        return true;
      });

      setSuggestedPlaces(filtered.slice(0, 10));
    } catch (error) {
      console.error('Along-route suggestions error:', error);
    } finally {
      setLoadingSuggestions(false);
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
      // Text search — enhance with dietary restrictions for food searches
      let query = placesQuery;
      if (userPreferences?.dietary_restrictions?.length > 0) {
        const foodTerms = ['restaurant', 'food', 'eat', 'cafe', 'dining'];
        if (foodTerms.some(t => query.toLowerCase().includes(t))) {
          query = `${userPreferences.dietary_restrictions[0]} ${query}`;
        }
      }
      results = await searchPlacesByText(query, latitude, longitude);
    } else {
      // Category search — enhance with dietary prefix for restaurant/cafe
      const categoryTypeMap = {
        restaurants: 'restaurant',
        cafes: 'cafe',
        hotels: 'lodging',
        attractions: 'tourist_attraction',
        gas_stations: 'gas_station',
        parking: 'parking'
      };

      if (selectedCategory === 'hidden_gems') {
        results = await searchHiddenGems(latitude, longitude);
      } else {
        const isFoodCategory = ['restaurants', 'cafes'].includes(selectedCategory);
        if (isFoodCategory && userPreferences?.dietary_restrictions?.length > 0) {
          const dietaryPrefix = userPreferences.dietary_restrictions[0];
          const typeLabel = selectedCategory === 'cafes' ? 'cafe' : 'restaurant';
          results = await searchPlacesByText(`${dietaryPrefix} ${typeLabel}`, latitude, longitude);
        } else {
          const type = categoryTypeMap[selectedCategory] || 'restaurant';
          results = await searchNearbyPlaces(latitude, longitude, type);
        }
      }
    }

    // Filter and rank by user preferences
    if (userPreferences && results.length > 0) {
      const priceLevelOrder = [
        'PRICE_LEVEL_FREE',
        'PRICE_LEVEL_INEXPENSIVE',
        'PRICE_LEVEL_MODERATE',
        'PRICE_LEVEL_EXPENSIVE',
        'PRICE_LEVEL_VERY_EXPENSIVE',
      ];
      const maxPriceIndex = {
        budget: 1,
        inexpensive: 2,
        moderate: 3,
        expensive: 4,
        any: 5,
      }[userPreferences.price_preference] ?? 5;
      const preferredCategories = userPreferences.preferred_categories || [];
      const avoidTypes = userPreferences.avoid_types || [];

      results = results
        .filter(p => {
          // Price filter
          if (p.priceLevel) {
            const priceIndex = priceLevelOrder.indexOf(p.priceLevel);
            if (priceIndex !== -1 && priceIndex > maxPriceIndex) return false;
          }
          // Avoid types filter
          if (avoidTypes.length > 0 && p.types) {
            if (avoidTypes.some(avoid => p.types.includes(avoid))) return false;
          }
          return true;
        })
        .map(p => {
          // Compute preference match score (0-3)
          let score = 0;
          if (preferredCategories.some(cat => p.types?.includes(cat))) score += 2;
          if (p.rating >= 4.0) score += 1;
          return { ...p, preferenceScore: score };
        })
        .sort((a, b) => b.preferenceScore - a.preferenceScore);
    }

    setEnhancedPlaces(results);
    setPlacesResults([]); // Clear old results
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
                
                <div className="max-h-64 overflow-y-auto">
                  {markers.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <MapPinIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No locations added yet</p>
                    </div>
                  ) : (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="waypoints">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2"
                          >
                            {markers.map((marker, index) => (
                              <Draggable key={`marker-${index}`} draggableId={`marker-${index}`} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`p-3 rounded-lg transition group ${
                                      snapshot.isDragging ? 'bg-blue-50 shadow-lg' : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex gap-2 flex-1">
                                        {/* Drag Handle */}
                                        <div
                                          {...provided.dragHandleProps}
                                          className="flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                          title="Drag to reorder"
                                        >
                                          ⠿
                                        </div>
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
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  )}
                </div>
              </div>
            </div>

            {/* Along Your Route / Suggested for You */}
            {(suggestedPlaces.length > 0 || loadingSuggestions) && markers.length >= 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <StarIconSolid className="w-5 h-5 text-yellow-500" />
                  {currentRoute ? 'Along Your Route' : 'Suggested for You'}
                  <span className="text-xs font-normal text-gray-400 ml-1">Based on your preferences</span>
                </h2>
                {loadingSuggestions ? (
                  <div className="flex items-center justify-center py-4">
                    <ArrowPathIcon className="w-6 h-6 text-yellow-500 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {suggestedPlaces.map((place, index) => (
                      <div
                        key={place.id || index}
                        className="border border-gray-200 rounded-lg p-3 hover:border-yellow-300 hover:bg-yellow-50 transition cursor-pointer group"
                        onClick={() => handleViewPlaceDetails(place)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-2 flex-1 min-w-0">
                            {place.photos && place.photos.length > 0 ? (
                              <img
                                src={getPhotoUrl(place.photos[0].name, 60)}
                                alt={place.name}
                                className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <StarIconSolid className="w-5 h-5 text-yellow-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">
                                {place.name}
                              </div>
                              {place.rating && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <StarIconSolid className="w-3 h-3 text-yellow-400" />
                                  <span className="text-xs text-gray-600">{place.rating}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddPlaceToRoute(place); }}
                            className="text-yellow-600 hover:text-yellow-700 p-1 hover:bg-yellow-100 rounded transition flex-shrink-0"
                            title="Add to route"
                          >
                            <PlusIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                      onClick={handleSearchGooglePlaces}
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

                  {/* Google API places */}
                  {enhancedPlaces.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Places Found ({enhancedPlaces.length})
                      </h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {enhancedPlaces.map((place, index) => (
                          <div
                            key={place.id}
                            className="p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-400 cursor-pointer transition-colors"
                            onClick={() => handleViewPlaceDetails(place)}
                          >
                            <div className="flex items-start gap-3">
                              {/* Photo Thumbnail */}
                              {place.photos && place.photos.length > 0 ? (
                                <img
                                  src={getPhotoUrl(place.photos[0].name, 100)}
                                  alt={place.name}
                                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <PhotoIcon className="w-8 h-8 text-gray-400" />
                                </div>
                              )}

                              {/* Place Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">
                                  {place.name}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                  {place.address}
                                </p>
                                
                                {/* Rating */}
                                {place.rating && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <div className="flex">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <StarIconSolid
                                          key={star}
                                          className={`w-3 h-3 ${
                                            star <= Math.round(place.rating)
                                              ? 'text-yellow-400'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {place.rating} ({place.ratingCount})
                                    </span>
                                  </div>
                                )}

                                {/* Price Level */}
                                {place.priceLevel && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <CurrencyDollarIcon className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-600">
                                      {getPriceLevelSymbol(place.priceLevel)}
                                    </span>
                                  </div>
                                )}

                                {/* Preference match badge */}
                                {place.preferenceScore >= 2 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <CheckIcon className="w-3 h-3 text-green-600" />
                                    <span className="text-xs text-green-700 font-medium">Matches preferences</span>
                                  </div>
                                )}
                              </div>

                              {/* Arrow */}
                              <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
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
                {/* Transport Mode Selector */}
                <div className="pb-1">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Transport Mode</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'driving', label: 'Drive', emoji: '🚗' },
                      { id: 'walking', label: 'Walk', emoji: '🚶' },
                      { id: 'cycling', label: 'Bike', emoji: '🚲' },
                      { id: 'transit', label: 'Transit', emoji: '🚌' },
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setTransportMode(mode.id)}
                        className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition ${
                          transportMode === mode.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-base">{mode.emoji}</span>
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGetCurrentLocation}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                >
                  <MapPinIcon className="w-5 h-5" />
                  <span>Add Current Location</span>
                </button>

                <button
                  onClick={() => setAddPinMode(true)}
                  className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${
                    addPinMode
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <MapPinIcon className="w-5 h-5" />
                  <span>{addPinMode ? 'Click map to place pin...' : 'Drop a Pin'}</span>
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

                {routeError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-1">
                    <XMarkIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {routeError}
                  </p>
                )}

                <button
                  onClick={handleOptimizeRoute}
                  disabled={markers.length < 3 || transportMode === 'transit'}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title={transportMode === 'transit' ? 'Route optimization not available for transit' : ''}
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

            {/* Custom Pins Card */}
            {customPins.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-amber-500" />
                  My Pins ({customPins.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customPins.map((pin, index) => (
                    <div key={index} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{pin.label}</p>
                        <p className="text-xs text-gray-500">{pin.address}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => {
                            setMarkers(prev => [...prev, {
                              coordinates: [pin.lng, pin.lat],
                              title: pin.label,
                              description: pin.address,
                            }]);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                          title="Add as waypoint"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemovePin(index)}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"
                          title="Remove pin"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[700px] relative">
              <Map
                ref={mapRef}
                markers={markers}
                center={markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522]}
                zoom={12}
                route={currentRoute}
                onMarkerDragEnd={handleMarkerDrag}
                enhancedPlaces={enhancedPlaces}
                navigationMode={isNavigating}
                onUserPositionUpdate={handleUserPositionUpdate}
                currentStepIndex={currentStepIndex}
                onMapClick={handleMapClick}
                customPins={customPins}
              />
              {/* "Add Pin" mode indicator */}
              {addPinMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse">
                  <MapPinIcon className="w-4 h-4" />
                  Click on the map to place a pin
                  <button onClick={() => setAddPinMode(false)} className="ml-2 hover:bg-amber-600 rounded-full p-0.5">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Floating next-instruction card during navigation */}
              {isNavigating && currentRoute?.steps?.[currentStepIndex] && (() => {
                const step = currentRoute.steps[currentStepIndex];
                const nextStep = currentRoute.steps[currentStepIndex + 1];
                const progress = Math.round(((currentStepIndex + 1) / currentRoute.steps.length) * 100);
                return (
                  <div className="absolute top-4 left-4 right-4 z-10">
                    {/* Progress bar */}
                    <div className="w-full h-1 bg-gray-200 rounded-full mb-1 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    {/* Main instruction card */}
                    <div className="bg-blue-600 rounded-xl shadow-xl p-4 text-white">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                          <ArrowUpIcon className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold leading-tight">
                            {step.maneuver?.instruction || `Step ${currentStepIndex + 1}`}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-blue-100 text-sm">
                            <span className="font-semibold text-white">
                              {step.distance >= 1000
                                ? `${(step.distance / 1000).toFixed(1)} km`
                                : `${Math.round(step.distance)} m`}
                            </span>
                            <span>
                              {step.duration >= 60
                                ? `${Math.round(step.duration / 60)} min`
                                : `${Math.round(step.duration)} sec`}
                            </span>
                            <span className="text-xs">Step {currentStepIndex + 1}/{currentRoute.steps.length}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleExitNavigation}
                          className="flex-shrink-0 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition"
                          title="Exit Navigation"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                      {/* Upcoming step preview */}
                      {nextStep && (
                        <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2 text-blue-100 text-xs">
                          <span className="font-medium text-white/70">Then:</span>
                          <span className="truncate">{nextStep.maneuver?.instruction || 'Continue'}</span>
                          <span className="ml-auto font-medium whitespace-nowrap">
                            {nextStep.distance >= 1000
                              ? `${(nextStep.distance / 1000).toFixed(1)} km`
                              : `${Math.round(nextStep.distance)} m`}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* GPS accuracy indicator */}
                    {userPosition && (
                      <div className="mt-1 text-right text-xs text-gray-500">
                        GPS accuracy: ~{Math.round(userPosition.accuracy || 0)}m
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Route Details */}
        {currentRoute && currentRoute.steps && currentRoute.steps.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
                Route Overview & Directions
              </h2>
              {!isNavigating ? (
                <button
                  onClick={handleStartNavigation}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold shadow-sm"
                >
                  <MapPinIcon className="w-4 h-4" />
                  Start Navigation
                </button>
              ) : (
                <button
                  onClick={handleExitNavigation}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold shadow-sm"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Exit Navigation
                </button>
              )}
            </div>
            
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

              {/* Journey Segment Summary Bar */}
              {(() => {
                // Group consecutive steps by travel_mode into segments
                const segments = [];
                let current = null;
                currentRoute.steps.forEach(step => {
                  const mode = step.travel_mode || 'DRIVING';
                  if (!current || current.mode !== mode) {
                    current = { mode, duration: 0, steps: [] };
                    segments.push(current);
                  }
                  current.duration += step.duration;
                  current.steps.push(step);
                });

                const modeIcon = (mode, transit) => {
                  if (mode === 'TRANSIT' && transit) {
                    const vt = transit.vehicleType;
                    if (vt === 'SUBWAY') return '🚇';
                    if (vt === 'TRAM') return '🚊';
                    if (vt === 'RAIL') return '🚂';
                    if (vt === 'FERRY') return '⛴';
                    return '🚌';
                  }
                  if (mode === 'WALKING') return '🚶';
                  if (mode === 'BICYCLING') return '🚲';
                  return '🚗';
                };

                const fmtDur = (s) => {
                  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
                  return `${Math.round(s / 60)} min`;
                };

                if (segments.length <= 1) return null;

                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Journey Breakdown</p>
                    <div className="flex items-center flex-wrap gap-2">
                      {segments.map((seg, i) => {
                        const firstTransit = seg.steps.find(s => s.transit)?.transit;
                        const lineName = firstTransit?.lineShortName || firstTransit?.lineName;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-sm shadow-sm">
                              <span>{modeIcon(seg.mode, firstTransit)}</span>
                              <span className="font-medium text-gray-800">
                                {lineName ? `${lineName} · ` : ''}{fmtDur(seg.duration)}
                              </span>
                              {firstTransit?.numStops && (
                                <span className="text-gray-500 text-xs">({firstTransit.numStops} stops)</span>
                              )}
                            </div>
                            {i < segments.length - 1 && (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Turn-by-turn directions */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <ArrowsRightLeftIcon className="w-5 h-5 text-blue-600" />
                  Turn-by-Turn Directions ({currentRoute.steps.length} steps)
                </h3>
                <div ref={stepListRef} className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {currentRoute.steps.map((step, index) => {
                    // Step highlighting for navigation mode
                    const isCompleted = isNavigating && index < currentStepIndex;
                    const isCurrent = isNavigating && index === currentStepIndex;

                    // ── TRANSIT STEP CARD ─────────────────────────────────
                    if (step.travel_mode === 'TRANSIT' && step.transit) {
                      const t = step.transit;
                      const vt = t.vehicleType || 'BUS';
                      const vehicleLabel = { BUS: 'Bus', SUBWAY: 'Subway', TRAM: 'Tram', RAIL: 'Train', FERRY: 'Ferry' }[vt] || vt;
                      const vehicleEmoji = { BUS: '🚌', SUBWAY: '🚇', TRAM: '🚊', RAIL: '🚂', FERRY: '⛴' }[vt] || '🚌';
                      const borderCls = { BUS: 'border-amber-300', SUBWAY: 'border-blue-400', TRAM: 'border-green-400', RAIL: 'border-gray-400', FERRY: 'border-cyan-400' }[vt] || 'border-amber-300';
                      const bgCls = { BUS: 'bg-amber-50', SUBWAY: 'bg-blue-50', TRAM: 'bg-green-50', RAIL: 'bg-gray-50', FERRY: 'bg-cyan-50' }[vt] || 'bg-amber-50';
                      const headerCls = { BUS: 'text-amber-800 bg-amber-100 border-amber-200', SUBWAY: 'text-blue-800 bg-blue-100 border-blue-200', TRAM: 'text-green-800 bg-green-100 border-green-200', RAIL: 'text-gray-800 bg-gray-100 border-gray-200', FERRY: 'text-cyan-800 bg-cyan-100 border-cyan-200' }[vt] || 'text-amber-800 bg-amber-100 border-amber-200';

                      return (
                        <div key={index} data-step-index={index} className={`rounded-xl border-2 ${borderCls} ${bgCls} overflow-hidden transition-all ${isCompleted ? 'opacity-40' : ''} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                          {/* Header row */}
                          <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${headerCls}`}>
                            <span className="text-lg">{vehicleEmoji}</span>
                            <span className="font-semibold text-sm">
                              {vehicleLabel}{t.lineName ? ` · ${t.lineName}` : ''}
                              {t.lineShortName && t.lineShortName !== t.lineName ? ` (${t.lineShortName})` : ''}
                            </span>
                            <div className="ml-auto flex items-center gap-2 text-xs opacity-75">
                              <ClockIcon className="w-3.5 h-3.5" />
                              {step.duration >= 60 ? `${Math.round(step.duration / 60)} min` : `${step.duration}s`}
                            </div>
                          </div>

                          {/* Body */}
                          <div className="px-4 py-3 space-y-2.5">
                            {/* Departure stop */}
                            {t.departureStop && (
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white shadow mt-1" />
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide leading-none mb-0.5">Board</p>
                                  <p className="text-sm font-semibold text-gray-900">{t.departureStop}</p>
                                  {t.departureTime && <p className="text-xs text-gray-500 mt-0.5">{t.departureTime}</p>}
                                </div>
                              </div>
                            )}

                            {/* Stops / headsign connector */}
                            {(t.numStops || t.headsign) && (
                              <div className="flex items-center gap-3 pl-1.5">
                                <div className="w-0.5 h-7 bg-gray-300 ml-0.5" />
                                <p className="text-xs text-gray-500 ml-2">
                                  {t.numStops ? `${t.numStops} stops` : ''}
                                  {t.numStops && t.headsign ? ' · ' : ''}
                                  {t.headsign ? `toward ${t.headsign}` : ''}
                                </p>
                              </div>
                            )}

                            {/* Arrival stop */}
                            {t.arrivalStop && (
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white shadow mt-1" />
                                <div>
                                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide leading-none mb-0.5">Exit</p>
                                  <p className="text-sm font-semibold text-gray-900">{t.arrivalStop}</p>
                                  {t.arrivalTime && <p className="text-xs text-gray-500 mt-0.5">{t.arrivalTime}</p>}
                                </div>
                              </div>
                            )}

                            {/* Fallback if no stop data */}
                            {!t.departureStop && !t.arrivalStop && (
                              <p className="text-sm text-gray-700">{step.maneuver.instruction}</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // ── DRIVING / WALKING / CYCLING STEP CARD ────────────
                    const maneuverType = (step.maneuver.type || '').toLowerCase();

                    const getDirectionIcon = (type) => {
                      if (type.includes('arrive')) return <MapPinIcon className="w-5 h-5 text-red-500" />;
                      if (type.includes('depart')) return <MapPinIcon className="w-5 h-5 text-green-500" />;
                      if (type.includes('roundabout') || type.includes('rotary')) return <ArrowPathIcon className="w-5 h-5 text-gray-600" />;
                      if (type.includes('uturn') || type.includes('u-turn')) return <ArrowUturnLeftIcon className="w-5 h-5 text-gray-700" />;
                      if (type.includes('sharp-right') || type.includes('sharp right')) return <ArrowUturnRightIcon className="w-5 h-5 text-gray-700" />;
                      if (type.includes('sharp-left') || type.includes('sharp left')) return <ArrowUturnLeftIcon className="w-5 h-5 text-gray-700" />;
                      if (type.includes('slight-right') || type.includes('slight right') || type.includes('ramp-right')) return <ArrowRightIcon className="w-5 h-5 text-gray-700" style={{ transform: 'rotate(-30deg)' }} />;
                      if (type.includes('slight-left') || type.includes('slight left') || type.includes('ramp-left')) return <ArrowLeftIcon className="w-5 h-5 text-gray-700" style={{ transform: 'rotate(30deg)' }} />;
                      if (type.includes('turn-right') || (type.includes('right') && !type.includes('left'))) return <ArrowRightIcon className="w-5 h-5 text-gray-700" />;
                      if (type.includes('turn-left') || (type.includes('left') && !type.includes('right'))) return <ArrowLeftIcon className="w-5 h-5 text-gray-700" />;
                      return <ArrowUpIcon className="w-5 h-5 text-gray-700" />;
                    };

                    const modeBadge = step.travel_mode === 'WALKING'
                      ? { emoji: '🚶', cls: 'text-green-700 bg-green-100' }
                      : step.travel_mode === 'BICYCLING'
                      ? { emoji: '🚲', cls: 'text-orange-700 bg-orange-100' }
                      : { emoji: '🚗', cls: 'text-blue-700 bg-blue-100' };

                    return (
                      <div
                        key={index}
                        data-step-index={index}
                        className={`flex gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group ${isCompleted ? 'opacity-40' : ''} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                      >
                        {/* Step number */}
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full font-bold text-xs flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </div>

                        {/* Direction icon */}
                        <div className="flex-shrink-0">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                            {getDirectionIcon(maneuverType)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 leading-relaxed">
                            {step.maneuver.instruction}
                          </p>
                          {step.name && step.name !== step.maneuver.instruction && (
                            <p className="text-xs text-blue-600 mt-0.5 font-medium flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              {step.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                              <MapPinIcon className="w-3 h-3" />
                              {step.distance >= 1000
                                ? `${(step.distance / 1000).toFixed(1)} km`
                                : `${Math.round(step.distance)} m`}
                            </span>
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                              <ClockIcon className="w-3 h-3" />
                              {step.duration >= 60
                                ? `${Math.round(step.duration / 60)} min`
                                : `${Math.round(step.duration)} sec`}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-medium ${modeBadge.cls}`}>
                              {modeBadge.emoji}
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
      {/* Pin Label Prompt Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-amber-500" />
              Name Your Pin
            </h3>
            <input
              type="text"
              value={pinLabel}
              onChange={(e) => setPinLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmPin()}
              placeholder="e.g., Nice viewpoint, Meet here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none mb-2"
              autoFocus
            />
            {pendingPin && (
              <p className="text-xs text-gray-400 mb-4">
                {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmPin}
                className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 font-medium transition"
              >
                Add Pin
              </button>
              <button
                onClick={() => { setShowPinPrompt(false); setPendingPin(null); }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* Place Details Modal */}
      {showPlaceDetails && selectedPlace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Place Details</h2>
              <button
                onClick={() => setShowPlaceDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loadingPlaceDetails ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Photos Gallery */}
                  {selectedPlace.photos && selectedPlace.photos.length > 0 && (
                    <div className="mb-6">
                      <div className="grid grid-cols-3 gap-2">
                        {selectedPlace.photos.map((photo, index) => (
                          <img
                            key={index}
                            src={getPhotoUrl(photo.name, 400)}
                            alt={`${selectedPlace.name} photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Place Name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedPlace.name}
                  </h3>

                  {/* Rating & Price */}
                  <div className="flex items-center gap-4 mb-4">
                    {selectedPlace.rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <StarIconSolid
                              key={star}
                              className={`w-5 h-5 ${
                                star <= Math.round(selectedPlace.rating)
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {selectedPlace.rating} ({selectedPlace.ratingCount} reviews)
                        </span>
                      </div>
                    )}
                    
                    {selectedPlace.priceLevel && (
                      <span className="text-sm font-medium text-gray-700">
                        {getPriceLevelSymbol(selectedPlace.priceLevel)}
                      </span>
                    )}

                    {selectedPlace.isOpen !== null && (
                      <span className={`text-sm font-medium ${selectedPlace.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPlace.isOpen ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-3 mb-4">
                    <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{selectedPlace.address}</p>
                  </div>

                  {/* Phone */}
                  {selectedPlace.phone && (
                    <div className="flex items-center gap-3 mb-4">
                      <PhoneIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <a 
                        href={`tel:${selectedPlace.phone}`}
                        className="text-purple-600 hover:underline"
                      >
                        {selectedPlace.phone}
                      </a>
                    </div>
                  )}

                  {/* Website */}
                  {selectedPlace.website && (
                    <div className="flex items-center gap-3 mb-4">
                      <GlobeAltIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <a 
                        href={selectedPlace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline truncate"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  {/* Opening Hours */}
                  {selectedPlace.openingHours && selectedPlace.openingHours.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <ClockIconOutline className="w-5 h-5 text-gray-400" />
                        <h4 className="font-semibold text-gray-900">Hours</h4>
                      </div>
                      <div className="ml-7 space-y-1">
                        {selectedPlace.openingHours.map((hours, index) => (
                          <p key={index} className="text-sm text-gray-600">
                            {hours}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reviews */}
                  {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Recent Reviews</h4>
                      <div className="space-y-4">
                        {selectedPlace.reviews.map((review, index) => (
                          <div key={index} className="border-l-4 border-purple-200 pl-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {review.author}
                              </span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <StarIconSolid
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= review.rating
                                        ? 'text-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-3">
                              {review.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        handleAddPlaceToRoute(selectedPlace);
                        setShowPlaceDetails(false);
                      }}
                      className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Add to Route
                    </button>
                    <button
                      onClick={() => {
                        const [lng, lat] = selectedPlace.coordinates;
                        if (mapRef.current) {
                          mapRef.current.flyTo({
                            center: [lng, lat],
                            zoom: 16,
                            duration: 2000
                          });
                        }
                        setShowPlaceDetails(false);
                      }}
                      className="flex-1 px-4 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium"
                    >
                      View on Map
                    </button>
                  </div>

                  {/* Reserve a Table — shown for restaurants, cafes, food places */}
                  {selectedPlace.googleMapsUri && selectedPlace.types &&
                    selectedPlace.types.some(t => ['restaurant', 'cafe', 'food', 'meal_delivery', 'meal_takeaway', 'bar'].includes(t)) && (
                    <a
                      href={selectedPlace.googleMapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full mt-3 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-center transition"
                    >
                      Reserve a Table
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Navigation;