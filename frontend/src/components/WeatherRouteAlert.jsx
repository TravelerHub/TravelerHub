import { useState, useEffect } from 'react';
import { getRouteWeather } from '../services/weatherService';
import { ExclamationTriangleIcon, SunIcon, CloudIcon } from '@heroicons/react/24/outline';

const SEVERITY_STYLES = {
  high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500' },
};

export default function WeatherRouteAlert({ waypoints, departureTime, routeDurationMinutes }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;
    fetchWeather();
  }, [waypoints?.length, departureTime]);

  const fetchWeather = async () => {
    if (!waypoints || waypoints.length < 2) return;
    setLoading(true);
    try {
      const data = await getRouteWeather(waypoints, departureTime, routeDurationMinutes);
      setWeather(data);
    } catch (e) {
      console.error('Weather fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-400 animate-pulse">Checking weather along route...</p>
      </div>
    );
  }

  if (!weather) return null;
  if (!weather.has_hazards && !weather.has_rain && collapsed) return null;

  const hasImpact = weather.has_hazards || weather.has_rain;

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      weather.has_hazards ? 'bg-red-50 border-red-200' :
      weather.has_rain ? 'bg-amber-50 border-amber-200' :
      'bg-green-50 border-green-200'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {weather.has_hazards ? (
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
          ) : weather.has_rain ? (
            <CloudIcon className="w-4 h-4 text-amber-500" />
          ) : (
            <SunIcon className="w-4 h-4 text-green-500" />
          )}
          <span className={`text-xs font-semibold ${
            weather.has_hazards ? 'text-red-700' :
            weather.has_rain ? 'text-amber-700' :
            'text-green-700'
          }`}>
            {weather.has_hazards ? 'Weather Hazard on Route' :
             weather.has_rain ? 'Rain Expected on Route' :
             'Clear Weather Along Route'}
          </span>
        </div>

        {!hasImpact && (
          <button onClick={() => setCollapsed(true)} className="text-xs text-gray-400 hover:text-gray-600">
            Dismiss
          </button>
        )}
      </div>

      {/* Time adjustment */}
      {weather.max_time_increase_pct > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className={weather.has_hazards ? 'text-red-600' : 'text-amber-600'}>
            Est. +{weather.max_time_increase_pct}% travel time
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            {weather.original_duration_minutes} min &rarr; {weather.weather_adjusted_duration_minutes} min
          </span>
        </div>
      )}

      {/* Alerts */}
      {weather.alerts?.length > 0 && (
        <div className="space-y-1.5">
          {weather.alerts.map((alert, i) => {
            const styles = SEVERITY_STYLES[alert.impact?.severity] || SEVERITY_STYLES.low;
            return (
              <div key={i} className={`p-2 rounded-lg border ${styles.bg} ${styles.border}`}>
                <p className={`text-xs ${styles.text}`}>{alert.message}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                  {alert.temperature_f != null && <span>{Math.round(alert.temperature_f)}°F</span>}
                  {alert.wind_mph != null && <span>{Math.round(alert.wind_mph)} mph wind</span>}
                  {alert.precipitation_pct != null && <span>{alert.precipitation_pct}% precip chance</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Waypoint conditions (compact) */}
      {!hasImpact && weather.forecasts?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {weather.forecasts.map((f, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-white/60 rounded-full text-gray-600">
              WP{f.waypoint_index + 1}: {f.weather_description}
              {f.temperature_f != null && ` ${Math.round(f.temperature_f)}°F`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
