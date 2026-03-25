import { useEffect, useMemo, useState } from "react";

/**
 * Booking.jsx
 * ---------------------------------------------------------
 * Booking management page with Booking.com API search integration.
 *
 * The header now has three action buttons instead of "+ New booking":
 *   🏨 Hotels     → opens hotel search modal (city, dates, guests)
 *   🚗 Car Rentals → opens car search modal (airport, dates, driver age)
 *   🎡 Tours      → opens attractions/tours search modal (city, dates)
 *
 * Search results call the backend Booking.com proxy endpoints.
 * A "Save" button on each result record opens the Create modal pre-filled.
 *
 * The manual Create/Edit CRUD still works underneath (via the Edit button
 * on existing bookings or by saving a search result).
 */

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  title: "",
  vendor: "",
  type: "hotel",
  start_time: "",
  end_time: "",
  confirmation_code: "",
  cost: "",
  currency: "USD",
  notes: "",
};

const SEED_BOOKINGS = [
  {
    id: "b1",
    trip_id: "t1",
    title: "Marriott Downtown SF",
    vendor: "Marriott",
    type: "hotel",
    start_time: "2026-02-20T20:00:00.000Z",
    end_time: "2026-02-23T18:00:00.000Z",
    confirmation_code: "MARR-29384",
    cost: 645.5,
    currency: "USD",
    notes: "Check-in after 3pm. Parking is expensive.",
    status: "active",
    created_by: "u1",
    created_at: "2026-02-10T00:00:00.000Z",
    updated_at: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "b2",
    trip_id: "t1",
    title: "United UA 123 (LAX → SFO)",
    vendor: "United",
    type: "flight",
    start_time: "2026-02-20T17:30:00.000Z",
    end_time: "2026-02-20T19:00:00.000Z",
    confirmation_code: "UA-ABC123",
    cost: 179.99,
    currency: "USD",
    notes: "Seat 12A. Bag drop closes 45 mins before departure.",
    status: "active",
    created_by: "u1",
    created_at: "2026-02-11T00:00:00.000Z",
    updated_at: "2026-02-11T00:00:00.000Z",
  },
  {
    id: "b3",
    trip_id: "t1",
    title: "Hertz Car Rental (SFO)",
    vendor: "Hertz",
    type: "car",
    start_time: "2026-02-20T20:15:00.000Z",
    end_time: "2026-02-23T17:00:00.000Z",
    confirmation_code: "HZ-77819",
    cost: 230,
    currency: "USD",
    notes: "Pick up at Terminal 2.",
    status: "cancelled",
    created_by: "u1",
    created_at: "2026-02-12T00:00:00.000Z",
    updated_at: "2026-02-13T00:00:00.000Z",
  },
];

