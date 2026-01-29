import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../../components/Map';

/**
 * Navigation Page
 * 
 * This page provides trip navigation features:
 * - Search for locations
 * - Add markers to the map
 * - Plan routes between locations
 * - Get location suggestions
 * - Use current location
 */
function Navigation() {
  const navigate = useNavigate();
  
  // State for markers (locations on the map)
  // Each marker has: coordinates [lng, lat], title, and description
  const [markers, setMarkers] = useState([
    {
      coordinates: [-118.2437, 34.0522], // Los Angeles (default starting point)
      title: 'Starting Point',
      description: 'Your current location'
    }
  ]);

  // State for search functionality
  const [searchQuery, setSearchQuery] = useState(''); // What the user types
  const [searchResults, setSearchResults] = useState([]); // Results from search

  // Placeholder search function
  // TODO: We'll implement this with Mapbox Geocoding API later
  const handleSearch = async () => {
    console.log('Searching for:', searchQuery);
    // For now, just log it - we'll add real search later
  };

  // Function to add a new location to the map
  const handleAddLocation = (location) => {
    const newMarker = {
      coordinates: location.coordinates,
      title: location.title,
      description: location.description || ''
    };
    
    // Add the new marker to our existing markers array
    setMarkers([...markers, newMarker]);
  };

  // Function to remove a marker
  const handleRemoveMarker = (index) => {
    // Filter out the marker at this index
    const updatedMarkers = markers.filter((_, i) => i !== index);
    setMarkers(updatedMarkers);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button to Dashboard */}
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Panel - Search and Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Search Destinations
              </h2>

              {/* Search Input */}
              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter location..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition"
                  >
                    Search
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Try: "restaurants near me", "coffee shop", or any address
                </p>
              </div>

              {/* Saved Locations List */}
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
                        {/* Delete button - only show on hover */}
                        <button
                          onClick={() => handleRemoveMarker(index)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-2 py-1 transition"
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
                    className="w-full text-left px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                    onClick={() => alert('Current location feature coming soon!')}
                  >
                    📍 Add Current Location
                  </button>
                  <button 
                    className="w-full text-left px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                    onClick={() => alert('Route planning feature coming soon!')}
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

          {/* Right Panel - Map Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-[600px]">
              {/* This is where our Map component goes! */}
              <Map 
                markers={markers} 
                center={[-118.2437, 34.0522]} 
                zoom={12}
              />
            </div>
          </div>
        </div>

        {/* Route Information Section (placeholder for now) */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Route Details
          </h2>
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">🚗</div>
            <p>No route planned yet</p>
            <p className="text-sm mt-1">
              Add destinations and click "Plan Route" to get started
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navigation;