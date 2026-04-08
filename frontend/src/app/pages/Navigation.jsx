import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar_Dashboard from '../../components/navbar/Navbar_dashboard.jsx';
import { SIDEBAR_ITEMS } from '../../constants/sidebarItems.js';
import { API_BASE } from '../../config';
import { haversineDistance } from '../../utils/haversine';
import Map from '../../components/Map';
import { searchPlaces, getPlaceName } from '../../services/geocodingService';
import { getOptimizedRoute } from '../../services/routeService';
import { ensureActiveGroupId, getActiveGroupId, getMyGroups, setActiveGroupId } from '../../services/groupService';
import { syncMyPosition } from '../../services/smartRouteService';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// GCS components
import FairPointFinder from '../../components/FairPointFinder';
import GroupArrivalSync from '../../components/GroupArrivalSync';
import RankedChoicePoll from '../../components/RankedChoicePoll';
import WeatherRouteAlert from '../../components/WeatherRouteAlert';
import GroupSocialContract from '../../components/GroupSocialContract';
import RoutePreferences from '../../components/RoutePreferences';
import { planSmartRoute } from '../../services/smartRouteService';

import {
  searchNearbyPlaces,
  searchPlacesByText,
  getPlaceDetails,
  getPhotoUrl,
  getPriceLevelSymbol,
  searchHiddenGems,
} from '../../services/googlePlacesService';

