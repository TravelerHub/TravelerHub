import { useState } from "react";
import { apiFetch } from "../services/api.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PlanDayModal({ open, onClose, lat, lng, locationLabel }) {
  const [date, setDate] = useState(todayISO);
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(8);
  const [radius, setRadius] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  if (!open) return null;

  const handleBuild = async () => {
    setError("");
    setLoading(true);
    setPlan(null);
    try {
      const data = await apiFetch("/itinerary/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          date,
          start_time: startTime,
          duration_hours: Number(duration),
          radius_km: Number(radius),
        }),
      });
      setPlan(data);
    } catch (err) {
      setError(err.message || "Failed to build itinerary");
    } finally {
      setLoading(false);
    }
  };

  const stops = plan?.stops || [];

  return (
    <div
      role="dialog"
      aria-labelledby="plan-day-title"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(22,15,41,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 80, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fbfbf2", borderRadius: 16, width: "100%",
          maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 id="plan-day-title" style={{ margin: 0, color: "#160f29", fontSize: 20, fontWeight: 700 }}>
              Plan a day
            </h2>
            {locationLabel && (
              <div style={{ color: "#5c6b73", fontSize: 13, marginTop: 4 }}>{locationLabel}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 22, color: "#5c6b73", cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {!plan && (
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Start time">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Duration (hours)">
              <input
                type="number" min={1} max={16} value={duration}
                onChange={(e) => setDuration(e.target.value)} style={inputStyle}
              />
            </Field>
            <Field label="Search radius (km)">
              <input
                type="number" min={1} max={25} value={radius}
                onChange={(e) => setRadius(e.target.value)} style={inputStyle}
              />
            </Field>

            {error && (
              <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>
            )}

            <button
              type="button"
              onClick={handleBuild}
              disabled={loading}
              style={{
                marginTop: 8, padding: "10px 16px", background: "#183a37",
                color: "#fbfbf2", border: "none", borderRadius: 10, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Building plan…" : "Build my day"}
            </button>
            <p style={{ fontSize: 12, color: "#5c6b73", marginTop: 4 }}>
              No AI required — uses OpenStreetMap data and a deterministic
              ranker that picks a varied, walkable mix of attractions.
            </p>
          </div>
        )}

        {plan && (
          <div style={{ display: "grid", gap: 12 }}>
            {plan.warning && (
              <div style={{ color: "#b45309", fontSize: 13 }}>{plan.warning}</div>
            )}
            {stops.length === 0 ? (
              <div style={{ color: "#5c6b73" }}>
                No attractions found in this area. Try increasing the radius
                or picking a different start point.
              </div>
            ) : (
              stops.map((s, i) => (
                <div
                  key={`${s.place_id || s.name}-${i}`}
                  style={{
                    display: "flex", gap: 12, padding: 12, borderRadius: 10,
                    background: "#fff", border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ minWidth: 64, color: "#183a37", fontWeight: 700 }}>
                    {s.arrival}
                    <div style={{ fontSize: 11, fontWeight: 400, color: "#5c6b73" }}>
                      {s.dwell_minutes} min
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "#160f29" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#5c6b73", textTransform: "capitalize" }}>
                      {String(s.place_type).replace(/_/g, " ")}
                      {s.distance_km_from_prev > 0
                        ? ` · ${s.distance_km_from_prev.toFixed(1)} km walk (${s.walking_minutes_from_prev} min)`
                        : ""}
                    </div>
                    {s.address && (
                      <div style={{ fontSize: 12, color: "#5c6b73", marginTop: 4 }}>{s.address}</div>
                    )}
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => setPlan(null)}
              style={{
                marginTop: 4, padding: "8px 14px", background: "transparent",
                color: "#183a37", border: "1px solid #183a37", borderRadius: 8,
                fontWeight: 500, cursor: "pointer",
              }}
            >
              Adjust settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 14, background: "#fff",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13, color: "#5c6b73", marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
