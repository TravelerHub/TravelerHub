import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import Navbar_Dashboard from '../../components/navbar/Navbar_dashboard.jsx';
import AppSidebar from '../../components/navbar/AppSidebar.jsx';
import { BellQuiet } from '../../components/icons/StateIcons.jsx';

const TYPE_ICONS = {
  vote: '🗳️',
  expense: '💸',
  invite: '✉️',
  join: '👋',
  default: '🔔',
};

function groupByDate(notifications) {
  const groups = {};
  for (const n of notifications) {
    const date = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(n);
  }
  return groups;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    apiFetch('/notifications')
      .then(data => setNotifications(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const groups = groupByDate(notifications);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#160f29" }}>
      <AppSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard onMenuClick={() => setMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:py-8 pb-24 md:pb-8 text-white">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Notifications</h1>
              {notifications.some(n => !n.read) && (
                <button
                  onClick={markAllRead}
                  className="text-sm text-[#c8a96e] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && (
              <div className="text-center text-white/40 py-20">Loading...</div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-20">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(200,169,110,0.15)" }}
                >
                  <BellQuiet size={44} color="#c8a96e" accent="#fbfbf2" />
                </div>
                <p className="text-white/70 font-semibold">All caught up</p>
                <p className="text-white/40 text-sm mt-1">New activity will land here.</p>
              </div>
            )}

            {Object.entries(groups).map(([date, items]) => (
              <div key={date} className="mb-6">
                <p className="text-white/40 text-xs uppercase tracking-wider mb-3">{date}</p>
                <div className="space-y-2">
                  {items.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        n.read
                          ? 'border-[#183a37]/30 bg-[#183a37]/10'
                          : 'border-[#c8a96e]/20 bg-[#183a37]/40'
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">{TYPE_ICONS[n.type] || TYPE_ICONS.default}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">{n.title}</p>
                        <p className="text-white/60 text-xs mt-0.5">{n.body}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-[#c8a96e] flex-shrink-0 mt-1.5" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
