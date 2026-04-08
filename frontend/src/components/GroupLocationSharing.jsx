import { useState, useEffect, useRef, useCallback } from 'react';
import { getGroupPositions, syncMyPosition } from '../services/smartRouteService';
import {
  MapPinIcon,
  SignalIcon,
  SignalSlashIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

/**
 * GroupLocationSharing — shows all group members' live positions
 * and lets the current user toggle sharing their own location.
 *
 * Props:
 *   tripId       – active group/trip ID
 *   onFlyTo      – (lat, lng) callback to center the map on a member
 *   memberMarkers – setter for member position markers shown on the map
 */
export default function GroupLocationSharing({ tripId, onFlyTo, memberMarkers }) {
  const [sharing, setSharing] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  // Fetch group positions from backend
  const fetchPositions = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getGroupPositions(tripId);
      const memberList = data.members || [];
      setMembers(memberList);

      // Push markers up to the parent for rendering on the map
      if (memberMarkers) {
        const markers = memberList
          .filter((m) => m.lat != null && m.lng != null)
          .map((m) => ({
            user_id: m.user_id,
            username: m.username,
            role: m.role,
            is_me: m.is_me,
            lat: m.lat,
            lng: m.lng,
            heading: m.heading,
            updated_at: m.position_updated_at,
          }));
        memberMarkers(markers);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tripId, memberMarkers]);

  // Initial fetch + poll every 10s
  useEffect(() => {
    fetchPositions();
    intervalRef.current = setInterval(fetchPositions, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchPositions]);

  // Start / stop sharing own location
  const toggleSharing = () => {
    if (sharing) {
      // Stop sharing
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharing(false);
    } else {
      // Start sharing
      if (!navigator.geolocation) {
        setError('Geolocation not supported by your browser');
        return;
      }
      setSharing(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          syncMyPosition(tripId, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            accuracy: pos.coords.accuracy,
          }).catch(() => {});
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError('Location access denied');
          setSharing(false);
        },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const timeAgo = (iso) => {
    if (!iso) return 'never';
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (!tripId) return null;

  const activeMembers = members.filter((m) => m.lat != null && m.lng != null);
  const inactiveMembers = members.filter((m) => m.lat == null || m.lng == null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4" style={{ color: '#183a37' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#160f29' }}>
            Group Location
          </h3>
          {activeMembers.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: '#dcfce7', color: '#166534' }}
            >
              {activeMembers.length} live
            </span>
          )}
        </div>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className="text-xs flex items-center gap-1 transition hover:opacity-70 disabled:opacity-40"
          style={{ color: '#183a37' }}
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Share toggle */}
      <button
        onClick={toggleSharing}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
        style={{
          background: sharing ? '#183a37' : '#e8e8e0',
          color: sharing ? '#ffffff' : '#160f29',
        }}
      >
        {sharing ? (
          <SignalIcon className="w-4 h-4" />
        ) : (
          <SignalSlashIcon className="w-4 h-4" />
        )}
        {sharing ? 'Sharing Your Location' : 'Start Sharing Location'}
      </button>

      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}

      {/* Active members */}
      {activeMembers.length > 0 && (
        <div className="space-y-1.5">
          {activeMembers.map((m) => (
            <button
              key={m.user_id}
              onClick={() => onFlyTo && onFlyTo(m.lat, m.lng)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition hover:opacity-80"
              style={{ background: m.is_me ? '#f0fdf4' : '#f0f0e8', borderColor: m.is_me ? '#bbf7d0' : '#d1d1c7' }}
            >
              {/* Avatar circle */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: m.role === 'leader' ? '#d97706' : '#183a37' }}
              >
                {(m.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: '#160f29' }}>
                  {m.username || 'Unknown'}
                  {m.is_me && (
                    <span className="ml-1 text-xs font-normal" style={{ color: '#5c6b73' }}>(you)</span>
                  )}
                  {m.role === 'leader' && (
                    <span className="ml-1 text-xs font-normal text-amber-600">leader</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ClockIcon className="w-2.5 h-2.5" style={{ color: '#5c6b73' }} />
                  <span className="text-xs" style={{ color: '#5c6b73' }}>
                    {timeAgo(m.position_updated_at)}
                  </span>
                  {m.accuracy != null && (
                    <span className="text-xs" style={{ color: '#5c6b73' }}>
                      · ~{Math.round(m.accuracy)}m
                    </span>
                  )}
                </div>
              </div>
              <MapPinIcon className="w-4 h-4 shrink-0" style={{ color: '#183a37' }} />
            </button>
          ))}
        </div>
      )}

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium px-1" style={{ color: '#5c6b73' }}>
            Not sharing ({inactiveMembers.length})
          </p>
          {inactiveMembers.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-50"
              style={{ background: '#f0f0e8' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: '#9ca3af' }}
              >
                {(m.username || '?')[0].toUpperCase()}
              </div>
              <span className="text-xs" style={{ color: '#5c6b73' }}>
                {m.username || 'Unknown'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 && !loading && (
        <div className="text-center py-4" style={{ color: '#5c6b73' }}>
          <UserGroupIcon className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
          <p className="text-xs">No group members found</p>
        </div>
      )}
    </div>
  );
}
