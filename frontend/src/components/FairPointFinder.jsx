import { useState } from 'react';
import { findFairPoint } from '../services/gcsService';
import { MapPinIcon, StarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const POI_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'tourist_attraction', label: 'Attraction' },
  { value: 'park', label: 'Park' },
  { value: 'shopping_mall', label: 'Shopping' },
];

export default function FairPointFinder({ tripId, onSelectPlace, onCreatePoll }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [poiType, setPoiType] = useState('restaurant');
  const [keyword, setKeyword] = useState('');
  const [autoPoll, setAutoPoll] = useState(false);

  const handleFind = async () => {
    if (!tripId) return;
    setLoading(true);
    setError('');
    try {
      const data = await findFairPoint(tripId, {
        poi_type: poiType,
        keyword: keyword || null,
        auto_poll: autoPoll,
      });
      setResult(data);
      if (data.poll_id && onCreatePoll) {
        onCreatePoll(data.poll_id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPinIcon className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-sm text-gray-800">Fair Meeting Point</h3>
      </div>

      <p className="text-xs text-gray-500">
        Finds the optimal point that minimizes total travel for everyone in the group.
      </p>

      {/* Controls */}
      <div className="flex gap-2">
        <select
          value={poiType}
          onChange={(e) => setPoiType(e.target.value)}
          className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {POI_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. Italian, Sushi..."
          className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={autoPoll}
          onChange={(e) => setAutoPoll(e.target.checked)}
          className="rounded text-indigo-600 focus:ring-indigo-500"
        />
        Auto-create ranked-choice poll from results
      </label>

      <button
        onClick={handleFind}
        disabled={loading || !tripId}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        <MagnifyingGlassIcon className="w-4 h-4" />
        {loading ? 'Calculating...' : 'Find Fair Point'}
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Results */}
      {result && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-indigo-600">
              Median: {result.geometric_median.lat.toFixed(4)}, {result.geometric_median.lng.toFixed(4)}
            </span>
            <span>({result.member_count} members)</span>
          </div>

          {result.group_preferences?.group_pace && (
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                Pace: {result.group_preferences.group_pace}
              </span>
              <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">
                Price: {result.group_preferences.price_preference}
              </span>
            </div>
          )}

          {result.suggestions?.length > 0 ? (
            <div className="space-y-1.5">
              {result.suggestions.map((s, i) => (
                <button
                  key={s.place_id || i}
                  onClick={() => onSelectPlace?.({
                    coordinates: [s.lng, s.lat],
                    title: s.name,
                    description: s.address,
                    place_id: s.place_id,
                  })}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.address}</p>
                  </div>
                  {s.rating && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600">
                      <StarIcon className="w-3 h-3" />
                      {s.rating}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No places found near the geometric median.</p>
          )}

          {result.poll_id && (
            <div className="p-2 bg-green-50 rounded-lg text-xs text-green-700">
              Ranked-choice poll created! Share it with your group.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
