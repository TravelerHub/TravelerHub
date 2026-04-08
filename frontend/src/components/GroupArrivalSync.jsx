import { useState, useEffect } from 'react';
import { getGroupArrivalSync } from '../services/gcsService';
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function GroupArrivalSync({ tripId, destination, autoRefresh = false }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fetchSync = async () => {
    if (!tripId || !destination) return;
    setLoading(true);
    setError('');
    try {
      const result = await getGroupArrivalSync(tripId, destination.lat, destination.lng);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (destination && tripId) fetchSync();
  }, [tripId, destination?.lat, destination?.lng]);

  // Auto-refresh every 30s when navigating
  useEffect(() => {
    if (!autoRefresh || !destination || !tripId) return;
    const interval = setInterval(fetchSync, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, tripId, destination]);

  if (!destination) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-800">Group Arrival Sync</h3>
        </div>
        <button
          onClick={fetchSync}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {data?.status === 'no_positions' && (
        <p className="text-xs text-gray-400">No group members sharing their location yet.</p>
      )}

      {data?.status === 'sync_complete' && (
        <>
          {/* Group ETA Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-800">{Math.round(data.group_eta.earliest_seconds / 60)}</p>
              <p className="text-xs text-gray-500">min (first)</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-800">{Math.round(data.group_eta.average_seconds / 60)}</p>
              <p className="text-xs text-gray-500">min (avg)</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-800">{Math.round(data.group_eta.latest_seconds / 60)}</p>
              <p className="text-xs text-gray-500">min (last)</p>
            </div>
          </div>

          {/* Spread warning */}
          {data.group_eta.spread_minutes > 15 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                {data.group_eta.spread_minutes} min spread between first and last arrival.
              </p>
            </div>
          )}

          {/* Leader alert */}
          {data.leader_alert && (
            <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700">
                {data.delayed_count} member{data.delayed_count > 1 ? 's' : ''} delayed:{' '}
                {data.delayed_members.map(d => `${d.username} (+${d.extra_minutes} min)`).join(', ')}
              </p>
            </div>
          )}

          {/* Member list */}
          <div className="space-y-1">
            {data.members.map((m) => (
              <div
                key={m.user_id}
                className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                  m.is_delayed ? 'bg-red-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {m.is_delayed ? (
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
                  )}
                  <span className="font-medium text-gray-700">
                    {m.username}
                    {m.role === 'leader' && (
                      <span className="ml-1 text-amber-600 text-[10px]">(leader)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <span>{m.eta_text}</span>
                  <span>{m.distance_text}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
