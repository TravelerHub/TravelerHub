import { isNative } from './platform';

/**
 * Unified geolocation API.
 * Native: uses @capacitor/geolocation (works in background on iOS/Android)
 * Web: uses navigator.geolocation
 */

export async function getCurrentPosition() {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perms = await Geolocation.requestPermissions();
    if (perms.location !== 'granted') throw new Error('Location permission denied');
    return Geolocation.getCurrentPosition({ enableHighAccuracy: true });
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
    });
  });
}

export async function watchPosition(callback) {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.requestPermissions();
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (position, err) => {
        if (err) { console.error('[Geo] watch error:', err); return; }
        callback(position);
      }
    );
    // Return a cleanup function
    return () => Geolocation.clearWatch({ id: watchId });
  }
  // Web fallback
  const id = navigator.geolocation.watchPosition(callback, console.error, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 8000,
  });
  return () => navigator.geolocation.clearWatch(id);
}
