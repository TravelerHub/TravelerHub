import { useState, useEffect } from 'react';
import {
  UserGroupIcon,
  FunnelIcon,
  MapPinIcon,
  StarIcon,
  HeartIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { getGroupActivity, getGroupVibes } from '../services/discoveryService';

// Color mapping for categories
const CATEGORY_COLORS = {
  restaurant: '#EF4444',   // red
  cafe: '#F59E0B',         // amber
  bar: '#8B5CF6',          // purple
  hotel: '#3B82F6',        // blue
  museum: '#10B981',       // green
  park: '#22C55E',         // emerald
  tourist_attraction: '#F97316', // orange
  shopping: '#EC4899',     // pink
  nightlife: '#7C3AED',    // violet
  other: '#6B7280',        // gray
};

// Vibe presets that map to category filters
const VIBE_PRESETS = [
  { id: 'all', label: 'All', icon: '🗺️', categories: null },
  { id: 'foodie', label: 'Foodie', icon: '🍕', categories: ['restaurant', 'cafe', 'bakery', 'bar'] },
  { id: 'adventure', label: 'Adventure', icon: '🏔️', categories: ['park', 'tourist_attraction', 'natural_feature'] },
  { id: 'culture', label: 'Culture', icon: '🏛️', categories: ['museum', 'art_gallery', 'church', 'library'] },
  { id: 'nightlife', label: 'Nightlife', icon: '🌙', categories: ['bar', 'night_club', 'casino'] },
  { id: 'budget', label: 'Budget', icon: '💰', categories: ['restaurant', 'cafe'] },
];

/**
 * DiscoveryOverlay — renders friend activity markers and vibe filter controls.
 *
 * Props:
 *   groupId       — current group/trip ID
 *   mapRef        — ref to the Map component (for adding markers programmatically)
 *   onPlacesLoad  — callback with formatted places array for parent to pass to Map
 *   visible       — whether the overlay panel is visible
 *   onClose       — callback to hide the overlay
 */
export default function DiscoveryOverlay({ groupId, onPlacesLoad, visible, onClose }) {
  const [places, setPlaces] = useState([]);
  const [vibes, setVibes] = useState(null);
  const [activeVibe, setActiveVibe] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);

  useEffect(() => {
    if (groupId && visible) {
      loadData();
    }
  }, [groupId, visible]);

  useEffect(() => {
    // Filter and send places to parent whenever filter changes
    const filtered = filterPlaces(places);
    onPlacesLoad?.(filtered);
  }, [activeVibe, showFriendsOnly, places]);

  async function loadData() {
    setLoading(true);
    try {
      const [activityData, vibesData] = await Promise.all([
        getGroupActivity(groupId),
        getGroupVibes(groupId),
      ]);
      setPlaces(activityData.places || []);
      setVibes(vibesData);
    } catch (err) {
      console.error('Discovery load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterPlaces(allPlaces) {
    let filtered = allPlaces;

    // Filter by vibe/category
    if (activeVibe !== 'all') {
      const preset = VIBE_PRESETS.find(v => v.id === activeVibe);
      if (preset?.categories) {
        filtered = filtered.filter(p =>
          preset.categories.some(cat =>
            (p.category || '').toLowerCase().includes(cat)
          )
        );
      }
    }

    // Filter to only friends' places (not mine)
    if (showFriendsOnly) {
      filtered = filtered.filter(p => !p.is_mine);
    }

    // Format for map markers
    return filtered.map(p => ({
      id: p.id,
      name: p.place_name,
      address: p.place_address || '',
      coordinates: p.coordinates,
      rating: p.rating,
      category: p.category,
      color: CATEGORY_COLORS[p.category?.toLowerCase()] || CATEGORY_COLORS.other,
      savedBy: p.saved_by,
      isMine: p.is_mine,
    }));
  }

  if (!visible) return null;

  return (
    <div className="absolute top-16 right-4 z-20 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5" />
          <span className="font-semibold text-sm">Discovery</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Vibe Filter Pills */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <FunnelIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filter by vibe</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VIBE_PRESETS.map(vibe => (
            <button
              key={vibe.id}
              onClick={() => setActiveVibe(vibe.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                activeVibe === vibe.id
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {vibe.icon} {vibe.label}
            </button>
          ))}
        </div>
      </div>

      {/* Friends toggle */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Show friends' picks only</span>
        <button
          onClick={() => setShowFriendsOnly(!showFriendsOnly)}
          className={`p-1 rounded-lg transition ${showFriendsOnly ? 'text-red-500' : 'text-gray-300'}`}
        >
          {showFriendsOnly ? <HeartIconSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Group Vibes Summary */}
      {vibes && vibes.group_interests.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Group interests</p>
          <div className="flex flex-wrap gap-1">
            {vibes.group_interests.slice(0, 6).map(interest => (
              <span
                key={interest.name}
                className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs"
              >
                {interest.name} ({interest.count})
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Budget vibe: <span className="font-medium text-gray-600">{vibes.group_price_preference}</span>
            {' · '}
            {vibes.members_with_preferences}/{vibes.total_members} members have preferences set
          </p>
        </div>
      )}

      {/* Places List */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : places.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            No places saved by group members yet.
          </div>
        ) : (
          filterPlaces(places).map(place => (
            <div
              key={place.id}
              className="px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer transition"
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: place.color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{place.name}</p>
                  <p className="text-xs text-gray-400 truncate">{place.address}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {place.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <StarIcon className="w-3 h-3" /> {place.rating}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {place.isMine ? 'You' : place.savedBy}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 text-center">
        <p className="text-xs text-gray-400">
          {filterPlaces(places).length} places on map
        </p>
      </div>
    </div>
  );
}
