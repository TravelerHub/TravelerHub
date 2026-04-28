import { useNavigate } from "react-router-dom";
import { ClockIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Widget from "./Widget.jsx";
import { useLiveTrip } from "../../hooks/useLiveTrip";

const TYPE_LABELS = {
  booking: "Booking",
  route: "Route",
  todo: "Todo",
  checklist: "Checklist",
};

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StopRow({ label, evt, accent }) {
  if (!evt) return null;
  return (
    <div className="flex items-start gap-3">
      <div
        className="text-[10px] font-bold uppercase tracking-wider shrink-0 mt-1"
        style={{ color: accent, width: 56 }}
      >
        {label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: "#160f29" }}>
          {evt.title || "Untitled"}
        </div>
        <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: "#5c6b73" }}>
          <ClockIcon style={{ width: 12, height: 12 }} />
          <span>{formatTime(evt.start)}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{TYPE_LABELS[evt.type] || evt.type || "event"}</span>
        </div>
      </div>
    </div>
  );
}

export default function LiveTripWidget({ activeTrip }) {
  const navigate = useNavigate();
  const { isLive, loading, current, next, todayEvents, tripName } = useLiveTrip(activeTrip);

  if (!isLive) return null;

  return (
    <Widget title={`Live · ${tripName || "Trip in progress"}`} style={{ minHeight: 180 }}>
      <button
        type="button"
        onClick={() => navigate("/calendar")}
        className="w-full text-left p-5 flex flex-col gap-4"
        style={{ cursor: "pointer", background: "transparent", border: "none" }}
      >
        {loading && todayEvents.length === 0 ? (
          <div className="text-sm" style={{ color: "#5c6b73" }}>
            Loading today's plan…
          </div>
        ) : todayEvents.length === 0 && !next ? (
          <div className="text-sm" style={{ color: "#5c6b73" }}>
            Nothing scheduled today. Tap to add something to the calendar.
          </div>
        ) : (
          <>
            <StopRow label="Now" evt={current} accent="#16a34a" />
            <StopRow label="Up next" evt={next} accent="#183a37" />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: "#5c6b73" }}>
                {todayEvents.length} event{todayEvents.length === 1 ? "" : "s"} today
              </span>
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "#183a37" }}>
                Open calendar
                <ChevronRightIcon style={{ width: 14, height: 14 }} />
              </span>
            </div>
          </>
        )}
      </button>
    </Widget>
  );
}
