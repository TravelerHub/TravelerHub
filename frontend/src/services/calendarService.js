const API_BASE = 'http://localhost:8000';

export async function getCalendarEvents(tripId = null) {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (tripId) params.append('trip_id', tripId);

  const response = await fetch(`${API_BASE}/calendar/events?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to load calendar events');
  return response.json();
}
