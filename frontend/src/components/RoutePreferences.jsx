import { useState } from 'react';
import {
  BoltIcon,
  CameraIcon,
  CakeIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

const ROUTE_MODES = [
  { id: 'fastest', label: 'Fastest', icon: BoltIcon, color: 'blue', desc: 'Shortest travel time' },
  { id: 'scenic', label: 'Scenic', icon: CameraIcon, color: 'green', desc: 'Parks & viewpoints along the way' },
  { id: 'foodie', label: 'Foodie', icon: CakeIcon, color: 'orange', desc: 'Restaurants & cafes on route' },
  { id: 'budget', label: 'Budget', icon: CurrencyDollarIcon, color: 'emerald', desc: 'Affordable stops only' },
];

const COLOR_MAP = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-300', activeBg: 'bg-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-300', activeBg: 'bg-green-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-300', activeBg: 'bg-orange-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-300', activeBg: 'bg-emerald-600' },
};

/**
 * RoutePreferences — preference mode toggle + trip chapters timeline.
 *
 * Props:
 *   preference       — current preference mode
 *   onPreferenceChange — callback(newPreference)
 *   chapters         — array of chapter objects from smart-route API
 *   suggestions      — array of POI suggestions from smart-route API
 *   onSuggestionClick — callback(suggestion) to add POI to route
 *   loading          — whether a route is being planned
 */
export default function RoutePreferences({
  preference = 'fastest',
  onPreferenceChange,
  chapters = [],
  suggestions = [],
  onSuggestionClick,
  loading = false,
}) {
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  return (
    <div className="space-y-3">
      {/* Preference Mode Toggle */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Route Preference</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ROUTE_MODES.map(mode => {
            const isActive = preference === mode.id;
            const colors = COLOR_MAP[mode.color];
            const Icon = mode.icon;

            return (
              <button
                key={mode.id}
                onClick={() => onPreferenceChange?.(mode.id)}
                disabled={loading}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? `${colors.bg} ${colors.text} ring-1 ${colors.ring}`
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={mode.desc}
              >
                <Icon className="w-4 h-4" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trip Chapters Timeline */}
      {chapters.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setChaptersOpen(!chaptersOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Trip Chapters</span>
              <span className="text-xs text-gray-400">{chapters.length} segments</span>
            </div>
            {chaptersOpen ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {chaptersOpen && (
            <div className="px-3 pb-3 space-y-2">
              {chapters.map((chapter, i) => (
                <div key={i} className="relative pl-6 pb-2">
                  {/* Timeline connector */}
                  {i < chapters.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs">
                      {chapter.emoji === 'sunrise' ? '🌅' : chapter.emoji === 'sun' ? '☀️' : chapter.emoji === 'sunset' ? '🌆' : '🌙'}
                    </span>
                  </div>

                  {/* Chapter content */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{chapter.period}</span>
                      <span className="text-xs text-gray-400">{chapter.start_time}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {chapter.total_distance_text} · {chapter.total_duration_text}
                    </p>

                    {/* Legs within this chapter */}
                    <div className="mt-1 space-y-1">
                      {chapter.legs.map((leg, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className="truncate">{leg.from} → {leg.to}</span>
                          <span className="text-gray-400 whitespace-nowrap">({leg.duration})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POI Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <span className="text-sm font-medium text-gray-700">Suggested Stops</span>
              <span className="text-xs text-gray-400">{suggestions.length} places</span>
            </div>
            {suggestionsOpen ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {suggestionsOpen && (
            <div className="px-3 pb-3 space-y-1.5">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestionClick?.(sug)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-blue-50 text-left transition group"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-200">
                    <span className="text-xs">📍</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{sug.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {sug.rating && <span>⭐ {sug.rating}</span>}
                      {sug.vicinity && <span className="truncate">{sug.vicinity}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    + Add
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
