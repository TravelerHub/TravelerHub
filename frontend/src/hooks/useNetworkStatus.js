import { useState, useEffect } from 'react';

/**
 * useNetworkStatus — tracks browser online/offline state.
 *
 * Returns:
 *   isOnline     — true when the browser has network access
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
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleConnectionChange = () => {
      setEffectiveType(navigator.connection?.effectiveType ?? null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.connection?.addEventListener('change', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.connection?.removeEventListener('change', handleConnectionChange);
    };
  }, []);

  return { isOnline, wasOffline, effectiveType };
}
