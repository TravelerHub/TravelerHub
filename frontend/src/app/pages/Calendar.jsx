import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getCalendarEvents } from '../../services/calendarService';
import Navbar_Dashboard from '../../components/navbar/Navbar_dashboard.jsx';
import {
  CalendarDaysIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { SIDEBAR_ITEMS } from '../../constants/sidebarItems.js';

// ── Event type config ─────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  booking:   { label: "Booking",      color: "#16a34a", icon: CalendarDaysIcon, path: "/booking"    },
  route:     { label: "Saved Route",  color: "#2563eb", icon: MapPinIcon,       path: "/navigation" },
  checklist: { label: "Checklist",    color: "#ea580c", icon: CheckCircleIcon,  path: "/todo"       },
};

// ── FullCalendar CSS overrides (scoped to .th-fc) ─────────────────────────────
const FC_STYLES = `
  .th-fc .fc {
    --fc-border-color: #ebebeb;
    --fc-today-bg-color: rgba(24,58,55,0.07);
    --fc-page-bg-color: transparent;
    --fc-neutral-bg-color: #f9fafb;
    --fc-highlight-color: rgba(24,58,55,0.1);
    font-family: inherit;
    font-size: 0.8rem;
  }
  .th-fc .fc-toolbar.fc-header-toolbar {
    margin-bottom: 0.75rem !important;
    align-items: center;
  }
  .th-fc .fc-toolbar-title {
    font-size: 0.95rem !important;
    font-weight: 700 !important;
    color: #160f29 !important;
    letter-spacing: -0.01em;
  }
  .th-fc .fc-button,
  .th-fc .fc-button-primary {
    background: #000 !important;
    border-color: #000 !important;
    font-size: 0.68rem !important;
    padding: 0.22rem 0.6rem !important;
    border-radius: 0.5rem !important;
    text-transform: none !important;
    font-weight: 500 !important;
    box-shadow: none !important;
    letter-spacing: 0;
  }
  .th-fc .fc-button:hover,
  .th-fc .fc-button-primary:hover {
    background: #374151 !important;
    border-color: #374151 !important;
  }
  .th-fc .fc-button-active,
  .th-fc .fc-button-primary:not(:disabled):active {
    background: #183a37 !important;
    border-color: #183a37 !important;
  }
  .th-fc .fc-col-header-cell-cushion {
    font-size: 0.65rem;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 6px 0;
  }
  .th-fc .fc-daygrid-day-number {
    font-size: 0.72rem;
    color: #374151;
    padding: 4px 7px;
    font-weight: 500;
  }
  .th-fc .fc-day-today .fc-daygrid-day-number {
    background: #000;
    color: #fff;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 3px 6px;
    padding: 0;
  }
  .th-fc .fc-timegrid-slot-label-cushion {
    font-size: 0.62rem;
    color: #9ca3af;
  }
  .th-fc .fc-timegrid-now-indicator-line { border-color: #183a37; }
  .th-fc .fc-timegrid-now-indicator-arrow {
    border-top-color: #183a37;
    border-bottom-color: #183a37;
  }
  .th-fc .fc-event {
    border-radius: 4px !important;
    font-size: 0.68rem !important;
    font-weight: 500 !important;
    border: none !important;
    padding: 1px 5px !important;
    cursor: pointer;
  }
  .th-fc .fc-more-link {
    font-size: 0.62rem;
    color: #6b7280;
    font-weight: 600;
  }
  .th-fc .fc-scrollgrid { border-color: #ebebeb !important; }
  .th-fc .fc-scrollgrid td,
  .th-fc .fc-scrollgrid th { border-color: #ebebeb !important; }
  .th-fc .fc-daygrid-day:hover { background: rgba(0,0,0,0.02); }
`;

