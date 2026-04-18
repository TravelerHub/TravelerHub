/**
 * ActivityFeed — real-time social feed of what group members are doing.
 * Subscribes to Supabase Realtime on trip_activity so new events appear
 * instantly without a refresh.
 *
 * Props:
 *   tripId  — the trip UUID
 *   limit   — max events to show (default 20)
 *   compact — if true, renders a slim sidebar-style list (default false)
 */

import { useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../lib/supabaseClient';

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function avatarBg(name = '') {
  const colors = ['#183a37', '#160f29', '#2d1b4e', '#1e3a5f', '#3b2f00', '#3b1f1f', '#1a3320'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

const ACTION_META = {
  voted:            { emoji: '🗳️', verb: 'voted for' },
  added_photo:      { emoji: '📸', verb: 'added a photo' },
  liked_photo:      { emoji: '❤️', verb: 'liked a photo' },
  commented_photo:  { emoji: '💬', verb: 'commented on' },
  checked_task:     { emoji: '✅', verb: 'completed' },
  added_expense:    { emoji: '💰', verb: 'logged an expense' },
  pinned_location:  { emoji: '📍', verb: 'pinned' },
  joined:           { emoji: '👋', verb: 'joined the trip' },
  added_route:      { emoji: '🗺️', verb: 'added a route stop' },
  booked:           { emoji: '✈️', verb: 'booked' },
  sent_sos:         { emoji: '🆘', verb: 'sent an emergency alert' },
  added_todo:       { emoji: '📋', verb: 'added a task' },
};

export function logActivity(tripId, action, subject = null, meta = {}) {
  if (!tripId) return;
  fetch(`${API_BASE}/activity/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ trip_id: tripId, action, subject, meta }),
  }).catch(() => {});
}

export default function ActivityFeed({ tripId, limit = 20, compact = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await fetch(`${API_BASE}/activity/${tripId}?limit=${limit}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Supabase Realtime subscription — new events appear without refresh
  useEffect(() => {
    if (!supabase || !tripId) return;

    const channel = supabase
      .channel(`trip_activity:${tripId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_activity', filter: `trip_id=eq.${tripId}` },
        () => fetchFeed()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId, fetchFeed]);

  if (!tripId) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-0">
        {loading && (
          <p className="text-xs py-2 px-3" style={{ color: '#9ca3af' }}>Loading…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="text-xs py-2 px-3" style={{ color: '#9ca3af' }}>No activity yet.</p>
        )}
        {events.slice(0, 8).map((ev) => {
          const meta = ACTION_META[ev.action] || { emoji: '💬', verb: ev.action };
          const user = ev.users;
          const name = user?.full_name || user?.username || 'Someone';
          const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={ev.id} className="flex items-start gap-2 px-3 py-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
                style={{ background: avatarBg(name) }}
              >
                {user?.profile_picture_url
                  ? <img src={user.profile_picture_url} className="w-6 h-6 rounded-full object-cover" alt={initials} />
                  : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug" style={{ color: '#374151' }}>
                  <span className="font-semibold">{name}</span>{' '}
                  {meta.emoji} {meta.verb}
                  {ev.subject && <span className="font-medium"> "{ev.subject}"</span>}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{timeAgo(ev.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f3f4f6' }}>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#160f29' }}>Group Activity</h3>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Live feed of what your group is doing</p>
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full"
          style={{ background: '#dcfce7', color: '#166534' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <span className="text-3xl">🌱</span>
          <p className="text-sm font-medium" style={{ color: '#374151' }}>No activity yet</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Actions from all group members will appear here.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="divide-y" style={{ borderColor: '#f9fafb' }}>
          {events.map((ev) => {
            const meta = ACTION_META[ev.action] || { emoji: '💬', verb: ev.action };
            const user = ev.users;
            const name = user?.full_name || user?.username || 'Someone';
            const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div key={ev.id} className="flex items-start gap-3 px-5 py-3.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
                  style={{ background: avatarBg(name) }}
                >
                  {user?.profile_picture_url
                    ? <img src={user.profile_picture_url} className="w-8 h-8 object-cover" alt={initials} />
                    : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: '#111827' }}>
                    <span className="font-semibold">{name}</span>{' '}
                    {meta.emoji}{' '}
                    <span style={{ color: '#6b7280' }}>{meta.verb}</span>
                    {ev.subject && (
                      <span className="font-medium" style={{ color: '#183a37' }}> "{ev.subject}"</span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{timeAgo(ev.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
