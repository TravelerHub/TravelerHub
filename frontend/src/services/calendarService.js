import { API_BASE } from '../config';

const TODO_STORAGE_KEY = 'travel_todos';

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function safeJson(res) {
  return res.ok ? res.json().catch(() => []) : Promise.resolve([]);
}

// ── Source fetchers ───────────────────────────────────────────────────────────

/** Todos with a due date from localStorage → checklist events */
function getTodoEvents() {
  try {
    const todos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    return todos
      .filter((t) => t.dueDate && !t.done)
      .map((t) => ({
        id:    `todo_${t.id}`,
        title: t.text,
        start: t.dueDate,         // date-only string → all-day in FullCalendar
        end:   undefined,
        type:  'checklist',
        color: '#ea580c',
        metadata: {
          priority: t.priority,
          category: t.category,
          status:   'pending',
        },
      }));
  } catch {
    return [];
  }
}

/** Bookings from the backend API → booking events */
async function getBookingEvents(tripId) {
  try {
    const params = new URLSearchParams();
    if (tripId) params.append('trip_id', tripId);
    const res = await fetch(`${API_BASE}/api/bookings?${params}`, {
      headers: authHeaders(),
    });
    const data = await safeJson(res);
    const bookings = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

    return bookings
      .filter((b) => b.start_time || b.check_in || b.pickup_datetime)
      .map((b) => {
        const start = b.start_time || b.check_in || b.pickup_datetime;
        const end   = b.end_time   || b.check_out || b.dropoff_datetime || undefined;
        const typeIcons = {
          hotel: '🏨', flight: '✈️', car: '🚗', car_rental: '🚗',
          activity: '🎡', attraction: '🎡',
        };
        const icon = typeIcons[b.type] || '📋';
        return {
          id:    `booking_${b.id}`,
          title: `${icon} ${b.title || b.vendor || 'Booking'}`,
          start,
          end,
          type:  'booking',
          color: '#16a34a',
          metadata: {
            type:   b.type?.replace('_', ' '),
            vendor: b.vendor,
            status: b.status,
            cost:   b.cost != null ? `${b.currency || 'USD'} ${b.cost}` : undefined,
            confirmation: b.confirmation_code || b.external_ref || undefined,
          },
        };
      });
  } catch {
    return [];
  }
}

/** Saved routes from the backend API → route events (shown on created_at date) */
async function getRouteEvents() {
  try {
    const res = await fetch(`${API_BASE}/routes/`, { headers: authHeaders() });
    const data = await safeJson(res);
    const routes = Array.isArray(data) ? data : [];

    return routes.map((r) => ({
      id:    `route_${r.id}`,
      title: `🗺️ ${r.name || 'Saved Route'}`,
      start: r.created_at,
      end:   undefined,
      type:  'route',
      color: '#2563eb',
      metadata: {
        distance: r.total_distance != null
          ? `${(r.total_distance / 1000).toFixed(1)} km`
          : undefined,
        duration: r.total_duration != null
          ? formatDuration(r.total_duration)
          : undefined,
        waypoints: Array.isArray(r.waypoints)
          ? `${r.waypoints.length} stops`
          : undefined,
        saved: r.created_at
          ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : undefined,
      },
    }));
  } catch {
    return [];
  }
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch all calendar events from every source in parallel:
 *   - Todos with a due date (localStorage)
 *   - Bookings (backend API)
 *   - Saved routes (backend API)
 *
 * Falls back gracefully if any source fails.
 */
export async function getCalendarEvents(tripId = null) {
  const [todoEvents, bookingEvents, routeEvents] = await Promise.all([
    Promise.resolve(getTodoEvents()),
    getBookingEvents(tripId),
    getRouteEvents(),
  ]);

  return [...bookingEvents, ...todoEvents, ...routeEvents];
}