function CalendarPage() {
  const navigate = useNavigate();

  const stored = localStorage.getItem('user');
  const user   = stored ? JSON.parse(stored) : null;
  const displayName = user?.username || user?.name || 'Traveler';

  const [events,         setEvents]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedEvent,  setSelectedEvent]  = useState(null);
  const [trips,          setTrips]          = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [view,           setView]           = useState('dayGridMonth'); // month | timeGridWeek | timeGridDay

  // ── Fetch trips ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/groups/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setTrips(await res.json());
      } catch (err) {
        console.error('Failed to load trips:', err);
      }
    };
    fetchTrips();
  }, []);

  // ── Fetch calendar events ──────────────────────────────────────────────────
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getCalendarEvents(selectedTripId);
      setEvents(
        data.map((evt) => ({
          id:    evt.id,
          title: evt.title,
          start: evt.start,
          end:   evt.end || undefined,
          backgroundColor: evt.color,
          borderColor:     evt.color,
          extendedProps: { type: evt.type, metadata: evt.metadata },
        }))
      );
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId]);

  // Re-fetch when todos change in another tab or from the Todo page
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'travel_todos') fetchEvents();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId]);

  // ── Upcoming events (next 6, sorted) ──────────────────────────────────────
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 6);
  }, [events]);

  const handleEventClick = (info) => {
    const { event } = info;
    setSelectedEvent({
      id:       event.id,
      title:    event.title,
      start:    event.start,
      end:      event.end,
      type:     event.extendedProps.type,
      metadata: event.extendedProps.metadata,
      color:    event.backgroundColor,
    });
  };

  const handleUpcomingClick = (evt) => {
    setSelectedEvent({
      id:       evt.id,
      title:    evt.title,
      start:    new Date(evt.start),
      end:      evt.end ? new Date(evt.end) : null,
      type:     evt.extendedProps?.type,
      metadata: evt.extendedProps?.metadata,
      color:    evt.backgroundColor,
    });
  };

  // ── View toggle buttons ────────────────────────────────────────────────────
  const VIEW_TABS = [
    { id: 'dayGridMonth',  label: 'Month' },
    { id: 'timeGridWeek',  label: 'Week'  },
    { id: 'timeGridDay',   label: 'Day'   },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>
      <style>{FC_STYLES}</style>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>

        {/* Greeting */}
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>
            Hi,
          </p>
          <p className="font-bold text-lg leading-tight truncate" style={{ color: "#f9fafb" }}>
            {displayName}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive   = item.path === '/calendar';
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={isDisabled}
                className={`
                  w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition
                  ${isActive    ? 'font-bold'          : ''}
                  ${isDisabled  ? 'cursor-not-allowed' : 'hover:bg-white/10'}
                `}
                style={{
                  background: isActive ? '#ffffff' : 'transparent',
                  color:      isActive ? '#000000' : isDisabled ? '#4b5563' : '#9ca3af',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* New trip */}
        <div className="px-3 pb-5">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
            style={{ background: '#374151', color: '#f9fafb' }}
          >
            + New Trip
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-hidden p-4 flex flex-col gap-3" style={{ background: "#f3f4f6" }}>

          {/* ── Top controls bar ────────────────────────────────────────── */}
          <div
            className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
            style={{ background: '#ffffff', border: '1px solid #ebebeb' }}
          >
            {/* Page title */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#000000' }}
              >
                <CalendarDaysIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight" style={{ color: '#160f29' }}>
                  Trip Calendar
                </p>
                <p className="text-[10px] leading-tight" style={{ color: '#9ca3af' }}>
                  Bookings, routes &amp; checklists
                </p>
              </div>
            </div>

            {/* Center: view tabs */}
            <div
              className="flex items-center gap-0.5 rounded-xl p-1"
              style={{ background: '#f3f4f6' }}
            >
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: view === tab.id ? '#000000' : 'transparent',
                    color:      view === tab.id ? '#ffffff' : '#6b7280',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right: legend + trip selector */}
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-3">
                {Object.values(TYPE_CONFIG).map((t) => (
                  <span key={t.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b7280' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    {t.label}
                  </span>
                ))}
              </div>
              <select
                value={selectedTripId || ''}
                onChange={(e) => setSelectedTripId(e.target.value || null)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  color: '#160f29',
                }}
              >
                <option value="">All Trips</option>
                {trips.map((trip) => (
                  <option key={trip.group_id} value={trip.group_id}>
                    {trip.name || trip.group_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Content: calendar + side panel ──────────────────────────── */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div
                className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin"
                style={{ borderColor: '#e5e7eb', borderTopColor: '#000000' }}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex gap-3">

              {/* ── Main calendar panel ──────────────────────────────────── */}
              <div
                className="th-fc flex-1 min-w-0 rounded-2xl overflow-hidden flex flex-col p-5"
                style={{ background: '#ffffff', border: '1px solid #ebebeb' }}
              >
                <FullCalendar
                  key={view}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={view}
                  events={events}
                  eventClick={handleEventClick}
                  headerToolbar={{
                    left:   'prev,next today',
                    center: 'title',
                    right:  '',
                  }}
                  height="100%"
                  eventDisplay="block"
                  dayMaxEvents={3}
                  slotMinTime="06:00:00"
                  slotMaxTime="23:00:00"
                  nowIndicator={true}
                  allDaySlot={true}
                />
              </div>

              {/* ── Right side panel ─────────────────────────────────────── */}
              <div className="w-64 shrink-0 flex flex-col gap-3">

                {/* Today card */}
                <div
                  className="shrink-0 rounded-2xl px-4 py-4"
                  style={{ background: '#000000' }}
                >
                  <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#ffffff' }}>
                    Today
                  </p>
                  <p className="text-2xl font-bold leading-none" style={{ color: '#ffffff' }}>
                    {new Date().getDate()}
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color: '#ffffff' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* Upcoming events */}
                <div
                  className="flex-1 min-h-0 rounded-2xl flex flex-col overflow-hidden"
                  style={{ background: '#ffffff', border: '1px solid #ebebeb' }}
                >
                  <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #ebebeb' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#374151' }}>
                      Upcoming
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
                    {upcomingEvents.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
                        <CalendarDaysIcon className="w-8 h-8" style={{ color: '#e5e7eb' }} />
                        <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
                          No upcoming events
                        </p>
                      </div>
                    ) : (
                      upcomingEvents.map((evt) => {
                        const cfg  = TYPE_CONFIG[evt.extendedProps?.type] || {};
                        const Icon = cfg.icon || CalendarDaysIcon;
                        const d    = new Date(evt.start);
                        return (
                          <button
                            key={evt.id}
                            onClick={() => handleUpcomingClick(evt)}
                            className="group w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)' }}
                          >
                            {/* Color dot */}
                            <span
                              className="mt-0.5 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center"
                              style={{ background: (evt.backgroundColor || '#374151') + '22' }}
                            >
                              <Icon
                                className="w-3.5 h-3.5"
                                style={{ color: evt.backgroundColor || '#374151' }}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold truncate" style={{ color: '#160f29' }}>
                                {evt.title}
                              </p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
                                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' · '}
                                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>

                            <ChevronRightIcon
                              className="w-3.5 h-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-40 transition-opacity"
                              style={{ color: '#374151' }}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Legend card */}
                <div
                  className="shrink-0 rounded-2xl px-4 py-3 flex flex-col gap-2"
                  style={{ background: '#ffffff', border: '1px solid #ebebeb' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#374151' }}>
                    Legend
                  </p>
                  {Object.values(TYPE_CONFIG).map((t) => (
                    <span key={t.label} className="flex items-center gap-2 text-xs" style={{ color: '#5c6b73' }}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══ EVENT DETAIL MODAL ═══════════════════════════════════════════════ */}
      {selectedEvent && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            style={{ background: '#fbfbf2' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ background: '#000000' }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: (selectedEvent.color || '#374151') + '33',
                    color:       selectedEvent.color  || '#9ca3af',
                  }}
                >
                  {(() => {
                    const Icon = TYPE_CONFIG[selectedEvent.type]?.icon || CalendarDaysIcon;
                    return <Icon className="w-4 h-4" />;
                  })()}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9ca3af' }}>
                  {TYPE_CONFIG[selectedEvent.type]?.label || selectedEvent.type || 'Event'}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-3">
              <h3 className="text-base font-bold" style={{ color: '#160f29' }}>
                {selectedEvent.title}
              </h3>

              {selectedEvent.start && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#5c6b73' }}>
                  <ClockIcon className="w-4 h-4 shrink-0" />
                  <span>
                    {new Date(selectedEvent.start).toLocaleString()}
                    {selectedEvent.end && (
                      <> — {new Date(selectedEvent.end).toLocaleString()}</>
                    )}
                  </span>
                </div>
              )}

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  {Object.entries(selectedEvent.metadata).map(([key, value]) => {
                    if (value === null || value === undefined) return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div key={key} className="flex justify-between gap-4 text-xs">
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span className="font-semibold truncate" style={{ color: '#160f29' }}>
                          {String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-2">
              {TYPE_CONFIG[selectedEvent.type]?.path && (
                <button
                  onClick={() => {
                    navigate(TYPE_CONFIG[selectedEvent.type].path);
                    setSelectedEvent(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80 active:scale-95 flex items-center justify-center gap-1.5"
                  style={{
                    background: TYPE_CONFIG[selectedEvent.type].color,
                    color: '#ffffff',
                  }}
                >
                  {selectedEvent.type === 'booking'   && '📋 Open Bookings'}
                  {selectedEvent.type === 'checklist' && '✅ Open To-Do'}
                  {selectedEvent.type === 'route'     && '🗺️ Open Navigation'}
                </button>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
                style={{ background: '#000000', color: '#f9fafb' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarPage;
