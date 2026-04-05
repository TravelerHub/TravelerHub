import { useState } from "react";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function MiniCalendar({ events = [] }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (d) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year  === today.getFullYear();

  const hasEvent = (d) =>
    events.some((e) => {
      const ed = new Date(e.date || e.start_date || e.check_in);
      return (
        ed.getDate()     === d &&
        ed.getMonth()    === month &&
        ed.getFullYear() === year
      );
    });

  return (
    <div className="h-full flex flex-col select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prev}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 transition text-gray-400 hover:text-gray-700 text-lg leading-none"
        >
          ‹
        </button>
        <span className="font-semibold text-sm tracking-wide" style={{ color: "#160f29" }}>
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={next}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 transition text-gray-400 hover:text-gray-700 text-lg leading-none"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-gray-300 text-xs py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5 flex-1 content-start">
        {cells.map((d, i) => (
          <div
            key={i}
            className={`
              text-center text-xs py-1.5 rounded-md transition
              ${d === null ? "" :
                isToday(d)
                  ? "font-bold"
                  : hasEvent(d)
                  ? "font-semibold text-gray-800 underline decoration-dotted"
                  : "text-gray-500 hover:text-gray-800 hover:bg-black/5 cursor-default"
              }
            `}
            style={d && isToday(d) ? { background: "#000000", color: "#ffffff" } : {}}
          >
            {d ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
