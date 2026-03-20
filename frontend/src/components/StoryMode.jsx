import { useState, useEffect, useRef } from 'react';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ForwardIcon,
  BackwardIcon,
  XMarkIcon,
  PhotoIcon,
} from '@heroicons/react/24/solid';

/**
 * StoryMode — "Play" button that traces the route on the map and pops up
 * photos/info at each stop, creating an instant trip recap.
 *
 * Props:
 *   route       — route object with geometry.coordinates array
 *   photos      — array of { coordinates: [lng,lat], url, caption, created_at }
 *   waypoints   — array of { name, coordinates: [lng,lat] }
 *   mapRef      — ref to Map component (for flyTo)
 *   visible     — whether story mode is active
 *   onClose     — callback to exit story mode
 */
export default function StoryMode({ route, photos = [], waypoints = [], mapRef, visible, onClose }) {
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const intervalRef = useRef(null);

  // Build "stops" — waypoints interleaved with nearby photos
  const stops = buildStops(waypoints, photos);

  useEffect(() => {
    if (!visible) {
      setPlaying(false);
      setCurrentIndex(0);
      setCurrentPhoto(null);
    }
  }, [visible]);

  useEffect(() => {
    if (playing && stops.length > 0) {
      flyToStop(currentIndex);

      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          if (next >= stops.length) {
            setPlaying(false);
            return prev;
          }
          return next;
        });
      }, 3000); // 3 seconds per stop
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  useEffect(() => {
    if (visible && stops.length > 0) {
      flyToStop(currentIndex);
    }
  }, [currentIndex]);

  function flyToStop(index) {
    const stop = stops[index];
    if (!stop) return;

    mapRef?.current?.flyTo(stop.coordinates, { zoom: 15, duration: 1500 });

    if (stop.photo) {
      setCurrentPhoto(stop.photo);
    } else {
      setCurrentPhoto(null);
    }
  }

  function handlePlay() {
    if (currentIndex >= stops.length - 1) setCurrentIndex(0);
    setPlaying(true);
  }

  function handlePause() {
    setPlaying(false);
  }

  function handleNext() {
    setPlaying(false);
    setCurrentIndex(prev => Math.min(prev + 1, stops.length - 1));
  }

  function handlePrev() {
    setPlaying(false);
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }

  if (!visible) return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30">
      {/* Photo popup */}
      {currentPhoto && (
        <div className="mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-sm mx-auto">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || 'Trip photo'}
            className="w-full h-48 object-cover"
          />
          {currentPhoto.caption && (
            <div className="px-4 py-2">
              <p className="text-sm text-gray-700">{currentPhoto.caption}</p>
              {currentPhoto.created_at && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(currentPhoto.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current stop info */}
      {stops[currentIndex] && (
        <div className="mb-2 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 text-center shadow-lg">
          <p className="text-sm font-semibold text-gray-800">
            {stops[currentIndex].name}
          </p>
          <p className="text-xs text-gray-500">
            Stop {currentIndex + 1} of {stops.length}
          </p>
        </div>
      )}

      {/* Playback controls */}
      <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white rounded-lg transition"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Previous */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-2 text-gray-400 hover:text-white rounded-lg transition disabled:opacity-30"
        >
          <BackwardIcon className="w-5 h-5" />
        </button>

        {/* Play/Pause */}
        {playing ? (
          <button
            onClick={handlePause}
            className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition"
          >
            <PauseIcon className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition"
          >
            <PlayIcon className="w-6 h-6" />
          </button>
        )}

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={currentIndex >= stops.length - 1}
          className="p-2 text-gray-400 hover:text-white rounded-lg transition disabled:opacity-30"
        >
          <ForwardIcon className="w-5 h-5" />
        </button>

        {/* Progress */}
        <div className="flex-1 mx-2">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${stops.length > 0 ? ((currentIndex + 1) / stops.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Photos count */}
        <div className="flex items-center gap-1 text-gray-400">
          <PhotoIcon className="w-4 h-4" />
          <span className="text-xs">{photos.length}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Build an ordered list of "stops" from waypoints + nearby photos.
 * Photos are matched to the nearest waypoint.
 */
function buildStops(waypoints, photos) {
  const stops = waypoints.map(wp => ({
    name: wp.name || wp.title || 'Stop',
    coordinates: wp.coordinates,
    type: 'waypoint',
    photo: null,
  }));

  // Match photos to nearest waypoint
  photos.forEach(photo => {
    if (!photo.coordinates || photo.coordinates.length < 2) return;

    let minDist = Infinity;
    let nearestIdx = 0;

    stops.forEach((stop, i) => {
      const d = Math.abs(stop.coordinates[0] - photo.coordinates[0]) +
                Math.abs(stop.coordinates[1] - photo.coordinates[1]);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    });

    // Attach photo to the nearest stop, or insert after it
    if (!stops[nearestIdx].photo) {
      stops[nearestIdx].photo = photo;
    } else {
      // Insert as a separate photo stop
      stops.splice(nearestIdx + 1, 0, {
        name: photo.caption || 'Photo',
        coordinates: photo.coordinates,
        type: 'photo',
        photo,
      });
    }
  });

  return stops;
}
