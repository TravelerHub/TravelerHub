/**
 * GroupGeofenceAlert — notifies all group members when someone arrives
 * within ARRIVAL_RADIUS meters of a route waypoint.
 *
 * Neither Google Maps nor Waze shows the whole group when one member arrives;
 * this component fills that gap with a non-intrusive toast system.
 *
 * Usage: drop it inside Navigation.jsx and pass live member positions + waypoints.
 * It manages its own "already notified" state so toasts don't repeat.
 *
 * Props:
 *   memberMarkers — live group member positions from GroupLocationSharing
 *   waypoints     — route markers [{coordinates: [lng,lat], title: string}]
 *   onAlert       — optional (alert) → void callback for external handling
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

const ARRIVAL_RADIUS_M = 250;  // within 250 m = "arrived"
const TOAST_DURATION_MS = 5000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GroupGeofenceAlert({ memberMarkers = [], waypoints = [], onAlert }) {
  const [toasts, setToasts] = useState([]);
  // Set of "userId:waypointIndex" pairs we've already fired
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!memberMarkers.length || !waypoints.length) return;

    memberMarkers.forEach((member) => {
      if (member.lat == null || member.lng == null) return;

      waypoints.forEach((wp, idx) => {
        const [wpLng, wpLat] = wp.coordinates;
        const dist = haversineMeters(member.lat, member.lng, wpLat, wpLng);
        const key = `${member.user_id}:${idx}`;

        if (dist <= ARRIVAL_RADIUS_M && !firedRef.current.has(key)) {
          firedRef.current.add(key);

          const alert = {
            id: `${key}-${Date.now()}`,
            username: member.username || 'A member',
            place: wp.title || `Stop ${idx + 1}`,
            is_me: member.is_me,
            dist: Math.round(dist),
          };

          setToasts((prev) => [...prev, alert]);
          onAlert?.(alert);

          // Auto-dismiss after TOAST_DURATION_MS
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== alert.id));
          }, TOAST_DURATION_MS);
        }

        // Clear the fired key when member moves far away (so future arrivals fire again)
        if (dist > ARRIVAL_RADIUS_M * 3 && firedRef.current.has(key)) {
          firedRef.current.delete(key);
        }
      });
    });
  }, [memberMarkers, waypoints, onAlert]);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none"
      style={{ maxWidth: 340 }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl animate-bounce-in"
          style={{
            background: toast.is_me ? '#f0fdf4' : '#183a37',
            color: toast.is_me ? '#166534' : 'white',
            border: toast.is_me ? '1.5px solid #bbf7d0' : 'none',
          }}
        >
          <CheckCircleIcon className="w-5 h-5 shrink-0" style={{ color: toast.is_me ? '#16a34a' : '#4ade80' }} />
          <div className="flex-1">
            <span className="font-semibold text-sm">
              {toast.is_me ? 'You arrived' : `${toast.username} arrived`}
            </span>
            <span className="text-sm"> at </span>
            <span className="font-semibold text-sm">{toast.place}</span>
          </div>
          <button
            onClick={() =>
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }
            className="ml-1 opacity-60 hover:opacity-100 transition"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
