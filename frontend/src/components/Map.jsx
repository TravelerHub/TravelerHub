import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const Map = forwardRef(function Map({
  markers = [],
  center = [-118.2437, 34.0522],
  zoom = 12,
  route = null,
  onMarkerDragEnd,
  enhancedPlaces = [],
  navigationMode = false,
  onUserPositionUpdate,
  currentStepIndex = 0,
  onMapClick,
  customPins = [],
  discoveryPlaces = [],     // Friend activity markers from Discovery overlay
  expenseMarkers = [],      // Geo-tagged expense markers
  groupMemberMarkers = [],  // Live group member positions — rendered as avatar markers
  sharedPins = [],          // Collaborative shared pins from SharedMapPins
}, ref) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const placesMarkersRef = useRef([]);
  const geolocateRef = useRef(null);
  const onPositionUpdateRef = useRef(onUserPositionUpdate);
  const onMapClickRef = useRef(null);
  const customPinsRef = useRef([]);
  const discoveryMarkersRef = useRef([]);
  const expenseMarkersRef = useRef([]);
  // group member markers: Map<user_id, mapboxgl.Marker> for smooth live updates
  const groupMemberMarkersRef = useRef(new Map());
  // shared pins: Map<pin_id, mapboxgl.Marker>
  const sharedPinsMarkersRef = useRef(new Map());

  // Keep callback refs fresh on every render
  useEffect(() => {
    onPositionUpdateRef.current = onUserPositionUpdate;
    onMapClickRef.current = onMapClick;
  });

  // Expose flyTo to parent via ref
  useImperativeHandle(ref, () => ({
    flyTo(lngLat, options = {}) {
      if (mapRef.current) {
        mapRef.current.flyTo({ center: lngLat, ...options });
      }
    },
    getMap() {
      return mapRef.current;
    },
  }));

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: center,
      zoom: zoom,
    });

    // Navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Geolocate control — high accuracy, faster updates for Waze-like feel
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 2000,       // Cache position for up to 2s (smoother)
        timeout: 8000,          // 8s timeout
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
    });
    geolocateRef.current = geolocate;
    mapRef.current.addControl(geolocate, 'top-right');

    // Forward position updates to parent with speed calculation
    let lastPos = null;
    let lastTime = null;

    geolocate.on('geolocate', (e) => {
      const now = Date.now();
      const pos = { lng: e.coords.longitude, lat: e.coords.latitude };

      // Calculate speed in km/h from consecutive GPS readings
      let speed = e.coords.speed; // m/s from GPS (may be null)
      if (!speed && lastPos && lastTime) {
        const dt = (now - lastTime) / 1000; // seconds
        if (dt > 0 && dt < 10) { // Only if recent (< 10s)
          const dLat = pos.lat - lastPos.lat;
          const dLng = pos.lng - lastPos.lng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111320; // rough meters
          speed = dist / dt;
        }
      }

      lastPos = pos;
      lastTime = now;

      onPositionUpdateRef.current?.({
        lng: pos.lng,
        lat: pos.lat,
        heading: e.coords.heading,
        accuracy: e.coords.accuracy,
        speed: speed ? Math.round(speed * 3.6) : null, // Convert m/s → km/h
        altitude: e.coords.altitude,
        timestamp: now,
      });
    });

    // Scale control
    mapRef.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    // Click-to-add-pin: forward map clicks to parent (via ref)
    mapRef.current.on('click', (e) => {
      onMapClickRef.current?.({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      });
    });

    return () => {
      placesMarkersRef.current.forEach(marker => marker.remove());
      placesMarkersRef.current = [];
      discoveryMarkersRef.current.forEach(marker => marker.remove());
      discoveryMarkersRef.current = [];
      expenseMarkersRef.current.forEach(marker => marker.remove());
      expenseMarkersRef.current = [];
      groupMemberMarkersRef.current.forEach(marker => marker.remove());
      groupMemberMarkersRef.current.clear();
      sharedPinsMarkersRef.current.forEach(marker => marker.remove());
      sharedPinsMarkersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Handle navigation mode toggle — Waze-like perspective
  useEffect(() => {
    if (!mapRef.current) return;

    if (navigationMode) {
      // Enter navigation mode: 3D perspective, zoom in, enable tracking
      mapRef.current.easeTo({
        pitch: 60,       // Steeper angle for driving perspective
        zoom: 17,        // Closer zoom for turn-by-turn
        duration: 1000,
      });
      // Start tracking user location
      if (geolocateRef.current) {
        geolocateRef.current.trigger();
      }
      // Disable map rotation by user (auto-rotates with heading)
      mapRef.current.dragRotate.disable();
      mapRef.current.touchZoomRotate.disableRotation();
    } else {
      // Exit navigation mode: reset to overhead view
      mapRef.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
      // Re-enable user rotation
      mapRef.current.dragRotate.enable();
      mapRef.current.touchZoomRotate.enableRotation();
    }
  }, [navigationMode]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    markers.forEach((marker, index) => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cursor = 'grab';

      let color;
      let label;
      const isStart = index === 0;
      const isEnd = index === markers.length - 1 && markers.length > 1;

      if (isStart) {
        color = '#16a34a';
        label = 'A';
      } else if (isEnd) {
        color = '#dc2626';
        label = 'B';
      } else {
        color = '#183a37';
        label = index + 1;
      }

      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          ${isEnd ? '<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(220,38,38,0.4);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' : ''}
          <div style="width:36px;height:36px;background:${color};border-radius:50%;color:white;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            ${label}
          </div>
        </div>
      `;

      const mapboxMarker = new mapboxgl.Marker({
        element: el,
        draggable: !navigationMode,
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

      mapboxMarker.on('dragend', () => {
        const lngLat = mapboxMarker.getLngLat();
        if (onMarkerDragEnd) {
          onMarkerDragEnd(index, [lngLat.lng, lngLat.lat]);
        }
      });

      markersRef.current.push(mapboxMarker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0 && !navigationMode) {
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach(marker => bounds.extend(marker.coordinates));
      mapRef.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 15,
        duration: 1000,
      });
    }
  }, [markers, onMarkerDragEnd, navigationMode]);

  // Display Google Places markers
  useEffect(() => {
    if (!mapRef.current) return;

    placesMarkersRef.current.forEach(marker => marker.remove());
    placesMarkersRef.current = [];

    if (!enhancedPlaces || enhancedPlaces.length === 0) return;

    enhancedPlaces.forEach((place) => {
      const el = document.createElement('div');
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.backgroundColor = '#9333ea';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      const popupHTML = `
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; font-size: 14px;">${place.name}</div>
          ${place.rating ? `<div style="font-size: 12px; color: #666;">⭐ ${place.rating} (${place.ratingCount || 0} reviews)</div>` : ''}
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${place.address}</div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, draggable: false })
        .setLngLat(place.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      placesMarkersRef.current.push(marker);
    });
  }, [enhancedPlaces]);

  // Render custom user pins
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous custom pins
    customPinsRef.current.forEach(m => m.remove());
    customPinsRef.current = [];

    customPins.forEach((pin) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 bg-amber-500 rounded-full text-white text-xs font-bold shadow-lg border-2 border-white cursor-pointer">
          📌
        </div>
      `;

      const popupHTML = `
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; font-size: 14px;">${pin.label || 'My Pin'}</div>
          ${pin.address ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${pin.address}</div>` : ''}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      customPinsRef.current.push(marker);
    });
  }, [customPins]);

  // Render discovery (friend activity) markers
  useEffect(() => {
    if (!mapRef.current) return;

    discoveryMarkersRef.current.forEach(m => m.remove());
    discoveryMarkersRef.current = [];

    if (!discoveryPlaces || discoveryPlaces.length === 0) return;

    discoveryPlaces.forEach((place) => {
      const el = document.createElement('div');
      const color = place.color || '#6B7280';
      el.innerHTML = `
        <div style="width: 14px; height: 14px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer; opacity: 0.85;"></div>
      `;

      const popupHTML = `
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; font-size: 13px;">${place.name}</div>
          ${place.rating ? `<div style="font-size: 11px; color: #666;">⭐ ${place.rating}</div>` : ''}
          ${place.savedBy ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">Saved by ${place.isMine ? 'you' : place.savedBy}</div>` : ''}
          ${place.address ? `<div style="font-size: 11px; color: #999; margin-top: 2px;">${place.address}</div>` : ''}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, draggable: false })
        .setLngLat(place.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      discoveryMarkersRef.current.push(marker);
    });
  }, [discoveryPlaces]);

  // Render expense markers (size/color based on amount/category)
  useEffect(() => {
    if (!mapRef.current) return;

    expenseMarkersRef.current.forEach(m => m.remove());
    expenseMarkersRef.current = [];

    if (!expenseMarkers || expenseMarkers.length === 0) return;

    expenseMarkers.forEach((exp) => {
      const size = exp.size === 'large' ? 28 : exp.size === 'medium' ? 22 : 16;
      const color = exp.color || '#10B981';
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="width: ${size}px; height: ${size}px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: ${size < 22 ? 8 : 10}px; font-weight: bold;">$</span>
        </div>
      `;

      const popupHTML = `
        <div style="padding: 8px; max-width: 200px;">
          <div style="font-weight: bold; font-size: 13px;">${exp.name}</div>
          <div style="font-size: 14px; font-weight: 600; color: #059669; margin-top: 2px;">
            ${exp.currency === 'USD' ? '$' : exp.currency}${exp.amount.toFixed(2)}
          </div>
          ${exp.category ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${exp.category}</div>` : ''}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, draggable: false })
        .setLngLat(exp.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      expenseMarkersRef.current.push(marker);
    });
  }, [expenseMarkers]);

  // Render live group member avatar markers.
  // Uses a Map<user_id, marker> so we can update position in place (smooth animation)
  // rather than destroying and recreating markers on every position update.
  useEffect(() => {
    if (!mapRef.current) return;

    const currentIds = new Set(groupMemberMarkers.map((m) => m.user_id));

    // Remove markers for members no longer in the list
    groupMemberMarkersRef.current.forEach((marker, userId) => {
      if (!currentIds.has(userId)) {
        marker.remove();
        groupMemberMarkersRef.current.delete(userId);
      }
    });

    groupMemberMarkers.forEach((member) => {
      if (member.lat == null || member.lng == null) return;

      const existing = groupMemberMarkersRef.current.get(member.user_id);

      if (existing) {
        // Smooth position update — no flicker
        existing.setLngLat([member.lng, member.lat]);
        // Update heading rotation if available
        if (member.heading != null) {
          const el = existing.getElement();
          const inner = el.querySelector('.gm-avatar-inner');
          if (inner) inner.style.transform = `rotate(${member.heading}deg)`;
        }
        return;
      }

      // Create a new custom HTML marker for this member
      const bgColor = member.is_me ? '#16a34a' : member.role === 'leader' ? '#d97706' : '#183a37';
      const initial = (member.username || '?')[0].toUpperCase();
      const el = document.createElement('div');
      el.style.position = 'relative';
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          ${member.is_me
            ? '<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(22,163,74,0.4);animation:gm-ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>'
            : ''}
          <div class="gm-avatar-inner" style="width:32px;height:32px;background:${bgColor};border-radius:50%;color:white;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;transition:transform 0.3s ease;">
            ${initial}
          </div>
          <div style="background:${bgColor};color:white;font-size:9px;font-weight:600;padding:1px 5px;border-radius:99px;margin-top:2px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
            ${member.username || 'Member'}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bgColor};margin-top:-1px;"></div>
        </div>
      `;

      const popupHTML = `
        <div style="padding:8px;min-width:140px;">
          <div style="font-weight:700;font-size:13px;">${member.username || 'Member'}</div>
          ${member.role === 'leader' ? '<div style="font-size:11px;color:#d97706;">👑 Group Leader</div>' : ''}
          ${member.is_me ? '<div style="font-size:11px;color:#16a34a;">📍 Your location</div>' : ''}
          ${member.accuracy != null ? `<div style="font-size:11px;color:#6b7280;">~${Math.round(member.accuracy)}m accuracy</div>` : ''}
        </div>
      `;

      const mapboxMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([member.lng, member.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      groupMemberMarkersRef.current.set(member.user_id, mapboxMarker);
    });
  }, [groupMemberMarkers]);

  // Render shared collaborative pins (visible to all group members in real-time)
  useEffect(() => {
    if (!mapRef.current) return;

    const currentIds = new Set(sharedPins.map((p) => p.id));

    // Remove stale pin markers
    sharedPinsMarkersRef.current.forEach((marker, pinId) => {
      if (!currentIds.has(pinId)) {
        marker.remove();
        sharedPinsMarkersRef.current.delete(pinId);
      }
    });

    sharedPins.forEach((pin) => {
      if (sharedPinsMarkersRef.current.has(pin.id)) return; // already rendered

      const color = pin.color || '#183a37';
      const emoji = pin.emoji || '📍';
      const upvoteCount = (pin.upvoters || []).length;

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="width:34px;height:34px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">
            ${emoji}
          </div>
          ${upvoteCount > 0 ? `<div style="background:${color};color:white;font-size:9px;font-weight:700;padding:1px 4px;border-radius:99px;margin-top:2px;">+${upvoteCount}</div>` : ''}
          <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${color};"></div>
        </div>
      `;

      const popupHTML = `
        <div style="padding:8px;max-width:220px;">
          <div style="font-weight:700;font-size:13px;">${pin.emoji || '📍'} ${pin.title}</div>
          ${pin.note ? `<div style="font-size:12px;color:#4b5563;margin-top:4px;">${pin.note}</div>` : ''}
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">by ${pin.username || 'Member'}</div>
          ${upvoteCount > 0 ? `<div style="font-size:11px;color:#16a34a;margin-top:2px;">👍 ${upvoteCount} upvote${upvoteCount !== 1 ? 's' : ''}</div>` : ''}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(popupHTML))
        .addTo(mapRef.current);

      sharedPinsMarkersRef.current.set(pin.id, marker);
    });
  }, [sharedPins]);

  // Draw route with per-segment styling:
  //   Walking  → dotted gray line (like Google Maps)
  //   Driving  → solid blue line
  //   Cycling  → solid green line
  //   Transit  → solid colored line (uses transit line color if available)
  // During navigation: completed segments are faded gray.
  useEffect(() => {
    if (!mapRef.current) return;

    const SEGMENT_STYLES = {
      WALKING: { color: '#6B7280', width: 5, dasharray: [2, 4] },
      DRIVING: { color: '#3B82F6', width: 5, dasharray: null },
      BICYCLING: { color: '#10B981', width: 5, dasharray: null },
      TRANSIT: { color: '#8B5CF6', width: 6, dasharray: null },
    };

    const drawRoute = () => {
      const map = mapRef.current;
      const mapStyle = map.getStyle();
      if (mapStyle?.layers) {
        mapStyle.layers.forEach(layer => {
          if (layer.id.startsWith('route-seg-') || layer.id === 'route' || layer.id === 'route-completed') {
            if (map.getLayer(layer.id)) {
              map.removeLayer(layer.id);
            }
          }
        });
      }
      if (mapStyle?.sources) {
        Object.keys(mapStyle.sources).forEach(srcId => {
          if (srcId.startsWith('route-seg-') || srcId === 'route' || srcId === 'route-completed') {
            if (map.getSource(srcId)) {
              map.removeSource(srcId);
            }
          }
        });
      }

      if (!route) return;

      // ── Per-segment rendering (multi-modal) ──
      if (route.segments && route.segments.length > 0) {
        route.segments.forEach((segment, i) => {
          if (!segment.coordinates || segment.coordinates.length < 2) return;

          const mode = (segment.mode || 'DRIVING').toUpperCase();
          const segStyle = SEGMENT_STYLES[mode] || SEGMENT_STYLES.DRIVING;

          let lineColor = segStyle.color;
          if (mode === 'TRANSIT' && segment.transit?.lineColor) {
            lineColor = segment.transit.lineColor;
          }

          const sourceId = `route-seg-${i}`;
          const layerId = `route-seg-${i}`;

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: segment.coordinates },
            },
          });

          const paint = {
            'line-color': lineColor,
            'line-width': segStyle.width,
            'line-opacity': 0.8,
          };
          if (segStyle.dasharray) {
            paint['line-dasharray'] = segStyle.dasharray;
          }

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': segStyle.dasharray ? 'butt' : 'round' },
            paint,
          });
        });
        return;
      }

      const coords = route.geometry.coordinates;

      if (navigationMode && currentStepIndex > 0 && route.steps) {
        const currentStep = route.steps[currentStepIndex];
        const splitPoint = currentStep?.start_location;
        let splitIdx = 0;

        if (splitPoint) {
          let minDist = Infinity;
          coords.forEach(([lng, lat], i) => {
            const d = Math.abs(lng - splitPoint[0]) + Math.abs(lat - splitPoint[1]);
            if (d < minDist) { minDist = d; splitIdx = i; }
          });
        }

        if (splitIdx > 0) {
          map.addSource('route-completed', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords.slice(0, splitIdx + 1) },
            },
          });
          map.addLayer({
            id: 'route-completed',
            type: 'line',
            source: 'route-completed',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#9CA3AF', 'line-width': 5, 'line-opacity': 0.4 },
          });
        }

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords.slice(splitIdx) },
          },
        });
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.8 },
        });
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        });
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.8 },
        });
      }
    };

    if (mapRef.current.isStyleLoaded()) {
      drawRoute();
    } else {
      mapRef.current.on('load', drawRoute);
    }
  }, [route, navigationMode, currentStepIndex]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.75; }
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes gm-ping {
          0% { transform: scale(1); opacity: 0.6; }
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
});

export default Map;
