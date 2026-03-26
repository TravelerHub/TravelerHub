import { useNavigate } from "react-router-dom";

const BOOKING_TYPES = [
  { type: "flight",     icon: "✈️", label: "Flight"     },
  { type: "hotel",      icon: "🏨", label: "Hotel"      },
  { type: "car_rental", icon: "🚗", label: "Car Rental" },
  { type: "attraction", icon: "🎡", label: "Activity"   },
];

export default function BookingSummaryWidget({ bookings = [] }) {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
        {BOOKING_TYPES.map(({ type, icon, label }) => {
          const matches = bookings.filter((b) => b.type === type);
          const next    = matches[0];
          const dateRaw = next?.check_in || next?.pickup_datetime || next?.start_date || next?.start_time;
          const dateStr = dateRaw
            ? new Date(dateRaw).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null;

          return (
            <button
              key={type}
              onClick={() => navigate("/booking")}
              className="group flex flex-col gap-2 px-4 py-3 rounded-xl text-left hover:scale-[1.01] active:scale-[0.99] transition-all"
              style={{
                background: next ? "rgba(0,0,0,0.03)"  : "rgba(0,0,0,0.015)",
                border:     `1px solid ${next ? "rgba(0,0,0,0.09)" : "rgba(0,0,0,0.05)"}`,
              }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: next ? "#000000" : "#f3f4f6" }}
                  >
                    {icon}
                  </span>
                  <p className="text-xs font-semibold" style={{ color: "#374151" }}>{label}</p>
                </div>
                {next && (
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: next.status === "confirmed" ? "#000000" : "#f3f4f6",
                      color:      next.status === "confirmed" ? "#ffffff"  : "#6b7280",
                    }}
                  >
                    {next.status || "pending"}
                  </span>
                )}
              </div>

              {/* Detail */}
              {next ? (
                <div>
                  <p className="text-sm font-semibold truncate leading-tight" style={{ color: "#111827" }}>
                    {next.title || next.vendor || next.hotel_name || next.name || label}
                  </p>
                  {dateStr && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#6b7280" }}>
                      📅 {dateStr}
                      {matches.length > 1 && (
                        <span className="ml-1.5 font-medium" style={{ color: "#374151" }}>
                          +{matches.length - 1} more
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                  No upcoming {label.toLowerCase()}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/booking")}
        className="mt-3 shrink-0 text-xs font-medium hover:underline text-left"
        style={{ color: "#374151" }}
      >
        Manage all bookings →
      </button>
    </div>
  );
}
