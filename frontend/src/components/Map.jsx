import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function Map({ center = [-118.2437, 34.0522], zoom = 12, markers = [], route = null }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(center[0]);
  const [lat, setLat] = useState(center[1]);
  const [mapZoom, setMapZoom] = useState(zoom);

  // 1. INITIALIZE MAP (this was missing!)
  useEffect(() => {
    if (map.current) return; // If map already exists, don't create another
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: mapZoom
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setMapZoom(map.current.getZoom().toFixed(2));
    });
  }, []); // Empty array = run once on mount

  // 2. HANDLE MARKERS
  useEffect(() => {
    if (!map.current) return;

    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    markers.forEach(({ coordinates, title, description }) => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<h3 class="font-semibold">${title}</h3>
         <p class="text-sm text-gray-600">${description || ''}</p>`
      );

      new mapboxgl.Marker()
        .setLngLat(coordinates)
        .setPopup(popup)
        .addTo(map.current);
    });
  }, [markers]);

  // 3. HANDLE ROUTE (keep only ONE route useEffect)
  useEffect(() => {
    if (!map.current) return;
    if (!route) return;

    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 5,
        'line-opacity': 0.75
      }
    });

    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
    );
    map.current.fitBounds(bounds, { padding: 50 });
  }, [route]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md z-10 text-sm">
        <div className="text-gray-600">
          Longitude: {lng} | Latitude: {lat} | Zoom: {mapZoom}
        </div>
      </div>
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
}

export default Map;