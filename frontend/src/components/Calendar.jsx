import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarApp() {

  // Load saved events (like your getEvents)
  const getEvents = () => {
    return JSON.parse(localStorage.getItem("events") || "[]");
  };

  const saveEvents = (events) => {
    localStorage.setItem("events", JSON.stringify(events));
  };

  const saveEvent = (event) => {
    let events = getEvents();
    events.push(event);
    saveEvents(events);
    setEvents(events);
  };

  const [events, setEvents] = useState(getEvents());

  // Ask permission once
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Safe reminder checker (same logic as yours)
  const checkReminders = () => {
    let events = getEvents();
    let now = new Date();
    let updated = false;

    events.forEach(event => {
      if (!event.start) return;

      let eventTime = new Date(event.start);
      let diff = eventTime - now;

      if (diff > 0 && diff < 300000 && !event.reminded) {
        new Notification("Reminder: " + event.title);
        event.reminded = true;
        updated = true;
      }
    });

    if (updated) {
      saveEvents(events);
      setEvents(events);
    }
  };

  // run interval like your original
  useEffect(() => {
    const interval = setInterval(checkReminders, 50000);
    return () => clearInterval(interval);
  }, []);

  // Delete event (same structure)
  const ridEvent = (info) => {
    let events = getEvents();
    let deleteI = prompt("Do you want to delete an event?(Yes/No)");

    if (deleteI === "Yes") {

      events = events.filter(event =>
        !(
          event.title === info.event.title &&
          event.start === info.event.startStr
        )
      );

      saveEvents(events);
      setEvents(events);

      info.event.remove();
    }
  };

  // Add event
  const handleDateClick = (info) => {

    let title = prompt("Enter Event Title");
    if (!title) return;

    let time = prompt("Enter Time (HH:MM, 24hr format)", "12:00");

    let eventDate = info.dateStr + "T" + time;

    let newEvent = {
      title: title,
      start: eventDate,
      reminded: false
    };

    saveEvent(newEvent);
  };

  return (
    <div style={{ display: "flex", gap: "40px" }}>

      <div style={{ width: "50%" }}>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          dateClick={handleDateClick}
          eventClick={ridEvent}
        />
      </div>

      <div style={{ width: "50%" }}>
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          events={events}
          dateClick={handleDateClick}
          eventClick={ridEvent}
        />
      </div>

    </div>
  );
}
