import { useState, useEffect } from 'react';
import { addNetworkListener } from '../utils/network';

/**
 * useNetworkStatus — tracks network online/offline state.
 *
 * On native (Capacitor): uses @capacitor/network plugin for reliable status.
 * On web: uses window online/offline events.
 *
 * Returns:
 *   isOnline     — true when the device has network access
 *   wasOffline   — true after the first offline→online transition this session
 *                  (use to trigger "back online, syncing…" banner)
 *   effectiveType — '4g'|'3g'|'2g'|'slow-2g'|null (Network Information API where supported)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [effectiveType, setEffectiveType] = useState(
    () => navigator.connection?.effectiveType ?? null
  );

  useEffect(() => {
    let cleanup;

    addNetworkListener(({ connected }) => {
      if (connected) {
        setIsOnline(true);
        setWasOffline(true);
      } else {
        setIsOnline(false);
      }
    }).then((removeFn) => {
      cleanup = removeFn;
    });

    // effectiveType is web-only (Network Information API); no Capacitor equivalent
    const handleConnectionChange = () => {
      setEffectiveType(navigator.connection?.effectiveType ?? null);
    };
    navigator.connection?.addEventListener('change', handleConnectionChange);

    return () => {
      cleanup?.();
      navigator.connection?.removeEventListener('change', handleConnectionChange);
    };
  }, []);

  return { isOnline, wasOffline, effectiveType };
}
