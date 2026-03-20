import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getCalendarEvents } from '../../services/calendarService';

import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

function Calendar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);

  // Load trips for the selector
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/groups/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTrips(data);
        }
      } catch (err) {
        console.error('Failed to load trips:', err);
      }
    };
    fetchTrips();
  }, []);

  // Load calendar events
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const data = await getCalendarEvents(selectedTripId);
        // Map backend events to FullCalendar format
        const mapped = data.map(evt => ({
          id: evt.id,
          title: evt.title,
          start: evt.start,
          end: evt.end || undefined,
          backgroundColor: evt.color,
          borderColor: evt.color,
          extendedProps: {
            type: evt.type,
            metadata: evt.metadata,
          },
        }));
        setEvents(mapped);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [selectedTripId]);

  const handleEventClick = (info) => {
    const { event } = info;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      type: event.extendedProps.type,
      metadata: event.extendedProps.metadata,
      color: event.backgroundColor,
    });
  };

  const typeLabels = {
    booking: 'Booking',
    route: 'Saved Route',
    checklist: 'Checklist',
  };

  const typeIcons = {
    booking: <CalendarDaysIcon className="w-5 h-5" />,
    route: <MapPinIcon className="w-5 h-5" />,
    checklist: <CheckCircleIcon className="w-5 h-5" />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="w-7 h-7 text-blue-600" />
              Trip Calendar
            </h1>
          </div>

          {/* Trip selector */}
          <select
            value={selectedTripId || ''}
            onChange={(e) => setSelectedTripId(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Trips</option>
            {trips.map(trip => (
              <option key={trip.group_id} value={trip.group_id}>
                {trip.name || trip.group_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            Bookings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Routes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            Checklists
          </span>
        </div>
      </div>

      {/* Calendar — dual layout like teammate's concept */}
      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex gap-6 flex-col lg:flex-row">
            {/* Calendar 1: Month view */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={events}
                eventClick={handleEventClick}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: '',
                }}
                height="auto"
                eventDisplay="block"
                dayMaxEvents={3}
              />
            </div>

            {/* Calendar 2: Week/Agenda view */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <FullCalendar
                plugins={[timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                events={events}
                eventClick={handleEventClick}
                headerToolbar={{
                  left: 'prev,next',
                  center: 'title',
                  right: 'timeGridWeek,timeGridDay',
                }}
                height="auto"
                slotMinTime="06:00:00"
                slotMaxTime="23:00:00"
                allDaySlot={true}
                nowIndicator={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            {/* Modal header */}
            <div
              className="px-6 py-4 rounded-t-xl flex items-center justify-between"
              style={{ backgroundColor: selectedEvent.color + '20', borderBottom: `2px solid ${selectedEvent.color}` }}
            >
              <div className="flex items-center gap-2" style={{ color: selectedEvent.color }}>
                {typeIcons[selectedEvent.type]}
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {typeLabels[selectedEvent.type] || selectedEvent.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 hover:bg-gray-200 rounded-lg transition"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 space-y-3">
              <h3 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h3>

              {selectedEvent.start && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ClockIcon className="w-4 h-4" />
                  {new Date(selectedEvent.start).toLocaleString()}
                  {selectedEvent.end && (
                    <> — {new Date(selectedEvent.end).toLocaleString()}</>
                  )}
                </div>
              )}

              {/* Metadata */}
              {selectedEvent.metadata && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                  {Object.entries(selectedEvent.metadata).map(([key, value]) => {
                    if (value === null || value === undefined) return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition text-sm"
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

export default Calendar;
