/**
 * OfflineBanner — app-wide network status indicator.
 *
 * Shows an amber bar when offline, a green "back online" confirmation for 3 s,
 * and a subtle chip when connection quality is degraded (2G/slow-2G).
 * Mounts at the top of the viewport — wire it into AuthLayout in router.jsx.
 */

import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import {
  WifiIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';

export default function OfflineBanner() {
  const { isOnline, wasOffline, effectiveType } = useNetworkStatus();
  const { queueSize, isFlushing, lastFlushResult } = useOfflineQueue();
  const [showReconnected, setShowReconnected] = useState(false);

  // Show "back online" toast for 3 s after reconnecting
  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  const slowConnection = !isOnline ? false : effectiveType === '2g' || effectiveType === 'slow-2g';

  // Nothing to show when fully online with good connection
  if (isOnline && !showReconnected && !slowConnection) return null;

  // ── Offline bar ──
  if (!isOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium shadow-sm"
        style={{ background: '#92400e', color: '#fef3c7' }}
      >
        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
        <span>You&apos;re offline</span>
        {queueSize > 0 && (
          <span
            className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: '#b45309', color: '#fef9c3' }}
          >
            {queueSize} change{queueSize !== 1 ? 's' : ''} queued
          </span>
        )}
        <span className="ml-1 opacity-70 text-xs">· Changes will sync when you reconnect</span>
      </div>
    );
  }

  // ── Back online ──
  if (showReconnected) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium shadow-sm"
        style={{ background: '#166534', color: '#dcfce7' }}
      >
        {isFlushing ? (
          <>
            <ArrowPathIcon className="w-4 h-4 shrink-0 animate-spin" />
            <span>Back online — syncing {queueSize} queued action{queueSize !== 1 ? 's' : ''}…</span>
          </>
        ) : (
          <>
            <CheckCircleIcon className="w-4 h-4 shrink-0" />
            <span>
              Back online
              {lastFlushResult?.synced > 0
                ? ` — ${lastFlushResult.synced} change${lastFlushResult.synced !== 1 ? 's' : ''} synced`
                : ''}
            </span>
          </>
        )}
      </div>
    );
  }

  // ── Slow connection chip (non-intrusive, bottom-right) ──
  if (slowConnection) {
    return (
      <div
        className="fixed bottom-20 right-4 z-[9999] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-md"
        style={{ background: '#451a03', color: '#fed7aa', opacity: 0.9 }}
      >
        <WifiIcon className="w-3.5 h-3.5" />
        Slow connection ({effectiveType})
      </div>
    );
  }

  return null;
}
