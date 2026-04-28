import { useEffect, useMemo, useState } from "react";
import { getCalendarEvents } from "../services/calendarService";

const ONE_MIN = 60 * 1000;

const todayISODate = () => new Date().toISOString().slice(0, 10);

function inDateRange(today, start, end) {
  if (!start) return false;
  const s = String(start).slice(0, 10);
  const e = end ? String(end).slice(0, 10) : s;
  return today >= s && today <= e;
}

function pickTodayAndUpcoming(events, now) {
  const todayKey = todayISODate();
  const todayEvents = [];
  let nextFutureEvent = null;

  for (const evt of events) {
    if (!evt?.start) continue;
    const startMs = new Date(evt.start).getTime();
    if (Number.isNaN(startMs)) continue;

    if (String(evt.start).slice(0, 10) === todayKey) {
      todayEvents.push({ ...evt, _startMs: startMs });
    } else if (startMs > now && (!nextFutureEvent || startMs < nextFutureEvent._startMs)) {
      nextFutureEvent = { ...evt, _startMs: startMs };
    }
  }

  todayEvents.sort((a, b) => a._startMs - b._startMs);

  let current = null;
  let next = null;
  for (const evt of todayEvents) {
    if (evt._startMs <= now) {
      current = evt;
    } else if (!next) {
      next = evt;
      break;
    }
  }
  if (!next && nextFutureEvent) next = nextFutureEvent;

  return { current, next, todayEvents };
}

export function useLiveTrip(activeTrip) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const tripId = activeTrip?.group_id || activeTrip?.id || null;
  const start = activeTrip?.start_date;
  const end = activeTrip?.end_date;

  const isLive = useMemo(
    () => inDateRange(todayISODate(), start, end),
    [start, end]
  );

  useEffect(() => {
    if (!isLive || !tripId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCalendarEvents(tripId)
      .then((rows) => {
        if (!cancelled) setEvents(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isLive, tripId]);

  // Tick every minute so "current → next" rolls over without a manual refresh.
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setNow(Date.now()), ONE_MIN);
    return () => clearInterval(id);
  }, [isLive]);

  const { current, next, todayEvents } = useMemo(
    () => (isLive ? pickTodayAndUpcoming(events, now) : { current: null, next: null, todayEvents: [] }),
    [isLive, events, now]
  );

  return {
    isLive,
    loading,
    current,
    next,
    todayEvents,
    tripId,
    tripName: activeTrip?.name || activeTrip?.trip_name || "",
  };
}