const API_BASE = "http://127.0.0.1:8000";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function uid() {
  return `b_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

async function apiFetch(path) {
  const token = localStorage.getItem("access_token");
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await resp.json();
  return json;
}

// ──────────────────────────────────────────────────────────────────────────────
// Small UI components
// ──────────────────────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const label = status || "active";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        fontSize: 12,
        background: label === "cancelled" ? "#fff5f5" : "#f6ffed",
      }}
    >
      {label}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ borderRadius: 10, padding: "6px 10px" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, color: "#444" }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = { padding: 10, borderRadius: 12, border: "1px solid #ddd", width: "100%" };

// ──────────────────────────────────────────────────────────────────────────────
// Search modal — Hotels
// ──────────────────────────────────────────────────────────────────────────────

function HotelSearchModal({ open, onClose, onSave }) {
  const [city, setCity] = useState("Los Angeles");
  const [checkin, setCheckin] = useState("2026-08-01");
  const [checkout, setCheckout] = useState("2026-08-03");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true);
    setErr("");
    setResults([]);
    try {
      // 1. resolve city → id
      const cityRes = await apiFetch(`/api/bookings/hotels/city?name=${encodeURIComponent(city)}`);
      if (cityRes.error || !cityRes.data?.length) {
        setErr(cityRes.error || "City not found");
        return;
      }
      const cityId = cityRes.data[0].city_id ?? cityRes.data[0].id ?? cityRes.data[0].dest_id;
      // 2. search hotels
      const hotelsRes = await apiFetch(
        `/api/bookings/hotels/search?city_id=${cityId}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`
      );
      if (hotelsRes.error) { setErr(hotelsRes.error); return; }
      setResults(hotelsRes.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal open={open} title="🏨 Search Hotels" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="City">
          <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Check-in">
          <input type="date" style={inputStyle} value={checkin} onChange={(e) => setCheckin(e.target.value)} />
        </Field>
        <Field label="Check-out">
          <input type="date" style={inputStyle} value={checkout} onChange={(e) => setCheckout(e.target.value)} />
        </Field>
        <Field label="Adults">
          <input type="number" min={1} style={inputStyle} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
        </Field>
        <Field label="Rooms">
          <input type="number" min={1} style={inputStyle} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
        </Field>
      </div>
      <button
        onClick={search}
        disabled={searching}
        style={{ padding: "10px 20px", borderRadius: 12, background: "black", color: "white", marginBottom: 16 }}
      >
        {searching ? "Searching…" : "Search"}
      </button>
      {err && <div style={{ color: "#b00020", marginBottom: 12 }}>{err}</div>}
      {results.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {results.map((h, i) => {
            const name = h.name || h.hotel_name || `Hotel ${i + 1}`;
            const price = h.min_total_price ?? h.price ?? h.composite_price_breakdown?.gross_amount?.value;
            return (
              <div key={h.hotel_id ?? h.id ?? i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{name}</div>
                  {price != null && <div style={{ fontSize: 13, color: "#444" }}>From ${Number(price).toFixed(2)}</div>}
                </div>
                <button
                  onClick={() => onSave({ title: name, vendor: name, type: "hotel", cost: price ?? "", start_time: checkin, end_time: checkout })}
                  style={{ padding: "8px 14px", borderRadius: 10, background: "black", color: "white", whiteSpace: "nowrap" }}
                >
                  + Save
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!searching && results.length === 0 && !err && (
        <div style={{ color: "#888", fontSize: 13 }}>Enter a city and click Search to see results.</div>
      )}
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Search modal — Car Rentals
// ──────────────────────────────────────────────────────────────────────────────

function CarSearchModal({ open, onClose, onSave }) {
  const [airport, setAirport] = useState("LAX");
  const [pickup, setPickup] = useState("2026-08-01T10:00");
  const [dropoff, setDropoff] = useState("2026-08-08T10:00");
  const [driverAge, setDriverAge] = useState(25);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true);
    setErr("");
    setResults([]);
    try {
      const pickupIso = pickup.length === 16 ? `${pickup}:00` : pickup;
      const dropoffIso = dropoff.length === 16 ? `${dropoff}:00` : dropoff;
      const res = await apiFetch(
        `/api/bookings/cars/search?airport=${airport}&pickup=${encodeURIComponent(pickupIso)}&dropoff=${encodeURIComponent(dropoffIso)}&driver_age=${driverAge}`
      );
      if (res.error) { setErr(res.error); return; }
      setResults(res.data || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal open={open} title="🚗 Search Car Rentals" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="Airport (IATA)">
          <input style={inputStyle} value={airport} onChange={(e) => setAirport(e.target.value.toUpperCase())} placeholder="LAX" />
        </Field>
        <Field label="Pick-up datetime">
          <input type="datetime-local" style={inputStyle} value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </Field>
        <Field label="Drop-off datetime">
          <input type="datetime-local" style={inputStyle} value={dropoff} onChange={(e) => setDropoff(e.target.value)} />
        </Field>
        <Field label="Driver age">
          <input type="number" min={18} style={inputStyle} value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} />
        </Field>
      </div>
      <button
        onClick={search}
        disabled={searching}
        style={{ padding: "10px 20px", borderRadius: 12, background: "black", color: "white", marginBottom: 16 }}
      >
        {searching ? "Searching…" : "Search"}
      </button>
      {err && <div style={{ color: "#b00020", marginBottom: 12 }}>{err}</div>}
      {results.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {results.map((c, i) => {
            const name = c.vehicle?.name ?? c.car_name ?? c.name ?? `Car ${i + 1}`;
            const vendor = c.vendor?.name ?? c.supplier_name ?? "";
            const price = c.price?.amount ?? c.total_price ?? c.base_price;
            return (
              <div key={c.id ?? c.car_id ?? i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{name}</div>
                  {vendor && <div style={{ fontSize: 13, color: "#666" }}>{vendor}</div>}
                  {price != null && <div style={{ fontSize: 13, color: "#444" }}>From ${Number(price).toFixed(2)}</div>}
                </div>
                <button
                  onClick={() => onSave({ title: `${name}${vendor ? ` — ${vendor}` : ""}`, vendor, type: "car", cost: price ?? "", start_time: pickup, end_time: dropoff })}
                  style={{ padding: "8px 14px", borderRadius: 10, background: "black", color: "white", whiteSpace: "nowrap" }}
                >
                  + Save
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!searching && results.length === 0 && !err && (
        <div style={{ color: "#888", fontSize: 13 }}>Enter airport code and dates, then click Search.</div>
      )}
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Search modal — Tours / Attractions
// ──────────────────────────────────────────────────────────────────────────────

function ToursSearchModal({ open, onClose, onSave }) {
  const [city, setCity] = useState("Los Angeles");
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-07");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true);
    setErr("");
    setResults([]);
    try {
      // resolve city → id via hotels city endpoint (same city IDs)
      const cityRes = await apiFetch(`/api/bookings/hotels/city?name=${encodeURIComponent(city)}`);
      if (cityRes.error || !cityRes.data?.length) {
        setErr(cityRes.error || "City not found");
        return;
      }
      const cityId = cityRes.data[0].city_id ?? cityRes.data[0].id ?? cityRes.data[0].dest_id;
      const res = await apiFetch(
        `/api/bookings/attractions/search?city_id=${cityId}&start_date=${startDate}&end_date=${endDate}`
      );
      if (res.error && res.data?.length === 0) {
        setErr(res.error);
        return;
      }
      setResults(res.data || []);
      if (res.error) setErr(res.error);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal open={open} title="🎡 Search Tours & Attractions" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="City">
          <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Start date">
          <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <input type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <button
        onClick={search}
        disabled={searching}
        style={{ padding: "10px 20px", borderRadius: 12, background: "black", color: "white", marginBottom: 16 }}
      >
        {searching ? "Searching…" : "Search"}
      </button>
      {err && <div style={{ color: "#b00020", marginBottom: 12 }}>{err}</div>}
      {results.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {results.map((a, i) => {
            const name = a.name ?? a.title ?? `Attraction ${i + 1}`;
            const price = a.price?.amount ?? a.min_price ?? a.from_price;
            return (
              <div key={a.id ?? a.attraction_id ?? i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{name}</div>
                  {price != null && <div style={{ fontSize: 13, color: "#444" }}>From ${Number(price).toFixed(2)}</div>}
                </div>
                <button
                  onClick={() => onSave({ title: name, vendor: "", type: "activity", cost: price ?? "", start_time: startDate, end_time: endDate })}
                  style={{ padding: "8px 14px", borderRadius: 10, background: "black", color: "white", whiteSpace: "nowrap" }}
                >
                  + Save
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!searching && results.length === 0 && !err && (
        <div style={{ color: "#888", fontSize: 13 }}>Enter a city and dates, then click Search.</div>
      )}
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Booking page
// ──────────────────────────────────────────────────────────────────────────────

export default function Booking({ tripId: tripIdProp }) {
  const tripId = tripIdProp || "t1";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [bookings, setBookings] = useState([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Search modals
  const [hotelSearchOpen, setHotelSearchOpen] = useState(false);
  const [carSearchOpen, setCarSearchOpen] = useState(false);
  const [toursSearchOpen, setToursSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => b.trip_id === tripId)
      .filter((b) => {
        if (statusFilter !== "all" && (b.status || "active") !== statusFilter) return false;
        if (typeFilter !== "all" && (b.type || "other") !== typeFilter) return false;
        if (!q) return true;
        const hay = [b.title, b.vendor, b.type, b.confirmation_code, b.notes, b.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
        const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
        return tb - ta;
      });
  }, [bookings, query, statusFilter, typeFilter, tripId]);

  function load() {
    setLoading(true);
    setErr("");
    try {
      setBookings(SEED_BOOKINGS);
    } catch (e) {
      setErr(e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  function openCreate(prefill = {}) {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, ...prefill });
    setModalOpen(true);
  }

  function openEdit(b) {
    setEditing(b);
    setForm({
      title: b.title ?? "",
      vendor: b.vendor ?? "",
      type: b.type ?? "other",
      start_time: toInputDateTime(b.start_time),
      end_time: toInputDateTime(b.end_time),
      confirmation_code: b.confirmation_code ?? "",
      cost: b.cost != null ? String(b.cost) : "",
      currency: b.currency ?? "USD",
      notes: b.notes ?? "",
    });
    setModalOpen(true);
  }

  function validateForm() {
    if (!form.title.trim()) return "Title is required";
    if (!form.type) return "Type is required";
    const start = fromInputDateTime(form.start_time);
    const end = fromInputDateTime(form.end_time);
    if (start && end && new Date(end).getTime() < new Date(start).getTime())
      return "End time cannot be earlier than start time";
    if (form.cost && Number.isNaN(Number(form.cost))) return "Cost must be a number";
    return "";
  }

  async function submit() {
    const v = validateForm();
    if (v) { setErr(v); return; }
    setLoading(true);
    setErr("");
    try {
      const now = new Date().toISOString();
      const payload = {
        trip_id: tripId,
        title: form.title.trim(),
        vendor: form.vendor.trim() || null,
        type: form.type,
        start_time: fromInputDateTime(form.start_time),
        end_time: fromInputDateTime(form.end_time),
        confirmation_code: form.confirmation_code.trim() || null,
        cost: form.cost === "" ? null : Number(form.cost),
        currency: form.currency || "USD",
        notes: form.notes.trim() || null,
      };
      if (editing?.id) {
        setBookings((prev) =>
          prev.map((b) => (b.id === editing.id ? { ...b, ...payload, updated_at: now } : b))
        );
      } else {
        setBookings((prev) => [{ id: uid(), status: "active", created_by: "u1", created_at: now, updated_at: now, ...payload }, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
      setForm(DEFAULT_FORM);
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  function askCancel(b) { setConfirmAction({ kind: "cancel", booking: b }); setConfirmOpen(true); }
  function askDelete(b) { setConfirmAction({ kind: "delete", booking: b }); setConfirmOpen(true); }

  async function doConfirm() {
    if (!confirmAction) return;
    const { kind, booking } = confirmAction;
    setLoading(true);
    setErr("");
    try {
      const now = new Date().toISOString();
      if (kind === "cancel") {
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: "cancelled", updated_at: now } : b)));
      } else {
        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      }
      setConfirmOpen(false);
      setConfirmAction(null);
    } catch (e) {
      setErr(e?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  }

  // When user clicks "+ Save" in a search modal, close that modal and open Create
  function handleSearchSave(prefill) {
    setHotelSearchOpen(false);
    setCarSearchOpen(false);
    setToursSearchOpen(false);
    openCreate(prefill);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Bookings</h1>
          <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
            Search hotels, car rentals, and tours via Booking.com.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px" }}>
            Refresh
          </button>
          <button
            onClick={() => setHotelSearchOpen(true)}
            style={{ borderRadius: 12, padding: "10px 16px", background: "#1a56db", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            🏨 Hotels
          </button>
          <button
            onClick={() => setCarSearchOpen(true)}
            style={{ borderRadius: 12, padding: "10px 16px", background: "#0e9f6e", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            🚗 Car Rentals
          </button>
          <button
            onClick={() => setToursSearchOpen(true)}
            style={{ borderRadius: 12, padding: "10px 16px", background: "#7e3af2", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            🎡 Tours
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {err ? (
          <div style={{ padding: 12, border: "1px solid #ffd6d6", background: "#fff5f5", borderRadius: 12 }}>
            {err}
          </div>
        ) : null}

        {/* Search + filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 10, alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookings (title/vendor/code/notes)…"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}>
            <option value="all">All types</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="car">Car</option>
            <option value="activity">Activity</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Bookings list */}
        <div style={{ marginTop: 6 }}>
          {loading ? (
            <div style={{ color: "#666" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#666" }}>No bookings found. Use the buttons above to search hotels, cars, or tours.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((b) => (
                <div
                  key={b.id}
                  style={{ border: "1px solid #eee", borderRadius: 16, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{b.title}</div>
                      <StatusPill status={b.status || "active"} />
                      <span style={{ fontSize: 12, color: "#666" }}>{b.type || "other"}</span>
                    </div>
                    <div style={{ color: "#333" }}>
                      <span style={{ color: "#666" }}>Vendor:</span>{" "}
                      {b.vendor ? b.vendor : <span style={{ color: "#999" }}>—</span>}
                      {"  ·  "}
                      <span style={{ color: "#666" }}>Code:</span>{" "}
                      {b.confirmation_code ? b.confirmation_code : <span style={{ color: "#999" }}>—</span>}
                    </div>
                    <div style={{ color: "#333", fontSize: 13 }}>
                      <span style={{ color: "#666" }}>Time:</span>{" "}
                      {b.start_time ? new Date(b.start_time).toLocaleString() : "—"}{" "}
                      {b.end_time ? `→ ${new Date(b.end_time).toLocaleString()}` : ""}
                      {"  ·  "}
                      <span style={{ color: "#666" }}>Cost:</span>{" "}
                      {b.cost != null ? `${b.cost} ${b.currency || ""}` : "—"}
                    </div>
                    {b.notes ? <div style={{ color: "#444", fontSize: 13, marginTop: 4 }}>{b.notes}</div> : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
                    <button onClick={() => openEdit(b)} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px" }}>Edit</button>
                    <button onClick={() => askCancel(b)} disabled={loading || (b.status || "active") === "cancelled"} style={{ borderRadius: 12, padding: "10px 12px" }}>Cancel</button>
                    <button onClick={() => askDelete(b)} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px", border: "1px solid #ffd6d6", background: "#fff5f5" }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      <Modal open={modalOpen} title={editing ? "Edit booking" : "Create booking"} onClose={() => setModalOpen(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Title *">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="Marriott SF / Flight UA123 / Car rental…" />
          </Field>
          <Field label="Type *">
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
              <option value="hotel">Hotel</option>
              <option value="flight">Flight</option>
              <option value="car">Car</option>
              <option value="activity">Activity</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Vendor">
            <input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} style={inputStyle} placeholder="Marriott / United / Hertz…" />
          </Field>
          <Field label="Confirmation code">
            <input value={form.confirmation_code} onChange={(e) => setForm((p) => ({ ...p, confirmation_code: e.target.value }))} style={inputStyle} placeholder="ABC123" />
          </Field>
          <Field label="Start time">
            <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="End time">
            <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Cost">
            <input value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} style={inputStyle} placeholder="199.99" />
          </Field>
          <Field label="Currency">
            <input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} style={inputStyle} placeholder="USD" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Anything important…" />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={() => setModalOpen(false)} style={{ borderRadius: 12, padding: "10px 12px" }}>Close</button>
          <button onClick={submit} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px", background: "black", color: "white" }}>
            {editing ? "Save changes" : "Create booking"}
          </button>
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal open={confirmOpen} title={confirmAction?.kind === "delete" ? "Delete booking?" : "Cancel booking?"} onClose={() => setConfirmOpen(false)}>
        <div style={{ color: "#333" }}>
          {confirmAction?.booking ? (
            <>
              <div style={{ fontWeight: 700 }}>{confirmAction.booking.title}</div>
              <div style={{ color: "#666", marginTop: 6 }}>
                This action cannot be undone{confirmAction.kind === "cancel" ? " (but you can keep the record)." : "."}
              </div>
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={() => setConfirmOpen(false)} style={{ borderRadius: 12, padding: "10px 12px" }}>No</button>
          <button onClick={doConfirm} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px", background: confirmAction?.kind === "delete" ? "#b00020" : "black", color: "white" }}>Yes</button>
        </div>
      </Modal>

      {/* Search modals */}
      <HotelSearchModal open={hotelSearchOpen} onClose={() => setHotelSearchOpen(false)} onSave={handleSearchSave} />
      <CarSearchModal open={carSearchOpen} onClose={() => setCarSearchOpen(false)} onSave={handleSearchSave} />
      <ToursSearchModal open={toursSearchOpen} onClose={() => setToursSearchOpen(false)} onSave={handleSearchSave} />
    </div>
  );
}
