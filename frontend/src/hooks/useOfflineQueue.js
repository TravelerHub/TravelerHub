import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useOfflineQueue — queues API mutations made while offline and replays them
 * automatically when the network comes back.
 *
 * How to use:
 *   const { enqueue, queueSize, isFlushing } = useOfflineQueue();
 *
 *   // Instead of calling fetch directly for a mutation:
 *   if (!isOnline) {
 *     enqueue({ url: '/checklists/items', method: 'POST', body: JSON.stringify(item) });
 *     setItems(prev => [...prev, { ...item, _pending: true }]); // optimistic
 *   } else {
 *     await fetch(...);
 *   }
 *
 * The queue is persisted in localStorage so it survives page reloads.
 * On reconnect, all queued requests are replayed in order with the current auth token.
 */

const QUEUE_KEY = 'travelerhub_offline_queue';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

export function useOfflineQueue() {
  const [queueSize, setQueueSize] = useState(() => loadQueue().length);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastFlushResult, setLastFlushResult] = useState(null); // { synced, failed }
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    flushingRef.current = true;
    setIsFlushing(true);

    const failed = [];
    let synced = 0;

    for (const action of queue) {
      try {
        const res = await fetch(`${API_BASE}${action.url}`, {
          method: action.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
            ...action.headers,
          },
          body: action.body,
        });
        if (res.ok) {
          synced++;
        } else {
          // Non-retryable failure (e.g. 400 bad request) — drop it
          console.warn('[OfflineQueue] Non-retryable failure, dropping:', action.url, res.status);
        }
      } catch {
        // Network still unavailable — keep in queue
        failed.push(action);
      }
    }

    saveQueue(failed);
    setQueueSize(failed.length);
    setLastFlushResult({ synced, failed: failed.length });
    setIsFlushing(false);
    flushingRef.current = false;
  }, []);

  // Enqueue a mutation to be replayed when online
  const enqueue = useCallback((action) => {
    const queue = loadQueue();
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      url: action.url,
      method: action.method || 'POST',
      body: action.body || null,
      headers: action.headers || {},
      label: action.label || action.url, // human-readable label for UI
    });
    saveQueue(queue);
    setQueueSize(queue.length);
  }, []);

  // Auto-flush when the browser comes back online
  useEffect(() => {
    const handleOnline = () => flush();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flush]);

  // Expose a way to clear all pending actions (e.g. after logout)
  const clearQueue = useCallback(() => {
    saveQueue([]);
    setQueueSize(0);
  }, []);

  return { enqueue, flush, clearQueue, queueSize, isFlushing, lastFlushResult };
}
