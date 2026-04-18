/**
 * TripExport — lets users download a full offline copy of their trip data
 * (itinerary, expenses, checklist, members, notes) as a single JSON file.
 *
 * Why: when you land in a foreign country with no data plan, you need your
 * booking info, addresses, and contact numbers without any internet access.
 *
 * The downloaded file is human-readable JSON that can also be opened in
 * any text editor or spreadsheet app.
 *
 * Props:
 *   tripId    — the trip UUID to export
 *   tripName  — display name for the filename
 *   compact   — render a small icon-button (default false)
 */

import { useState } from 'react';
import { ArrowDownTrayIcon, CheckIcon } from '@heroicons/react/24/outline';
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

export default function TripExport({ tripId, tripName = 'trip', compact = false }) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    if (!tripId) return;
    setExporting(true);

    // Fetch all trip data in parallel
    const [itinerary, expenses, checklist, members, calendar] = await Promise.all([
      fetchSafe(`/routes?trip_id=${tripId}`),
      fetchSafe(`/finance/expenses?trip_id=${tripId}`),
      fetchSafe(`/checklists?trip_id=${tripId}`),
      fetchSafe(`/groups/${tripId}/members`),
      fetchSafe(`/calendar/events?trip_id=${tripId}`),
    ]);

    // Also pull any locally cached data as a fallback
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
      offlineNotes: `
TravelerHub Offline Pack — ${tripName}
Exported: ${new Date().toLocaleString()}

This file contains all your trip data for offline use.
Open in any text editor, or share with group members.
Emergency contacts are stored separately in the Emergency page.
      `.trim(),
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelerhub-${tripName.replace(/\s+/g, '-').toLowerCase()}-${
      new Date().toISOString().slice(0, 10)
    }.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  if (compact) {
    return (
      <button
        onClick={handleExport}
        disabled={exporting || !tripId}
        title="Download offline copy"
        className="p-1.5 rounded-lg transition hover:opacity-70 disabled:opacity-40"
        style={{ color: '#183a37' }}
      >
        {done
          ? <CheckIcon className="w-4 h-4 text-green-600" />
          : <ArrowDownTrayIcon className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || !tripId}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
      style={{ background: '#e8e8e0', color: '#160f29' }}
    >
      {done ? (
        <>
          <CheckIcon className="w-4 h-4 text-green-600" />
          Downloaded!
        </>
      ) : (
        <>
          <ArrowDownTrayIcon className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
          {exporting ? 'Preparing…' : 'Download Offline Copy'}
        </>
      )}
    </button>
  );
}
