/**
 * TripExport — export panel for a trip.
 *
 * Modes:
 *   compact=false (default) — full panel with five export options:
 *     1. Download Offline Copy (existing JSON blob assembled client-side)
 *     2. Export to Calendar (.ics)   — iCal download via /export/trips/:id/calendar.ics
 *     3. Export Expenses (.csv)      — CSV download via /export/trips/:id/expenses.csv
 *     4. Copy Trip Summary           — JSON copied to clipboard via /export/trips/:id/summary.json
 *     5. (future: PDF itinerary)
 *
 *   compact=true — small icon-only button for the original offline-copy behaviour
 *                  (kept for backwards compat with any callers that pass compact)
 *
 * Props:
 *   tripId    — the trip UUID to export
 *   tripName  — display name for the filename / clip text header
 *   compact   — render a small icon-button (default false)
 */

import { useState } from 'react';
import {
  ArrowDownTrayIcon,
  CheckIcon,
  CalendarDaysIcon,
  TableCellsIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

async function fetchSafe(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Download a binary/text response from an authenticated endpoint.
 * Returns true on success, false on failure.
 */
async function downloadFile(path, filename, mimeType) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Individual action hook
// ---------------------------------------------------------------------------

function useExportAction(actionFn) {
  const [state, setState] = useState('idle'); // idle | loading | done | error

  const run = async () => {
    if (state === 'loading') return;
    setState('loading');
    const ok = await actionFn();
    setState(ok ? 'done' : 'error');
    setTimeout(() => setState('idle'), 3000);
  };

  return { state, run };
}

// ---------------------------------------------------------------------------
// Shared button component
// ---------------------------------------------------------------------------

function ExportButton({ icon: Icon, doneIcon: DoneIcon, label, loadingLabel, doneLabel, errorLabel, state, onClick, disabled }) {
  const isLoading = state === 'loading';
  const isDone = state === 'done';
  const isError = state === 'error';

  const CurrentIcon = isDone && DoneIcon ? DoneIcon : Icon;
  const currentLabel = isLoading
    ? loadingLabel
    : isDone
    ? doneLabel
    : isError
    ? (errorLabel || 'Failed — try again')
    : label;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: '#1c2b2a', color: '#e8e8e0' }}
    >
      <CurrentIcon
        className={`w-4 h-4 flex-shrink-0 ${isLoading ? 'animate-pulse' : ''} ${isDone ? 'text-green-400' : isError ? 'text-red-400' : ''}`}
      />
      <span className={isDone ? 'text-green-300' : isError ? 'text-red-300' : ''}>
        {currentLabel}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TripExport({ tripId, tripName = 'trip', compact = false }) {
  // ── Existing: offline JSON download (client-assembled) ──────────────────
  const [offlineState, setOfflineState] = useState('idle');

  const handleOfflineExport = async () => {
    if (!tripId || offlineState === 'loading') return;
    setOfflineState('loading');

    const [itinerary, expenses, checklist, members, calendar] = await Promise.all([
      fetchSafe(`/routes?trip_id=${tripId}`),
      fetchSafe(`/finance/expenses?trip_id=${tripId}`),
      fetchSafe(`/checklists?trip_id=${tripId}`),
      fetchSafe(`/groups/${tripId}/members`),
      fetchSafe(`/calendar/events?trip_id=${tripId}`),
    ]);

    const localKeys = Object.keys(localStorage).filter(
      (k) => k.includes('travelerhub_cache') && k.includes(tripId)
    );
    const localCache = {};
    localKeys.forEach((k) => {
      try {
        const entry = JSON.parse(localStorage.getItem(k));
        const ns = k.split(':')[1];
        localCache[ns] = entry.data;
      } catch {}
    });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      tripId,
      tripName,
      itinerary: itinerary ?? localCache['itinerary'] ?? [],
      expenses: expenses ?? localCache['expenses'] ?? [],
      checklist: checklist ?? localCache['checklist'] ?? [],
      members: members ?? localCache['members'] ?? [],
      calendar: calendar ?? localCache['calendar'] ?? [],
      offlineNotes: `TravelerHub Offline Pack — ${tripName}\nExported: ${new Date().toLocaleString()}\n\nThis file contains all your trip data for offline use.\nOpen in any text editor, or share with group members.\nEmergency contacts are stored separately in the Emergency page.`,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelerhub-${tripName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setOfflineState('done');
    setTimeout(() => setOfflineState('idle'), 3000);
  };

  // ── New: iCal ────────────────────────────────────────────────────────────
  const ical = useExportAction(() =>
    downloadFile(
      `/export/trips/${tripId}/calendar.ics`,
      `travelerhub-${tripName.replace(/\s+/g, '-').toLowerCase()}.ics`,
      'text/calendar'
    )
  );

  // ── New: CSV expenses ────────────────────────────────────────────────────
  const csv = useExportAction(() =>
    downloadFile(
      `/export/trips/${tripId}/expenses.csv`,
      `expenses-${tripName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv'
    )
  );

  // ── New: Copy JSON summary ───────────────────────────────────────────────
  const [copyState, setCopyState] = useState('idle');

  const handleCopySummary = async () => {
    if (!tripId || copyState === 'loading') return;
    setCopyState('loading');
    try {
      const res = await fetch(`${API_BASE}/export/trips/${tripId}/summary.json`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 3000);
  };

  // ── compact mode (backwards compat) ─────────────────────────────────────
  if (compact) {
    const isDone = offlineState === 'done';
    return (
      <button
        onClick={handleOfflineExport}
        disabled={offlineState === 'loading' || !tripId}
        title="Download offline copy"
        className="p-1.5 rounded-lg transition hover:opacity-70 disabled:opacity-40"
        style={{ color: '#183a37' }}
      >
        {isDone
          ? <CheckIcon className="w-4 h-4 text-green-600" />
          : <ArrowDownTrayIcon className="w-4 h-4" />}
      </button>
    );
  }

  // ── Full panel ───────────────────────────────────────────────────────────
  const noTrip = !tripId;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: '#111f1e' }}
    >
      {/* Section label */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#7a9e9a' }}>
        Export Trip Data
      </p>

      {/* 1. iCal */}
      <ExportButton
        icon={CalendarDaysIcon}
        doneIcon={CheckIcon}
        label="Export to Calendar (.ics)"
        loadingLabel="Building calendar…"
        doneLabel="Opening in calendar app…"
        state={ical.state}
        onClick={ical.run}
        disabled={noTrip}
      />

      {/* 2. CSV expenses */}
      <ExportButton
        icon={TableCellsIcon}
        doneIcon={CheckIcon}
        label="Export Expenses (.csv)"
        loadingLabel="Downloading expenses…"
        doneLabel="Downloaded!"
        state={csv.state}
        onClick={csv.run}
        disabled={noTrip}
      />

      {/* 3. Copy JSON summary */}
      <button
        onClick={handleCopySummary}
        disabled={noTrip || copyState === 'loading'}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#1c2b2a', color: '#e8e8e0' }}
      >
        {copyState === 'done'
          ? <ClipboardDocumentCheckIcon className="w-4 h-4 flex-shrink-0 text-green-400" />
          : <ClipboardDocumentIcon className={`w-4 h-4 flex-shrink-0 ${copyState === 'loading' ? 'animate-pulse' : ''} ${copyState === 'error' ? 'text-red-400' : ''}`} />}
        <span className={copyState === 'done' ? 'text-green-300' : copyState === 'error' ? 'text-red-300' : ''}>
          {copyState === 'loading'
            ? 'Fetching summary…'
            : copyState === 'done'
            ? 'Copied!'
            : copyState === 'error'
            ? 'Failed — try again'
            : 'Copy Trip Summary'}
        </span>
      </button>

      {/* Divider */}
      <div className="my-1 border-t" style={{ borderColor: '#1e3230' }} />

      {/* 4. Offline JSON (existing behaviour) */}
      <button
        onClick={handleOfflineExport}
        disabled={noTrip || offlineState === 'loading'}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#1c2b2a', color: '#e8e8e0' }}
      >
        {offlineState === 'done'
          ? <CheckIcon className="w-4 h-4 flex-shrink-0 text-green-400" />
          : <ArrowDownTrayIcon className={`w-4 h-4 flex-shrink-0 ${offlineState === 'loading' ? 'animate-bounce' : ''}`} />}
        <span className={offlineState === 'done' ? 'text-green-300' : ''}>
          {offlineState === 'loading'
            ? 'Preparing…'
            : offlineState === 'done'
            ? 'Downloaded!'
            : 'Download Offline Copy'}
        </span>
      </button>
    </div>
  );
}
