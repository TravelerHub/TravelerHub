import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../../components/Map';
import { searchPlaces, getPlaceName } from '../../services/geocodingService';

function Navigation() {
  const navigate = useNavigate();
  
  const [markers, setMarkers] = useState([
    {
      coordinates: [-118.2437, 34.0522],
      title: 'Starting Point',
      description: 'Los Angeles, California'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Handle search - NOW WITH REAL FUNCTIONALITY!
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a location to search');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    
    try {
      // Call our geocoding service
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

  // Add location from search results to the map
  const handleAddLocation = (result) => {
    const newMarker = {
      coordinates: result.coordinates,
      title: result.shortName,
      description: result.name
    };
    
    setMarkers([...markers, newMarker]);
    
    // Clear search after adding
    setSearchResults([]);
    setSearchQuery('');
    setSearchError('');
  };

  // Remove a marker from the map
  const handleRemoveMarker = (index) => {
    const updatedMarkers = markers.filter((_, i) => i !== index);
    setMarkers(updatedMarkers);
  };

  // Get user's current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = [position.coords.longitude, position.coords.latitude];
        
        try {
          // Get the place name for these coordinates
          const place = await getPlaceName(coords);
          
          const newMarker = {
            coordinates: coords,
            title: 'Current Location',
            description: place ? place.name : 'Your current location'
          };
          
          setMarkers([...markers, newMarker]);
        } catch (error) {
          console.error('Error getting location name:', error);
          
          // Add marker anyway, just without a name
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Navigation</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
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
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isSearching ? '...' : 'Search'}
                  </button>
                </div>
                
                {/* Search hint */}
                <p className="text-xs text-gray-500 mt-2">
                  Try: "coffee shop", "123 Main St", or "Central Park"
                </p>
                
                {/* Error message */}
                {searchError && (
                  <p className="text-xs text-red-600 mt-2">
                    {searchError}
                  </p>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm max-h-64 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </div>
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleAddLocation(result)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {result.shortName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {result.name}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {result.category}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Saved Locations */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Saved Locations ({markers.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {markers.map((marker, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group"
                    >
                      <div className="flex items-start justify-between">
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
                        <button
                          onClick={() => handleRemoveMarker(index)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-2 py-1 transition"
                          title="Remove location"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button 
                    onClick={handleGetCurrentLocation}
                    className="w-full text-left px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                  >
                    📍 Add Current Location
                  </button>
                  <button 
                    className="w-full text-left px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                    onClick={() => alert('Route planning feature coming next!')}
                  >
                    🗺️ Plan Route
                  </button>
                  <button 
                    className="w-full text-left px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium"
                    onClick={() => alert('Suggestions feature coming soon!')}
                  >
                    ✨ Get Suggestions
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[600px]">
              <Map 
                markers={markers} 
                center={markers.length > 0 ? markers[0].coordinates : [-118.2437, 34.0522]} 
                zoom={12}
              />
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Route Details
          </h2>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">🚗</div>
            <p>No route planned yet</p>
            <p className="text-sm mt-1">
              Add 2 or more destinations and click "Plan Route" to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navigation;