import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPinIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function Map({ markers = [], center = [-118.2437, 34.0522], zoom = 12, route = null, onMarkerDragEnd }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom
    });

    // Add navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control (locate me button)
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    
    mapRef.current.addControl(geolocate, 'top-right');

    // Add scale control
    mapRef.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    markers.forEach((marker, index) => {
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cursor = 'grab';
      
      // Different colors for start, end, and waypoints
      let bgColor;
      let label;
      
      if (index === 0) {
        bgColor = 'bg-green-500';
        label = 'A';
      } else if (index === markers.length - 1 && markers.length > 1) {
        bgColor = 'bg-red-500';
        label = 'B';
      } else {
        bgColor = 'bg-blue-500';
        label = index + 1;
      }
      
      el.innerHTML = `
        <div class="flex items-center justify-center w-10 h-10 ${bgColor} rounded-full text-white font-bold shadow-lg border-2 border-white">
          ${label}
        </div>
      `;

      // Create draggable marker
      const mapboxMarker = new mapboxgl.Marker({
        element: el,
        draggable: true
      })
        .setLngLat(marker.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2">
                <div class="font-bold text-sm">${marker.title}</div>
                <div class="text-xs text-gray-600 mt-1">${marker.description}</div>
              </div>
            `)
        )
        .addTo(mapRef.current);

      // Handle drag end
      mapboxMarker.on('dragend', () => {
        const lngLat = mapboxMarker.getLngLat();
        if (onMarkerDragEnd) {
          onMarkerDragEnd(index, [lngLat.lng, lngLat.lat]);
        }
      });

      markersRef.current.push(mapboxMarker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach(marker => bounds.extend(marker.coordinates));
      
      mapRef.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 15,
        duration: 1000
      });
    }
  }, [markers, onMarkerDragEnd]);

  // Draw route
  useEffect(() => {
    if (!mapRef.current || !route) return;

    mapRef.current.on('load', () => {
      // Remove existing route layer if exists
      if (mapRef.current.getSource('route')) {
        mapRef.current.removeLayer('route');
        mapRef.current.removeSource('route');
      }

      // Add route source and layer
      mapRef.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        }
      });

      mapRef.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3B82F6',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });
    });

    // If map already loaded
    if (mapRef.current.isStyleLoaded()) {
      if (mapRef.current.getSource('route')) {
        mapRef.current.removeLayer('route');
        mapRef.current.removeSource('route');
      }

      mapRef.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        }
      });

      mapRef.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3B82F6',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });
    }
  }, [route]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export default Map;