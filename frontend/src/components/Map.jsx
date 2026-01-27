import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // Import Mapbox CSS for proper styling

// Set your Mapbox access token from environment variables
// This tells Mapbox who you are and allows you to use their services
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Map Component
 * 
 * This component displays an interactive Mapbox map with the following features:
 * - Pan and zoom controls
 * - Custom markers for locations
 * - Route visualization
 * - Real-time coordinate display
 * 
 * Props:
 * @param {Array} center - [longitude, latitude] for map center (default: LA coordinates)
 * @param {Number} zoom - Initial zoom level (default: 12)
 * @param {Array} markers - Array of marker objects with {coordinates, title, description}
 * @param {Object} route - Route object with geometry data to display on map
 */
function Map({ center = [-118.2437, 34.0522], zoom = 12, markers = [], route = null }) {
  // useRef creates a reference to the map container div and the map instance
  // This allows us to access the actual DOM element and Mapbox map object
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // useState stores the current map coordinates and zoom level
  // These update as the user moves around the map
  const [lng, setLng] = useState(center[0]); // Longitude
  const [lat, setLat] = useState(center[1]); // Latitude
  const [mapZoom, setMapZoom] = useState(zoom); // Zoom level

  // useEffect runs when component mounts (first renders)
  // This is where we initialize the Mapbox map
  useEffect(() => {
    // If map already exists, don't create another one
    if (map.current) return;
    
    // Create new Mapbox map
    map.current = new mapboxgl.Map({
      container: mapContainer.current, // The HTML element to put the map in
      style: 'mapbox://styles/mapbox/streets-v12', // Map style (you can change this!)
      center: [lng, lat], // Starting position [longitude, latitude]
      zoom: mapZoom // Starting zoom level
    });

    // Add navigation controls (zoom in/out buttons, compass)
    // 'top-right' positions them in the top-right corner
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Listen for map movement and update our state
    // This keeps the coordinate display in sync with the map
    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4)); // Update longitude, rounded to 4 decimals
      setLat(map.current.getCenter().lat.toFixed(4)); // Update latitude
      setMapZoom(map.current.getZoom().toFixed(2));   // Update zoom level
    });
  }, []); // Empty dependency array = only run once when component mounts

  // useEffect for handling markers
  // This runs whenever the 'markers' prop changes
  useEffect(() => {
    if (!map.current) return; // Wait for map to be initialized

    // Remove any existing markers first (cleanup)
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add new markers
    markers.forEach(({ coordinates, title, description }) => {
      // Create a popup that shows when you click the marker
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<h3 class="font-semibold">${title}</h3>
         <p class="text-sm text-gray-600">${description || ''}</p>`
      );

      // Create and add the marker to the map
      new mapboxgl.Marker()
        .setLngLat(coordinates) // Position of the marker
        .setPopup(popup)         // Attach the popup
        .addTo(map.current);     // Add to our map
    });
  }, [markers]); // Run this whenever markers array changes

  // useEffect for handling route display
  // This runs whenever the 'route' prop changes
  useEffect(() => {
    if (!map.current) return; // Wait for map to be initialized
    if (!route) return;        // No route to display

    // Remove existing route layer if it exists
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add the route as a data source
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry // The actual route line
      }
    });

    // Add a layer to visualize the route
    map.current.addLayer({
      id: 'route',
      type: 'line',          // Draw as a line
      source: 'route',
      layout: {
        'line-join': 'round', // Smooth corners
        'line-cap': 'round'   // Rounded line ends
      },
      paint: {
        'line-color': '#3b82f6', // Blue color
        'line-width': 5,          // Line thickness
        'line-opacity': 0.75      // Slightly transparent
      }
    });

    // Automatically zoom the map to fit the entire route
    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
    );
    map.current.fitBounds(bounds, { padding: 50 }); // 50px padding
  }, [route]); // Run this whenever route changes

  return (
    <div className="relative w-full h-full">
      {/* Coordinate Display Box */}
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md z-10 text-sm">
        <div className="text-gray-600">
          Longitude: {lng} | Latitude: {lat} | Zoom: {mapZoom}
        </div>
      </div>

      {/* Map Container - This is where the map actually appears */}
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
}

export default Map;