import {
  PhotoIcon,
  StarIcon,
  PhoneIcon,
  GlobeAltIcon,
  ClockIcon as ClockIconOutline,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  ArrowPathIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  BookmarkIcon,
  BuildingStorefrontIcon,
  CakeIcon,
  BuildingOfficeIcon,
  MapIcon,
  BoltIcon,
  Square3Stack3DIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckIcon,
  FireIcon,
  ArrowsRightLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3Icon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

import { searchByCategory } from '../../services/placesService';

function Navigation() {
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const [markers, setMarkers] = useState([
    { coordinates: [-118.2437, 34.0522], title: 'Starting Point', description: 'Los Angeles, California' }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [showPlacesSearch, setShowPlacesSearch] = useState(false);
  const [placesQuery, setPlacesQuery] = useState('');
  const [placesResults, setPlacesResults] = useState([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupIdState] = useState('');

  // Mobile responsive state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);

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

  const [transportMode, setTransportMode] = useState('driving');
  const [userPreferences, setUserPreferences] = useState(null);
  const [suggestedPlaces, setSuggestedPlaces] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userPosition, setUserPosition] = useState(null);
  const stepListRef = useRef(null);
  const [searchParams] = useSearchParams();

  const [customPins, setCustomPins] = useState([]);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [pinLabel, setPinLabel] = useState('');
  const [addPinMode, setAddPinMode] = useState(false);

  // Route preference state (scenic/foodie/budget/fastest)
  const [routePreference, setRoutePreference] = useState('fastest');
  const [smartChapters, setSmartChapters] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  // GCS state
  const [activePollId, setActivePollId] = useState(null);
  const [showGcsPanel, setShowGcsPanel] = useState(false);
  const [routeDestination, setRouteDestination] = useState(null); // for Group Arrival Sync
  const lastSyncRef = useRef(0);
  const isReroutingRef = useRef(false); // prevents re-route spam

  useEffect(() => {
    const boot = async () => {
      try {
        const allGroups = await getMyGroups();
        setGroups(allGroups);
        let groupId = getActiveGroupId();
        const found = allGroups.some((g) => String(g.group_id || g.id) === String(groupId));
        if (!found) groupId = await ensureActiveGroupId();
        setActiveGroupIdState(groupId || '');
      } catch (error) {
        console.error('Failed to initialize groups:', error);
        setGroups([]);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    loadSavedRoutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  useEffect(() => {
    window.handleViewPlaceDetails = handleViewPlaceDetails;
    return () => { delete window.handleViewPlaceDetails; };
  }, []);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await fetch(`${API_BASE}/preferences/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) setUserPreferences(await response.json());
      } catch (error) {
        console.warn('Could not load preferences:', error.message);
      }
    };
    fetchPreferences();
  }, []);

  // Auto-replan when route preference changes (only if a route already exists)
  const prevPreferenceRef = useRef(routePreference);
  useEffect(() => {
    if (prevPreferenceRef.current === routePreference) return;
    prevPreferenceRef.current = routePreference;
    if (currentRoute && markers.length >= 2) {
      handlePlanRoute();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePreference]);

  useEffect(() => {
    if (markers.length === 0) { setSuggestedPlaces([]); return; }
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
        restaurants: 'restaurant', cafes: 'cafe', hotels: 'lodging',
        attractions: 'tourist_attraction', bars: 'bar', shopping: 'shopping_mall',
      };
      const categoriesToFetch = (userPreferences?.preferred_categories || []).slice(0, 3);
      const results = await Promise.all(
        categoriesToFetch.map(cat => {
          const type = categoryTypeMap[cat] || cat;
          return searchNearbyPlaces(lat, lng, type, 2000);
        })
      );
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
        lng: pendingPin.lng, lat: pendingPin.lat,
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

    // Sync position to backend for group tracking (throttled to every 5s)
    const now = Date.now();
    if (activeGroupId && now - lastSyncRef.current > 5000) {
      lastSyncRef.current = now;
      syncMyPosition(activeGroupId, {
        lat: pos.lat, lng: pos.lng,
        heading: pos.heading, accuracy: pos.accuracy,
      }).catch(() => {}); // fire-and-forget
    }

    if (!currentRoute?.steps) return;
    const userCoord = [pos.lng, pos.lat];
    const steps = currentRoute.steps;
    const stepThreshold = transportMode === 'walking' ? 30 : transportMode === 'cycling' ? 50 : 100;

    // ── Deviation detection ──
    // Find the minimum distance from user to any point on the route polyline
    if (isNavigating && currentRoute.geometry?.coordinates && !isReroutingRef.current) {
      const coords = currentRoute.geometry.coordinates;
      let minDist = Infinity;
      // Sample every 5th coordinate for performance (polylines can have thousands of points)
      for (let i = 0; i < coords.length; i += 5) {
        const d = haversineDistance(userCoord, coords[i]);
        if (d < minDist) minDist = d;
        if (d < stepThreshold) break; // close enough, skip rest
      }
      // Reroute threshold: 3x the step-matching threshold
      const deviationThreshold = transportMode === 'walking' ? 80 : transportMode === 'cycling' ? 150 : 300;
      if (minDist > deviationThreshold) {
        isReroutingRef.current = true;
        // Replace the first marker with the user's current position and re-plan
        setMarkers(prev => {
          const updated = [...prev];
          updated[0] = { coordinates: [pos.lng, pos.lat], title: 'Current Location', description: 'Rerouted' };
          return updated;
        });
        handlePlanRoute().finally(() => {
          // Cooldown: prevent another reroute for 15s
          setTimeout(() => { isReroutingRef.current = false; }, 15000);
        });
        return;
      }
    }

    // ── Step advancement ──
    setCurrentStepIndex(prev => {
      for (let i = prev + 1; i < steps.length; i++) {
        if (steps[i].start_location) {
          const dist = haversineDistance(userCoord, steps[i].start_location);
          if (dist < stepThreshold) {
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
  }, [currentRoute, transportMode, activeGroupId, isNavigating]);

  useEffect(() => {
    const dest = searchParams.get('destination');
    if (dest) {
      import('../../services/geocodingService').then(({ searchPlaces }) => {
        searchPlaces(dest).then(results => {
          if (results?.length > 0) {
            const place = results[0];
            setMarkers(prev => [...prev, {
              coordinates: place.coordinates || [place.lng, place.lat],
              title: place.name || dest,
              description: place.address || dest,
            }]);
          }
        });
      });
    }
  }, [searchParams]);

  const loadSavedRoutes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const query = activeGroupId ? `?trip_id=${encodeURIComponent(activeGroupId)}` : '';
      const response = await fetch(`${API_BASE}/routes/${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setSavedRoutes(await response.json());
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchError('Please enter a location to search'); return; }
    setIsSearching(true);
    setSearchError('');
    try {
      const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
      const results = await searchPlacesByText(searchQuery, center[1], center[0]);
      const formattedResults = results.map(place => ({
        id: place.id, shortName: place.name, name: place.address,
        coordinates: place.coordinates, category: place.types?.[0] || 'Place', address: place.address
      }));
      if (formattedResults.length === 0) setSearchError('No results found. Try a different search term.');
      else setSearchResults(formattedResults);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = (result) => {
    setMarkers([...markers, { coordinates: result.coordinates, title: result.shortName, description: result.name }]);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError('');
  };

  const handleRemoveMarker = (index) => {
    const updatedMarkers = markers.filter((_, i) => i !== index);
    setMarkers(updatedMarkers);
    if (updatedMarkers.length < 2) setCurrentRoute(null);
  };

  const handleMarkerDrag = async (index, newCoordinates) => {
    const updatedMarkers = [...markers];
    updatedMarkers[index] = { ...updatedMarkers[index], coordinates: newCoordinates, description: 'Loading address...' };
    setMarkers(updatedMarkers);
    setCurrentRoute(null);
    try {
      const place = await getPlaceName(newCoordinates);
      if (place) {
        const refreshedMarkers = [...updatedMarkers];
        refreshedMarkers[index] = { ...refreshedMarkers[index], title: place.name.split(',')[0], description: place.name };
        setMarkers(refreshedMarkers);
      }
    } catch (error) {
      console.error('Error getting new location name:', error);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const reordered = [...markers];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setMarkers(reordered);
    setCurrentRoute(null);
  };

  const handleClearAll = () => {
    if (confirm('Clear all locations and route?')) {
      setMarkers([]);
      setCurrentRoute(null);
      setRouteError('');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation is not supported by your browser'); return; }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        try {
          const place = await getPlaceName(coords);
          setMarkers([...markers, { coordinates: coords, title: 'Current Location', description: place ? place.name : 'Your current location' }]);
        } catch (error) {
          console.error('Error getting location name:', error);
          setMarkers([...markers, { coordinates: coords, title: 'Current Location', description: 'Your current location' }]);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Unable to get your location. ';
        if (error.code === error.PERMISSION_DENIED) errorMessage += 'Please enable location permissions.';
        else if (error.code === error.POSITION_UNAVAILABLE) errorMessage += 'Location information is unavailable.';
        else if (error.code === error.TIMEOUT) errorMessage += 'Location request timed out.';
        alert(errorMessage);
      }
    );
  };

  const handlePlanRoute = async () => {
    if (markers.length < 2) { setRouteError('Please add at least 2 locations'); return; }
    setRouteLoading(true);
    setRouteError('');
    setSmartChapters([]);
    setSmartSuggestions([]);
    try {
      const waypoints = markers.map(m => m.coordinates);

      // Always get the base route for geometry + steps (needed for turn-by-turn nav)
      const route = await getOptimizedRoute(waypoints, transportMode);
      setCurrentRoute(route);

      // Set destination for Group Arrival Sync
      const lastWp = waypoints[waypoints.length - 1];
      setRouteDestination({ lat: lastWp[1], lng: lastWp[0] });

      // If preference is NOT fastest, also call the smart route for chapters + POI suggestions
      if (routePreference !== 'fastest') {
        try {
          const smartWaypoints = markers.map(m => ({
            name: m.title || 'Waypoint',
            coordinates: m.coordinates,
          }));
          const smartResult = await planSmartRoute(
            smartWaypoints,
            transportMode,
            routePreference,
            new Date().toISOString(),
            activeGroupId || null,
          );
          setSmartChapters(smartResult.chapters || []);
          setSmartSuggestions(smartResult.suggestions || []);
        } catch (smartErr) {
          console.warn('Smart route enhancement failed (using basic route):', smartErr.message);
        }
      }

      fetchAlongRouteSuggestions(route);
    } catch (error) {
      setRouteError(error.message || 'Unable to calculate route. Please try again.');
      console.error('Route error:', error);
    } finally {
      setRouteLoading(false);
    }
  };

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
          topCategories.map(cat => searchNearbyPlaces(lat, lng, categoryTypeMap[cat] || cat, 1000))
        )
      );
      const seen = new Set();
      const combined = allResults.flat().filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
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

  const handleSearchPlaces = async () => {
    if (!placesQuery.trim() && selectedCategory === 'all') return;
    setSearchingPlaces(true);
    try {
      const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
      const latitude = center[1];
      const longitude = center[0];
      let results;
      if (selectedCategory === 'all') {
        results = await searchPlaces(placesQuery, { latitude, longitude, limit: 10 });
      } else {
        results = await searchByCategory(selectedCategory, latitude, longitude, 10);
      }
      setPlacesResults(results);
    } catch (error) {
      console.error('Places search error:', error);
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleSearchGooglePlaces = async () => {
    if (!placesQuery.trim() && selectedCategory === 'all') return;
    setSearchingPlaces(true);
    try {
      const center = markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522];
      const latitude = center[1];
      const longitude = center[0];
      let results;
      if (placesQuery.trim()) {
        let query = placesQuery;
        if (userPreferences?.dietary_restrictions?.length > 0) {
          const foodTerms = ['restaurant', 'food', 'eat', 'cafe', 'dining'];
          if (foodTerms.some(t => query.toLowerCase().includes(t))) {
            query = `${userPreferences.dietary_restrictions[0]} ${query}`;
          }
        }
        results = await searchPlacesByText(query, latitude, longitude);
      } else {
        const categoryTypeMap = {
          restaurants: 'restaurant', cafes: 'cafe', hotels: 'lodging',
          attractions: 'tourist_attraction', gas_stations: 'gas_station', parking: 'parking'
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
      if (userPreferences && results.length > 0) {
        const priceLevelOrder = ['PRICE_LEVEL_FREE','PRICE_LEVEL_INEXPENSIVE','PRICE_LEVEL_MODERATE','PRICE_LEVEL_EXPENSIVE','PRICE_LEVEL_VERY_EXPENSIVE'];
        const maxPriceIndex = { budget: 1, inexpensive: 2, moderate: 3, expensive: 4, any: 5 }[userPreferences.price_preference] ?? 5;
        const preferredCategories = userPreferences.preferred_categories || [];
        const avoidTypes = userPreferences.avoid_types || [];
        results = results
          .filter(p => {
            if (p.priceLevel) {
              const priceIndex = priceLevelOrder.indexOf(p.priceLevel);
              if (priceIndex !== -1 && priceIndex > maxPriceIndex) return false;
            }
            if (avoidTypes.length > 0 && p.types) {
              if (avoidTypes.some(avoid => p.types.includes(avoid))) return false;
            }
            return true;
          })
          .map(p => {
            let score = 0;
            if (preferredCategories.some(cat => p.types?.includes(cat))) score += 2;
            if (p.rating >= 4.0) score += 1;
            return { ...p, preferenceScore: score };
          })
          .sort((a, b) => b.preferenceScore - a.preferenceScore);
      }
      setEnhancedPlaces(results);
      setPlacesResults([]);
    } catch (error) {
      console.error('Google Places search error:', error);
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleViewPlaceDetails = async (place) => {
    setSelectedPlace(place);
    setShowPlaceDetails(true);
    setLoadingPlaceDetails(true);
    try {
      const details = await getPlaceDetails(place.id);
      if (details) setSelectedPlace(details);
    } catch (error) {
      console.error('Error loading place details:', error);
    } finally {
      setLoadingPlaceDetails(false);
    }
  };

  const handleAddPlaceToRoute = (place) => {
    setMarkers([...markers, { coordinates: place.coordinates, title: place.shortName || place.name, description: place.address }]);
    setPlacesResults([]);
    setPlacesQuery('');
  };

  const handleSaveRoute = async () => {
    if (!currentRoute || markers.length < 2) { alert('Please plan a route first'); return; }
    setSavingRoute(true);
    try {
      const token = localStorage.getItem('token');
      const routeData = {
        name: routeName || `Route ${new Date().toLocaleDateString()}`,
        waypoints: markers.map(m => ({ name: m.title, address: m.description, coordinates: m.coordinates })),
        route_data: currentRoute.geometry,
        total_distance: currentRoute.distance,
        total_duration: currentRoute.duration,
        trip_id: activeGroupId || null,
      };
      const response = await fetch(`${API_BASE}/routes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

  const handleLoadRoute = (route) => {
    setMarkers(route.waypoints.map(w => ({ coordinates: w.coordinates, title: w.name, description: w.address })));
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

  const handleDeleteRoute = async (routeId, routeName) => {
    if (!confirm(`Delete route "${routeName}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/routes/${routeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) loadSavedRoutes();
    } catch (error) {
      console.error('Error deleting route:', error);
    }
  };

  const handleOptimizeRoute = async () => {
    if (markers.length < 3) { alert('Need at least 3 stops to optimize'); return; }
    setRouteLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/navigation/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          coordinates: markers.map(m => m.coordinates),
          mode: transportMode === 'cycling' ? 'cycling' : transportMode === 'walking' ? 'walking' : 'driving',
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Optimization failed');
      }
      const data = await response.json();
      const newOrder = data.optimized_order.map(i => markers[i]);
      setMarkers(newOrder);
      setTimeout(() => { handlePlanRoute(); }, 300);
    } catch (error) {
      console.error('Optimization error:', error);
      alert(error.message || 'Failed to optimize route. Please try again.');
    } finally {
      setRouteLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const calculateArrivalTime = (durationSeconds) => {
    const now = new Date();
    const arrival = new Date(now.getTime() + durationSeconds * 1000);
    return arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // ── Color palette ────────────────────────────────────────────────────────────
  // #160f29  deep dark   (text, headings)
  // #fbfbf2  off-white   (panel backgrounds)
  // #5c6b73  slate-gray  (secondary text, muted)
  // #183a37  dark teal   (active accent, buttons)
  // #000000  sidebar bg
  // #e8e8e0  input/card bg
  // #d1d1c7  borders

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f3f4f6' }}>

      {/* ══ MOBILE SIDEBAR BACKDROP ═══════════════════════════════════════════ */}
      {showMobileSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowMobileSidebar(false)} />
      )}

      {/* ══ NAV SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-52 flex flex-col transition-transform duration-300
        lg:static lg:translate-x-0 lg:shrink-0
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: '#000000' }}>
        <div className="px-5 pt-6 pb-5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: '#374151' }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>TravelHub</p>
            <p className="font-bold text-base leading-tight" style={{ color: '#f9fafb' }}>Navigation</p>
          </div>
          <button onClick={() => setShowMobileSidebar(false)} className="lg:hidden p-1 rounded-lg hover:bg-white/10">
            <XMarkIcon className="w-5 h-5" style={{ color: '#9ca3af' }} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.path === '/navigation';
            return (
              <button
                key={item.label}
                onClick={() => { item.path && navigate(item.path); setShowMobileSidebar(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'font-bold' : 'hover:bg-white/10'
                }`}
                style={{ background: isActive ? '#ffffff' : 'transparent', color: isActive ? '#000000' : '#9ca3af' }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="hidden lg:block">
          <Navbar_Dashboard />
        </div>

        {/* Content: left tools panel + map */}
        <div className="flex flex-1 overflow-hidden relative">

          {/* ── Mobile Tools Backdrop ── */}
          {showMobileTools && (
            <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setShowMobileTools(false)} />
          )}

          {/* ── Left Tools Panel (slide-over on mobile, static on desktop) ── */}
          <div className={`
            fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] flex flex-col overflow-y-auto border-r transition-transform duration-300
            lg:static lg:translate-x-0 lg:shrink-0 lg:z-auto
            ${showMobileTools ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `} style={{ background: '#fbfbf2', borderColor: '#d1d1c7' }}>

            {/* Mobile drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 lg:hidden" style={{ borderColor: '#d1d1c7' }}>
              <h2 className="text-sm font-bold" style={{ color: '#160f29' }}>Route Planner</h2>
              <button onClick={() => setShowMobileTools(false)} className="p-1.5 rounded-lg hover:bg-black/5">
                <XMarkIcon className="w-5 h-5" style={{ color: '#5c6b73' }} />
              </button>
            </div>

            {/* Group Selector */}
            <div className="px-4 pt-4 pb-3 border-b shrink-0" style={{ borderColor: '#d1d1c7' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#5c6b73' }}>Trip Group</p>
              <select
                value={activeGroupId}
                onChange={(e) => {
                  const value = e.target.value;
                  setActiveGroupId(value);
                  setActiveGroupIdState(value);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition"
                style={{ background: '#e8e8e0', color: '#160f29', border: '1px solid #d1d1c7' }}
              >
                {groups.length === 0 ? (
                  <option value="">No groups</option>
                ) : (
                  groups.map((group) => {
                    const gid = group.group_id || group.id;
                    return <option key={gid} value={gid}>{group.name || 'Untitled Group'}</option>;
                  })
                )}
              </select>
            </div>

            {/* Search Destinations */}
            <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
                <MagnifyingGlassIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                Search Destinations
              </h2>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search for a location..."
                  disabled={isSearching}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition disabled:opacity-60"
                  style={{ background: '#e8e8e0', color: '#160f29', border: '1px solid #d1d1c7' }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-3 py-2 rounded-lg text-white text-sm transition disabled:opacity-50 hover:opacity-80"
                  style={{ background: '#183a37' }}
                >
                  {isSearching ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <MagnifyingGlassIcon className="w-4 h-4" />}
                </button>
              </div>
              {searchError && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <XMarkIcon className="w-3 h-3" />{searchError}
                </p>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden border max-h-48 overflow-y-auto" style={{ borderColor: '#d1d1c7' }}>
                  <div className="px-3 py-1.5 text-xs font-semibold" style={{ background: '#e8e8e0', color: '#5c6b73' }}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddLocation(result)}
                      className="w-full text-left px-3 py-2.5 border-b last:border-0 transition hover:bg-black/5 flex items-start justify-between group"
                      style={{ borderColor: '#e8e8e0' }}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: '#160f29' }}>{result.shortName}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#5c6b73' }}>{result.name}</div>
                      </div>
                      <PlusIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition mt-0.5" style={{ color: '#183a37' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Waypoints */}
            <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160f29' }}>
                  <MapPinIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Waypoints ({markers.length})
                </h3>
                {markers.length > 0 && (
                  <button onClick={handleClearAll} className="text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <TrashIcon className="w-3 h-3" />Clear
                  </button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto">
                {markers.length === 0 ? (
                  <div className="text-center py-6" style={{ color: '#5c6b73' }}>
                    <MapPinIcon className="w-7 h-7 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No locations added yet</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="waypoints">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                          {markers.map((marker, index) => (
                            <Draggable key={`marker-${index}`} draggableId={`marker-${index}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="p-2.5 rounded-lg transition group"
                                  style={{ ...provided.draggableProps.style, background: snapshot.isDragging ? '#e8e8e0' : '#f0f0e8', border: '1px solid #d1d1c7' }}
                                >
                                  <div className="flex items-start gap-2">
                                    <div {...provided.dragHandleProps} className="text-gray-400 cursor-grab active:cursor-grabbing mt-0.5 text-sm select-none">⠿</div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                      index === 0 ? 'bg-green-500' : index === markers.length - 1 && markers.length > 1 ? 'bg-red-500' : 'bg-gray-500'
                                    }`}>
                                      {index === 0 ? 'A' : index === markers.length - 1 && markers.length > 1 ? 'B' : index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium truncate" style={{ color: '#160f29' }}>{marker.title}</div>
                                      <div className="text-xs truncate" style={{ color: '#5c6b73' }}>{marker.description}</div>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveMarker(index)}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition"
                                      style={{ color: '#ef4444' }}
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
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

            {/* Quick Actions */}
            <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
                <FireIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                Actions
              </h3>
              <p className="text-xs mb-2" style={{ color: '#5c6b73' }}>Transport Mode</p>
              <div className="grid grid-cols-4 gap-1 mb-3">
                {[
                  { id: 'driving', label: 'Drive', emoji: '🚗' },
                  { id: 'walking', label: 'Walk', emoji: '🚶' },
                  { id: 'cycling', label: 'Bike', emoji: '🚲' },
                  { id: 'transit', label: 'Transit', emoji: '🚌' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setTransportMode(mode.id)}
                    className="flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition"
                    style={{ background: transportMode === mode.id ? '#183a37' : '#e8e8e0', color: transportMode === mode.id ? '#ffffff' : '#5c6b73' }}
                  >
                    <span className="text-sm">{mode.emoji}</span>
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* Route Preference Selector (scenic/foodie/budget/fastest) */}
              <div className="mb-3">
                <RoutePreferences
                  preference={routePreference}
                  onPreferenceChange={(pref) => setRoutePreference(pref)}
                  chapters={smartChapters}
                  suggestions={smartSuggestions}
                  onSuggestionClick={(sug) => {
                    setMarkers(prev => [...prev, {
                      coordinates: sug.coordinates,
                      title: sug.name,
                      description: sug.vicinity || sug.name,
                    }]);
                  }}
                  loading={routeLoading}
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleGetCurrentLocation}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
                  style={{ background: '#e8e8e0', color: '#160f29' }}
                >
                  <MapPinIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Add Current Location
                </button>
                <button
                  onClick={() => setAddPinMode(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                  style={{ background: addPinMode ? '#183a37' : '#e8e8e0', color: addPinMode ? '#ffffff' : '#160f29' }}
                >
                  <MapPinIcon className="w-4 h-4" />
                  {addPinMode ? 'Click map to place pin…' : 'Drop a Pin'}
                </button>
                <button
                  onClick={handlePlanRoute}
                  disabled={routeLoading || markers.length < 2}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-40 hover:opacity-80"
                  style={{ background: '#183a37' }}
                >
                  {routeLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowPathIcon className="w-4 h-4" />}
                  {routeLoading ? 'Planning…' : 'Plan Route'}
                </button>
                {routeError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-start gap-1 border border-red-200">
                    <XMarkIcon className="w-3 h-3 mt-0.5 shrink-0" />{routeError}
                  </p>
                )}
                <button
                  onClick={handleOptimizeRoute}
                  disabled={markers.length < 3 || transportMode === 'transit'}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 hover:opacity-80"
                  style={{ background: '#e8e8e0', color: '#160f29' }}
                >
                  <BoltIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Optimize Route
                </button>
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={!currentRoute || markers.length < 2}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 hover:opacity-80"
                  style={{ background: '#e8e8e0', color: '#160f29' }}
                >
                  <BookmarkIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Save Route
                </button>
              </div>
            </div>

            {/* Suggested for You / Along Route */}
            {(suggestedPlaces.length > 0 || loadingSuggestions) && markers.length >= 1 && (
              <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
                  <StarIconSolid className="w-4 h-4 text-yellow-500" />
                  {currentRoute ? 'Along Your Route' : 'Suggested for You'}
                  <span className="text-xs font-normal ml-1" style={{ color: '#5c6b73' }}>Based on preferences</span>
                </h2>
                {loadingSuggestions ? (
                  <div className="flex justify-center py-4">
                    <ArrowPathIcon className="w-5 h-5 animate-spin text-yellow-500" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {suggestedPlaces.map((place, index) => (
                      <div
                        key={place.id || index}
                        className="rounded-lg p-2.5 cursor-pointer transition hover:opacity-80 flex items-start justify-between border"
                        style={{ background: '#f0f0e8', borderColor: '#d1d1c7' }}
                        onClick={() => handleViewPlaceDetails(place)}
                      >
                        <div className="flex gap-2 flex-1 min-w-0">
                          {place.photos?.length > 0 ? (
                            <img src={getPhotoUrl(place.photos[0].name, 60)} alt={place.name} className="w-9 h-9 object-cover rounded-lg shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e8e8e0' }}>
                              <StarIconSolid className="w-4 h-4 text-yellow-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: '#160f29' }}>{place.name}</div>
                            {place.rating && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <StarIconSolid className="w-2.5 h-2.5 text-yellow-400" />
                                <span className="text-xs" style={{ color: '#5c6b73' }}>{place.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddPlaceToRoute(place); }}
                          className="p-1 rounded transition shrink-0 hover:opacity-70"
                          style={{ color: '#183a37' }}
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Find Nearby Places */}
            <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
              <button onClick={() => setShowPlacesSearch(!showPlacesSearch)} className="w-full flex items-center justify-between text-left">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160f29' }}>
                  <BuildingStorefrontIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Find Nearby Places
                </h2>
                {showPlacesSearch
                  ? <ChevronUpIcon className="w-4 h-4" style={{ color: '#5c6b73' }} />
                  : <ChevronDownIcon className="w-4 h-4" style={{ color: '#5c6b73' }} />}
              </button>
              {showPlacesSearch && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => {
                      const Icon = cat.Icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { setSelectedCategory(cat.id); if (cat.id !== 'all') setPlacesQuery(cat.label.toLowerCase()); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition"
                          style={{ background: selectedCategory === cat.id ? '#183a37' : '#e8e8e0', color: selectedCategory === cat.id ? '#ffffff' : '#5c6b73' }}
                        >
                          <Icon className="w-3 h-3" /><span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={placesQuery}
                      onChange={(e) => setPlacesQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchPlaces()}
                      placeholder="Search nearby…"
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: '#e8e8e0', color: '#160f29', border: '1px solid #d1d1c7' }}
                    />
                    <button
                      onClick={handleSearchGooglePlaces}
                      disabled={searchingPlaces}
                      className="px-3 py-2 rounded-lg text-white text-sm transition disabled:opacity-50 hover:opacity-80"
                      style={{ background: '#183a37' }}
                    >
                      {searchingPlaces ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <MagnifyingGlassIcon className="w-4 h-4" />}
                    </button>
                  </div>
                  {placesResults.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium" style={{ color: '#5c6b73' }}>Found {placesResults.length} places</p>
                      {placesResults.map((place, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg p-2.5 transition flex items-start gap-2 border"
                          style={{ background: '#f0f0e8', borderColor: '#d1d1c7' }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e8e8e0', color: '#183a37' }}>
                            {place.category?.includes('restaurant') && <BuildingStorefrontIcon className="w-4 h-4" />}
                            {place.category?.includes('cafe') && <CakeIcon className="w-4 h-4" />}
                            {place.category?.includes('hotel') && <BuildingOfficeIcon className="w-4 h-4" />}
                            {!place.category && <MapPinIcon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: '#160f29' }}>{place.shortName || place.name}</div>
                            <div className="text-xs truncate" style={{ color: '#5c6b73' }}>{place.address}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => {
                                const [lng, lat] = place.coordinates;
                                if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 2000 });
                              }}
                              className="p-1.5 rounded-lg hover:bg-black/5 transition"
                              title="View on Map"
                            >
                              <MapIcon className="w-3.5 h-3.5" style={{ color: '#183a37' }} />
                            </button>
                            <button
                              onClick={() => handleAddPlaceToRoute(place)}
                              className="p-1.5 rounded-lg hover:bg-black/5 transition"
                              title="Add to Route"
                            >
                              <PlusIcon className="w-3.5 h-3.5" style={{ color: '#183a37' }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {enhancedPlaces.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium" style={{ color: '#5c6b73' }}>Found {enhancedPlaces.length} places</p>
                      {enhancedPlaces.map((place) => (
                        <div
                          key={place.id}
                          className="rounded-lg p-2.5 cursor-pointer transition hover:opacity-80 flex items-start gap-2 border"
                          style={{ background: '#f0f0e8', borderColor: '#d1d1c7' }}
                          onClick={() => handleViewPlaceDetails(place)}
                        >
                          {place.photos?.length > 0 ? (
                            <img src={getPhotoUrl(place.photos[0].name, 100)} alt={place.name} className="w-10 h-10 object-cover rounded-lg shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e8e8e0' }}>
                              <PhotoIcon className="w-5 h-5" style={{ color: '#5c6b73' }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: '#160f29' }}>{place.name}</div>
                            <div className="text-xs truncate" style={{ color: '#5c6b73' }}>{place.address}</div>
                            {place.rating && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <StarIconSolid key={s} className={`w-2.5 h-2.5 ${s <= Math.round(place.rating) ? 'text-yellow-400' : 'text-gray-300'}`} />
                                ))}
                                <span className="text-xs ml-1" style={{ color: '#5c6b73' }}>{place.rating}</span>
                              </div>
                            )}
                            {place.preferenceScore >= 2 && (
                              <span className="text-xs text-green-700 flex items-center gap-0.5">
                                <CheckIcon className="w-2.5 h-2.5" /> Matches preferences
                              </span>
                            )}
                          </div>
                          <ChevronRightIcon className="w-4 h-4 shrink-0" style={{ color: '#5c6b73' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Pins */}
            {customPins.length > 0 && (
              <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
                  <MapPinIcon className="w-4 h-4 text-amber-500" />
                  My Pins ({customPins.length})
                </h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {customPins.map((pin, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg px-3 py-2 border" style={{ background: '#f0f0e8', borderColor: '#d1d1c7' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#160f29' }}>{pin.label}</p>
                        <p className="text-xs" style={{ color: '#5c6b73' }}>{pin.address}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setMarkers(prev => [...prev, { coordinates: [pin.lng, pin.lat], title: pin.label, description: pin.address }])}
                          className="p-1.5 rounded-lg transition hover:opacity-70"
                          style={{ color: '#183a37' }}
                          title="Add as waypoint"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemovePin(index)}
                          className="p-1.5 rounded-lg transition hover:opacity-70"
                          style={{ color: '#ef4444' }}
                          title="Remove pin"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Routes */}
            {savedRoutes.length > 0 && (
              <div className="px-4 py-4 border-b" style={{ borderColor: '#d1d1c7' }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
                  <MapIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                  Saved Routes ({savedRoutes.length})
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {savedRoutes.map(route => (
                    <div key={route.id} className="rounded-lg p-2.5 border transition group" style={{ background: '#f0f0e8', borderColor: '#d1d1c7' }}>
                      <div className="flex items-start justify-between">
                        <button onClick={() => handleLoadRoute(route)} className="flex-1 text-left">
                          <div className="text-xs font-medium" style={{ color: '#160f29' }}>{route.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#5c6b73' }}>
                            {route.waypoints.length} stops · {(route.total_distance / 1000).toFixed(1)} km
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id, route.name); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition"
                          style={{ color: '#ef4444' }}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── GCS: Group-Centric Tools Toggle ── */}
            {activeGroupId && (
              <div className="px-4 py-3 border-b" style={{ borderColor: '#d1d1c7' }}>
                <button
                  onClick={() => setShowGcsPanel(!showGcsPanel)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition hover:opacity-80"
                  style={{ background: '#183a37', color: '#f9fafb' }}
                >
                  <span>Group Intelligence</span>
                  <span>{showGcsPanel ? '▲' : '▼'}</span>
                </button>
              </div>
            )}

            {/* ── GCS Panel ── */}
            {showGcsPanel && activeGroupId && (
              <div className="px-4 py-3 space-y-3 border-b" style={{ borderColor: '#d1d1c7' }}>
                <FairPointFinder
                  tripId={activeGroupId}
                  onSelectPlace={(place) => {
                    setMarkers(prev => [...prev, place]);
                  }}
                  onCreatePoll={(pollId) => setActivePollId(pollId)}
                />

                {activePollId && (
                  <RankedChoicePoll
                    pollId={activePollId}
                    tripId={activeGroupId}
                    onClose={() => setActivePollId(null)}
                  />
                )}

                <GroupArrivalSync
                  tripId={activeGroupId}
                  destination={routeDestination}
                  autoRefresh={isNavigating}
                />

                <GroupSocialContract
                  tripId={activeGroupId}
                  isLeader={true}
                />
              </div>
            )}

            {/* ── Weather Route Alert ── */}
            {currentRoute && markers.length >= 2 && (
              <div className="px-4 py-3 border-b" style={{ borderColor: '#d1d1c7' }}>
                <WeatherRouteAlert
                  waypoints={markers.map(m => ({ lat: m.coordinates[1], lng: m.coordinates[0] }))}
                  departureTime={new Date().toISOString()}
                  routeDurationMinutes={
                    currentRoute.summary?.totalDuration
                      ? parseInt(currentRoute.summary.totalDuration)
                      : null
                  }
                />
              </div>
            )}

            {/* Route Details */}
            {currentRoute && currentRoute.steps && currentRoute.steps.length > 0 && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#160f29' }}>
                    <ArrowsRightLeftIcon className="w-4 h-4" style={{ color: '#183a37' }} />
                    Route Overview
                  </h2>
                  {!isNavigating ? (
                    <button
                      onClick={handleStartNavigation}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-80"
                      style={{ background: '#183a37' }}
                    >
                      <MapPinIcon className="w-3.5 h-3.5" />Start
                    </button>
                  ) : (
                    <button
                      onClick={handleExitNavigation}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />Exit
                    </button>
                  )}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Distance', value: currentRoute.summary.totalDistance },
                    { label: 'Time', value: currentRoute.summary.totalDuration },
                    { label: 'Arrival', value: currentRoute.summary.estimatedArrival },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg p-2.5 text-center border" style={{ background: '#e8e8e0', borderColor: '#d1d1c7' }}>
                      <div className="text-xs mb-0.5" style={{ color: '#5c6b73' }}>{label}</div>
                      <div className="text-xs font-bold" style={{ color: '#160f29' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Journey Breakdown */}
                {(() => {
                  const segments = [];
                  let seg = null;
                  currentRoute.steps.forEach(step => {
                    const mode = step.travel_mode || 'DRIVING';
                    if (!seg || seg.mode !== mode) { seg = { mode, duration: 0, steps: [] }; segments.push(seg); }
                    seg.duration += step.duration;
                    seg.steps.push(step);
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
                  const fmtDur = (s) => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.round(s / 60)} min`;
                  if (segments.length <= 1) return null;
                  return (
                    <div className="rounded-lg p-3 mb-3 border" style={{ background: '#e8e8e0', borderColor: '#d1d1c7' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#5c6b73' }}>Journey Breakdown</p>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {segments.map((s, i) => {
                          const firstTransit = s.steps.find(st => st.transit)?.transit;
                          const lineName = firstTransit?.lineShortName || firstTransit?.lineName;
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-white rounded-full px-2.5 py-1 text-xs shadow-sm border" style={{ borderColor: '#d1d1c7', color: '#160f29' }}>
                                <span>{modeIcon(s.mode, firstTransit)}</span>
                                <span className="font-medium">{lineName ? `${lineName} · ` : ''}{fmtDur(s.duration)}</span>
                                {firstTransit?.numStops && <span style={{ color: '#5c6b73' }}>({firstTransit.numStops} stops)</span>}
                              </div>
                              {i < segments.length - 1 && <ChevronRightIcon className="w-3 h-3" style={{ color: '#5c6b73' }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Turn-by-turn */}
                <h3 className="text-xs font-semibold mb-2" style={{ color: '#5c6b73' }}>
                  Directions ({currentRoute.steps.length} steps)
                </h3>
                <div ref={stepListRef} className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {currentRoute.steps.map((step, index) => {
                    const isCompleted = isNavigating && index < currentStepIndex;
                    const isCurrent = isNavigating && index === currentStepIndex;

                    if (step.travel_mode === 'TRANSIT' && step.transit) {
                      const t = step.transit;
                      const vt = t.vehicleType || 'BUS';
                      const vehicleLabel = { BUS: 'Bus', SUBWAY: 'Subway', TRAM: 'Tram', RAIL: 'Train', FERRY: 'Ferry' }[vt] || vt;
                      const vehicleEmoji = { BUS: '🚌', SUBWAY: '🚇', TRAM: '🚊', RAIL: '🚂', FERRY: '⛴' }[vt] || '🚌';
                      return (
                        <div
                          key={index}
                          data-step-index={index}
                          className={`rounded-xl border-2 overflow-hidden transition-all ${isCompleted ? 'opacity-40' : ''} ${isCurrent ? 'ring-2 ring-offset-1 ring-teal-700' : ''}`}
                          style={{ borderColor: '#183a37', background: '#f0f0e8' }}
                        >
                          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: '#183a37' }}>
                            <span>{vehicleEmoji}</span>
                            <span className="text-xs font-semibold text-white">
                              {vehicleLabel}{t.lineName ? ` · ${t.lineName}` : ''}{t.lineShortName && t.lineShortName !== t.lineName ? ` (${t.lineShortName})` : ''}
                            </span>
                            <div className="ml-auto text-xs text-white/70 flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              {step.duration >= 60 ? `${Math.round(step.duration / 60)} min` : `${step.duration}s`}
                            </div>
                          </div>
                          <div className="px-3 py-2.5 space-y-2">
                            {t.departureStop && (
                              <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-1 ring-white mt-1 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5c6b73' }}>Board</p>
                                  <p className="text-xs font-semibold" style={{ color: '#160f29' }}>{t.departureStop}</p>
                                  {t.departureTime && <p className="text-xs" style={{ color: '#5c6b73' }}>{t.departureTime}</p>}
                                </div>
                              </div>
                            )}
                            {(t.numStops || t.headsign) && (
                              <div className="flex items-center gap-2 pl-1">
                                <div className="w-0.5 h-5 bg-gray-300 ml-0.5" />
                                <p className="text-xs ml-1" style={{ color: '#5c6b73' }}>
                                  {t.numStops ? `${t.numStops} stops` : ''}{t.numStops && t.headsign ? ' · ' : ''}{t.headsign ? `toward ${t.headsign}` : ''}
                                </p>
                              </div>
                            )}
                            {t.arrivalStop && (
                              <div className="flex items-start gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-white mt-1 shrink-0" />
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5c6b73' }}>Exit</p>
                                  <p className="text-xs font-semibold" style={{ color: '#160f29' }}>{t.arrivalStop}</p>
                                  {t.arrivalTime && <p className="text-xs" style={{ color: '#5c6b73' }}>{t.arrivalTime}</p>}
                                </div>
                              </div>
                            )}
                            {!t.departureStop && !t.arrivalStop && (
                              <p className="text-xs" style={{ color: '#160f29' }}>{step.maneuver.instruction}</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const maneuverType = (step.maneuver.type || '').toLowerCase();
                    const getDirectionIcon = (type) => {
                      if (type.includes('arrive')) return <MapPinIcon className="w-4 h-4 text-red-500" />;
                      if (type.includes('depart')) return <MapPinIcon className="w-4 h-4 text-green-500" />;
                      if (type.includes('roundabout') || type.includes('rotary')) return <ArrowPathIcon className="w-4 h-4" style={{ color: '#5c6b73' }} />;
                      if (type.includes('uturn') || type.includes('u-turn')) return <ArrowUturnLeftIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                      if (type.includes('sharp-right') || type.includes('sharp right')) return <ArrowUturnRightIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                      if (type.includes('sharp-left') || type.includes('sharp left')) return <ArrowUturnLeftIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                      if (type.includes('slight-right') || type.includes('slight right') || type.includes('ramp-right')) return <ArrowRightIcon className="w-4 h-4" style={{ color: '#160f29', transform: 'rotate(-30deg)' }} />;
                      if (type.includes('slight-left') || type.includes('slight left') || type.includes('ramp-left')) return <ArrowLeftIcon className="w-4 h-4" style={{ color: '#160f29', transform: 'rotate(30deg)' }} />;
                      if (type.includes('turn-right') || (type.includes('right') && !type.includes('left'))) return <ArrowRightIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                      if (type.includes('turn-left') || (type.includes('left') && !type.includes('right'))) return <ArrowLeftIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                      return <ArrowUpIcon className="w-4 h-4" style={{ color: '#160f29' }} />;
                    };
                    const modeBadge = step.travel_mode === 'WALKING'
                      ? { emoji: '🚶', bg: '#dcfce7', color: '#166534' }
                      : step.travel_mode === 'BICYCLING'
                      ? { emoji: '🚲', bg: '#ffedd5', color: '#9a3412' }
                      : step.travel_mode === 'TRANSIT'
                      ? { emoji: '🚌', bg: '#dbeafe', color: '#1e40af' }
                      : { emoji: '🚗', bg: '#e8e8e0', color: '#160f29' };

                    return (
                      <div
                        key={index}
                        data-step-index={index}
                        className={`flex gap-2 p-3 rounded-lg border transition-all ${isCompleted ? 'opacity-40' : ''}`}
                        style={{ background: '#f0f0e8', borderColor: isCurrent ? '#183a37' : '#d1d1c7', ...(isCurrent ? { outline: '2px solid #183a37', outlineOffset: '1px' } : {}) }}
                      >
                        <div className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: '#183a37' }}>
                          {index + 1}
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e8e8e0' }}>
                          {getDirectionIcon(maneuverType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-relaxed" style={{ color: '#160f29' }}>{step.maneuver.instruction}</p>
                          {step.name && step.name !== step.maneuver.instruction && (
                            <p className="text-xs mt-0.5 font-medium" style={{ color: '#183a37' }}>{step.name}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: '#e8e8e0', color: '#5c6b73' }}>
                              <MapPinIcon className="w-2.5 h-2.5" />
                              {step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: '#e8e8e0', color: '#5c6b73' }}>
                              <ClockIcon className="w-2.5 h-2.5" />
                              {step.duration >= 60 ? `${Math.round(step.duration / 60)} min` : `${Math.round(step.duration)} sec`}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: modeBadge.bg, color: modeBadge.color }}>{modeBadge.emoji}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ready to plan hint */}
            {!currentRoute && markers.length >= 2 && (
              <div className="px-4 py-6 text-center">
                <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: '#5c6b73' }} />
                <p className="text-sm font-medium" style={{ color: '#160f29' }}>Ready to plan!</p>
                <p className="text-xs mt-1" style={{ color: '#5c6b73' }}>Click "Plan Route" to get directions</p>
              </div>
            )}

          </div>

          {/* ── Map Area ── */}
          <div className="flex-1 relative overflow-hidden">
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

            {/* ── Mobile floating controls (hidden on desktop) ── */}
            {!isNavigating && (
              <div className="absolute top-3 left-3 z-10 flex gap-2 lg:hidden">
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  className="w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition hover:opacity-80"
                  style={{ background: '#000000' }}
                >
                  <Bars3Icon className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setShowMobileTools(true)}
                  className="h-10 px-3 rounded-xl shadow-lg flex items-center gap-2 transition hover:opacity-80"
                  style={{ background: '#183a37' }}
                >
                  <AdjustmentsHorizontalIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-xs font-semibold">Plan</span>
                </button>
              </div>
            )}

            {/* Mobile route summary pill */}
            {!isNavigating && currentRoute && (
              <div className="absolute bottom-4 left-3 right-3 z-10 lg:hidden">
                <div className="rounded-xl shadow-lg p-3 flex items-center gap-3" style={{ background: '#160f29' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{currentRoute.summary.totalDistance} · {currentRoute.summary.totalDuration}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(251,251,242,0.6)' }}>{markers.length} stops · ETA {currentRoute.summary.estimatedArrival}</p>
                  </div>
                  <button
                    onClick={handleStartNavigation}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white shrink-0 transition hover:opacity-80"
                    style={{ background: '#183a37' }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowMobileTools(true)}
                    className="p-2 rounded-lg shrink-0 transition hover:bg-white/10"
                  >
                    <ChevronUpIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}

            {/* Add Pin mode banner */}
            {addPinMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse text-white" style={{ background: '#183a37' }}>
                <MapPinIcon className="w-4 h-4" />
                Click on the map to place a pin
                <button onClick={() => setAddPinMode(false)} className="ml-2 p-0.5 rounded-full hover:bg-white/20">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Navigation overlay */}
            {isNavigating && currentRoute?.steps?.[currentStepIndex] && (() => {
              const step = currentRoute.steps[currentStepIndex];
              const nextStep = currentRoute.steps[currentStepIndex + 1];
              const progress = Math.round(((currentStepIndex + 1) / currentRoute.steps.length) * 100);
              return (
                <div className="absolute top-4 left-4 right-4 z-10">
                  <div className="w-full h-1 rounded-full mb-1 overflow-hidden" style={{ background: '#d1d1c7' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: '#183a37' }} />
                  </div>
                  <div className="rounded-xl shadow-xl p-4 text-white" style={{ background: '#160f29' }}>
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <ArrowUpIcon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold leading-tight">
                          {step.maneuver?.instruction || `Step ${currentStepIndex + 1}`}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: 'rgba(251,251,242,0.7)' }}>
                          <span className="font-semibold text-white">
                            {step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                          </span>
                          <span>{step.duration >= 60 ? `${Math.round(step.duration / 60)} min` : `${Math.round(step.duration)} sec`}</span>
                          <span className="text-xs">Step {currentStepIndex + 1}/{currentRoute.steps.length}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleExitNavigation}
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-white/20"
                        style={{ background: 'rgba(255,255,255,0.15)' }}
                        title="Exit Navigation"
                      >
                        <XMarkIcon className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    {nextStep && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(251,251,242,0.7)' }}>
                        <span className="font-medium" style={{ color: 'rgba(251,251,242,0.5)' }}>Then:</span>
                        <span className="truncate">{nextStep.maneuver?.instruction || 'Continue'}</span>
                        <span className="ml-auto font-medium whitespace-nowrap">
                          {nextStep.distance >= 1000 ? `${(nextStep.distance / 1000).toFixed(1)} km` : `${Math.round(nextStep.distance)} m`}
                        </span>
                      </div>
                    )}
                  </div>
                  {userPosition && (
                    <div className="mt-1 text-right text-xs" style={{ color: '#5c6b73' }}>
                      GPS accuracy: ~{Math.round(userPosition.accuracy || 0)}m
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Pin Label Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl shadow-lg max-w-sm w-full p-6" style={{ background: '#fbfbf2' }}>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#160f29' }}>
              <MapPinIcon className="w-5 h-5 text-amber-500" />
              Name Your Pin
            </h3>
            <input
              type="text"
              value={pinLabel}
              onChange={(e) => setPinLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmPin()}
              placeholder="e.g., Nice viewpoint, Meet here…"
              className="w-full px-4 py-2 rounded-lg outline-none mb-2 transition"
              style={{ background: '#e8e8e0', color: '#160f29', border: '1px solid #d1d1c7' }}
              autoFocus
            />
            {pendingPin && (
              <p className="text-xs mb-4" style={{ color: '#5c6b73' }}>
                {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={handleConfirmPin} className="flex-1 py-2 rounded-lg font-medium text-white transition hover:opacity-80" style={{ background: '#183a37' }}>
                Add Pin
              </button>
              <button
                onClick={() => { setShowPinPrompt(false); setPendingPin(null); }}
                className="flex-1 py-2 rounded-lg font-medium transition hover:opacity-80"
                style={{ background: '#e8e8e0', color: '#160f29' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Route Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl shadow-lg max-w-md w-full p-6" style={{ background: '#fbfbf2' }}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#160f29' }}>
              <BookmarkIcon className="w-6 h-6" style={{ color: '#183a37' }} />
              Save Route
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#160f29' }}>Route Name</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g., Day 1 Sightseeing"
                className="w-full px-4 py-2 rounded-lg outline-none transition"
                style={{ background: '#e8e8e0', color: '#160f29', border: '1px solid #d1d1c7' }}
              />
            </div>
            <div className="text-sm mb-4 space-y-1" style={{ color: '#5c6b73' }}>
              <div className="flex items-center gap-2"><MapPinIcon className="w-4 h-4" /><span>{markers.length} waypoints</span></div>
              <div className="flex items-center gap-2"><MapPinIcon className="w-4 h-4" /><span>{currentRoute?.summary.totalDistance}</span></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveRoute}
                disabled={savingRoute}
                className="flex-1 py-3 rounded-lg font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-80"
                style={{ background: '#183a37' }}
              >
                {savingRoute ? <><ArrowPathIcon className="w-5 h-5 animate-spin" />Saving…</> : <><CheckIcon className="w-5 h-5" />Save Route</>}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={savingRoute}
                className="flex-1 py-3 rounded-lg font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{ background: '#e8e8e0', color: '#160f29' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Details Modal */}
      {showPlaceDetails && selectedPlace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" style={{ background: '#fbfbf2' }}>
            <div className="sticky top-0 border-b px-6 py-4 flex items-center justify-between" style={{ background: '#fbfbf2', borderColor: '#d1d1c7' }}>
              <h2 className="text-xl font-bold" style={{ color: '#160f29' }}>Place Details</h2>
              <button onClick={() => setShowPlaceDetails(false)} className="p-2 rounded-lg transition hover:bg-black/5">
                <XMarkIcon className="w-6 h-6" style={{ color: '#5c6b73' }} />
              </button>
            </div>
            <div className="p-6">
              {loadingPlaceDetails ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="w-8 h-8 animate-spin" style={{ color: '#183a37' }} />
                </div>
              ) : (
                <>
                  {selectedPlace.photos?.length > 0 && (
                    <div className="mb-6 grid grid-cols-3 gap-2">
                      {selectedPlace.photos.map((photo, index) => (
                        <img key={index} src={getPhotoUrl(photo.name, 400)} alt={`${selectedPlace.name} photo ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#160f29' }}>{selectedPlace.name}</h3>
                  <div className="flex items-center gap-4 mb-4">
                    {selectedPlace.rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <StarIconSolid key={s} className={`w-5 h-5 ${s <= Math.round(selectedPlace.rating) ? 'text-yellow-400' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#5c6b73' }}>{selectedPlace.rating} ({selectedPlace.ratingCount} reviews)</span>
                      </div>
                    )}
                    {selectedPlace.priceLevel && (
                      <span className="text-sm font-medium" style={{ color: '#5c6b73' }}>{getPriceLevelSymbol(selectedPlace.priceLevel)}</span>
                    )}
                    {selectedPlace.isOpen !== null && (
                      <span className={`text-sm font-medium ${selectedPlace.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPlace.isOpen ? 'Open Now' : 'Closed'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-3 mb-4">
                    <MapPinIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#5c6b73' }} />
                    <p style={{ color: '#160f29' }}>{selectedPlace.address}</p>
                  </div>
                  {selectedPlace.phone && (
                    <div className="flex items-center gap-3 mb-4">
                      <PhoneIcon className="w-5 h-5 shrink-0" style={{ color: '#5c6b73' }} />
                      <a href={`tel:${selectedPlace.phone}`} style={{ color: '#183a37' }} className="hover:underline">{selectedPlace.phone}</a>
                    </div>
                  )}
                  {selectedPlace.website && (
                    <div className="flex items-center gap-3 mb-4">
                      <GlobeAltIcon className="w-5 h-5 shrink-0" style={{ color: '#5c6b73' }} />
                      <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer" style={{ color: '#183a37' }} className="hover:underline truncate">Visit Website</a>
                    </div>
                  )}
                  {selectedPlace.openingHours?.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <ClockIconOutline className="w-5 h-5" style={{ color: '#5c6b73' }} />
                        <h4 className="font-semibold" style={{ color: '#160f29' }}>Hours</h4>
                      </div>
                      <div className="ml-7 space-y-1">
                        {selectedPlace.openingHours.map((hours, index) => (
                          <p key={index} className="text-sm" style={{ color: '#5c6b73' }}>{hours}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedPlace.reviews?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3" style={{ color: '#160f29' }}>Recent Reviews</h4>
                      <div className="space-y-4">
                        {selectedPlace.reviews.map((review, index) => (
                          <div key={index} className="border-l-4 pl-4" style={{ borderColor: '#183a37' }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium" style={{ color: '#160f29' }}>{review.author}</span>
                              <div className="flex">
                                {[1,2,3,4,5].map(s => (
                                  <StarIconSolid key={s} className={`w-4 h-4 ${s <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3" style={{ color: '#5c6b73' }}>{review.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => { handleAddPlaceToRoute(selectedPlace); setShowPlaceDetails(false); }}
                      className="flex-1 px-4 py-3 rounded-lg font-medium text-white transition hover:opacity-80"
                      style={{ background: '#183a37' }}
                    >
                      Add to Route
                    </button>
                    <button
                      onClick={() => {
                        const [lng, lat] = selectedPlace.coordinates;
                        if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 2000 });
                        setShowPlaceDetails(false);
                      }}
                      className="flex-1 px-4 py-3 rounded-lg font-medium transition hover:bg-black/5 border-2"
                      style={{ borderColor: '#183a37', color: '#183a37' }}
                    >
                      View on Map
                    </button>
                  </div>
                  {selectedPlace.googleMapsUri && selectedPlace.types?.some(t => ['restaurant','cafe','food','meal_delivery','meal_takeaway','bar'].includes(t)) && (
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
