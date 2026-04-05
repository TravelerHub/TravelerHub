import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";

// ── Color palette (matches Dashboard)
// #160f29  deep dark   (sidebar bg)
// #fbfbf2  off-white   (page bg)
// #5c6b73  slate-gray  (secondary text)
// #183a37  dark teal   (accent)
// #f3f4f6  light gray  (main bg)

const API_BASE = "http://127.0.0.1:8000";

const BOOKING_TABS = [
  { id: "all",        label: "All",        icon: "📋" },
  { id: "hotel",      label: "Hotels",     icon: "🏨" },
  { id: "flight",     label: "Flights",    icon: "✈️" },
  { id: "car",        label: "Cars",       icon: "🚗" },
  { id: "activity",   label: "Activities", icon: "🎡" },
];

const TYPE_ICONS = {
  hotel:    "🏨",
  flight:   "✈️",
  car:      "🚗",
  car_rental:"🚗",
  activity: "🎡",
  attraction:"🎡",
  other:    "📋",
};

const DEFAULT_FORM = {
  title: "", vendor: "", type: "hotel",
  start_time: "", end_time: "",
  confirmation_code: "", cost: "", currency: "USD", notes: "",
};

const SEED_BOOKINGS = [
  {
    id: "b1", trip_id: "t1", title: "Marriott Downtown SF", vendor: "Marriott",
    type: "hotel", start_time: "2026-08-01T15:00:00.000Z", end_time: "2026-08-04T11:00:00.000Z",
    confirmation_code: "MARR-29384", cost: 645.5, currency: "USD",
    notes: "Check-in after 3pm. Parking is $45/night.", status: "confirmed",
  },
  {
    id: "b2", trip_id: "t1", title: "United UA 123 (LAX → SFO)", vendor: "United",
    type: "flight", start_time: "2026-08-01T07:30:00.000Z", end_time: "2026-08-01T09:00:00.000Z",
    confirmation_code: "UA-ABC123", cost: 179.99, currency: "USD",
    notes: "Seat 12A. Bag drop closes 45 mins before departure.", status: "confirmed",
  },
  {
    id: "b3", trip_id: "t1", title: "Hertz Car Rental (SFO)", vendor: "Hertz",
    type: "car", start_time: "2026-08-01T10:00:00.000Z", end_time: "2026-08-04T10:00:00.000Z",
    confirmation_code: "HZ-77819", cost: 230, currency: "USD",
    notes: "Pick up at Terminal 2.", status: "cancelled",
  },
  {
    id: "b4", trip_id: "t1", title: "Alcatraz Island Tour", vendor: "City Experiences",
    type: "activity", start_time: "2026-08-02T09:00:00.000Z", end_time: "2026-08-02T13:00:00.000Z",
    confirmation_code: "ALC-5521", cost: 49.99, currency: "USD",
    notes: "Evening tour. Meet at Pier 33.", status: "confirmed",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function toInputDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromInputDateTime(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function uid() { return `b_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function apiFetch(path) {
  const token = localStorage.getItem("token") || localStorage.getItem("access_token");
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return resp.json();
}

// ── Small reusable UI ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = status || "pending";
  const styles = {
    confirmed: { background: "#000", color: "#fff" },
    active:    { background: "#000", color: "#fff" },
    cancelled: { background: "#fee2e2", color: "#991b1b" },
    pending:   { background: "#f3f4f6", color: "#6b7280" },
  };
  return (
    <span
      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
      style={styles[s] || styles.pending}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ maxWidth: 740, background: "#fff", padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "#160f29" }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-gray-100 transition"
            style={{ color: "#5c6b73" }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5c6b73" }}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition focus:ring-2";
const inputStyle = { borderColor: "#e5e7eb", color: "#160f29", "--tw-ring-color": "#183a37" };

// ── Search Modals ──────────────────────────────────────────────────────────────
function HotelSearchModal({ open, onClose, onSave }) {
  const [city, setCity] = useState("Los Angeles");
  const [checkin, setCheckin] = useState("2026-08-01");
  const [checkout, setCheckout] = useState("2026-08-04");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true); setErr(""); setResults([]);
    try {
      const cityRes = await apiFetch(`/api/bookings/hotels/city?name=${encodeURIComponent(city)}`);
      if (cityRes.error || !cityRes.data?.length) { setErr(cityRes.error || "City not found"); return; }
      const cityId = cityRes.data[0].city_id ?? cityRes.data[0].id ?? cityRes.data[0].dest_id;
      const res = await apiFetch(`/api/bookings/hotels/search?city_id=${cityId}&checkin=${checkin}&checkout=${checkout}&adults=${adults}&rooms=${rooms}`);
      if (res.error) { setErr(res.error); return; }
      setResults(res.data || []);
    } catch (e) { setErr(e.message); }
    finally { setSearching(false); }
  }

  return (
    <Modal open={open} title="🏨 Search Hotels" onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Field label="City"><input className={inputCls} style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
        <Field label="Check-in"><input type="date" className={inputCls} style={inputStyle} value={checkin} onChange={(e) => setCheckin(e.target.value)} /></Field>
        <Field label="Check-out"><input type="date" className={inputCls} style={inputStyle} value={checkout} onChange={(e) => setCheckout(e.target.value)} /></Field>
        <Field label="Adults"><input type="number" min={1} className={inputCls} style={inputStyle} value={adults} onChange={(e) => setAdults(Number(e.target.value))} /></Field>
        <Field label="Rooms"><input type="number" min={1} className={inputCls} style={inputStyle} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} /></Field>
      </div>
      <button onClick={search} disabled={searching} className="px-5 py-2.5 rounded-xl text-sm font-semibold mb-4 transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff" }}>
        {searching ? "Searching…" : "Search Hotels"}
      </button>
      {err && <p className="text-sm mb-3" style={{ color: "#dc2626" }}>{err}</p>}
      <div className="flex flex-col gap-2">
        {results.map((h, i) => {
          const name = h.name || h.hotel_name || `Hotel ${i + 1}`;
          const price = h.min_total_price ?? h.price ?? h.composite_price_breakdown?.gross_amount?.value;
          return (
            <div key={h.hotel_id ?? i} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#160f29" }}>{name}</p>
                {price != null && <p className="text-xs mt-0.5" style={{ color: "#5c6b73" }}>From ${Number(price).toFixed(2)}</p>}
              </div>
              <button onClick={() => onSave({ title: name, vendor: name, type: "hotel", cost: price ?? "", start_time: checkin, end_time: checkout })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff", whiteSpace: "nowrap" }}>
                + Save
              </button>
            </div>
          );
        })}
        {!searching && results.length === 0 && !err && <p className="text-sm" style={{ color: "#9ca3af" }}>Enter a city and click Search to see results.</p>}
      </div>
    </Modal>
  );
}

function CarSearchModal({ open, onClose, onSave }) {
  const [airport, setAirport] = useState("LAX");
  const [pickup, setPickup] = useState("2026-08-01T10:00");
  const [dropoff, setDropoff] = useState("2026-08-04T10:00");
  const [driverAge, setDriverAge] = useState(25);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true); setErr(""); setResults([]);
    try {
      const pickupIso = pickup.length === 16 ? `${pickup}:00` : pickup;
      const dropoffIso = dropoff.length === 16 ? `${dropoff}:00` : dropoff;
      const res = await apiFetch(`/api/bookings/cars/search?airport=${airport}&pickup=${encodeURIComponent(pickupIso)}&dropoff=${encodeURIComponent(dropoffIso)}&driver_age=${driverAge}`);
      if (res.error) { setErr(res.error); return; }
      setResults(res.data || []);
    } catch (e) { setErr(e.message); }
    finally { setSearching(false); }
  }

  return (
    <Modal open={open} title="🚗 Search Car Rentals" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="Airport (IATA)"><input className={inputCls} style={inputStyle} value={airport} onChange={(e) => setAirport(e.target.value.toUpperCase())} placeholder="LAX" /></Field>
        <Field label="Driver Age"><input type="number" min={18} className={inputCls} style={inputStyle} value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} /></Field>
        <Field label="Pick-up datetime"><input type="datetime-local" className={inputCls} style={inputStyle} value={pickup} onChange={(e) => setPickup(e.target.value)} /></Field>
        <Field label="Drop-off datetime"><input type="datetime-local" className={inputCls} style={inputStyle} value={dropoff} onChange={(e) => setDropoff(e.target.value)} /></Field>
      </div>
      <button onClick={search} disabled={searching} className="px-5 py-2.5 rounded-xl text-sm font-semibold mb-4 transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff" }}>
        {searching ? "Searching…" : "Search Cars"}
      </button>
      {err && <p className="text-sm mb-3" style={{ color: "#dc2626" }}>{err}</p>}
      <div className="flex flex-col gap-2">
        {results.map((c, i) => {
          const name = c.vehicle?.name ?? c.car_name ?? c.name ?? `Car ${i + 1}`;
          const vendor = c.vendor?.name ?? c.supplier_name ?? "";
          const price = c.price?.amount ?? c.total_price ?? c.base_price;
          return (
            <div key={c.id ?? i} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#160f29" }}>{name}</p>
                {vendor && <p className="text-xs" style={{ color: "#5c6b73" }}>{vendor}</p>}
                {price != null && <p className="text-xs mt-0.5" style={{ color: "#5c6b73" }}>From ${Number(price).toFixed(2)}</p>}
              </div>
              <button onClick={() => onSave({ title: `${name}${vendor ? ` — ${vendor}` : ""}`, vendor, type: "car", cost: price ?? "", start_time: pickup, end_time: dropoff })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff", whiteSpace: "nowrap" }}>
                + Save
              </button>
            </div>
          );
        })}
        {!searching && results.length === 0 && !err && <p className="text-sm" style={{ color: "#9ca3af" }}>Enter airport code and dates, then click Search.</p>}
      </div>
    </Modal>
  );
}

function ToursSearchModal({ open, onClose, onSave }) {
  const [city, setCity] = useState("Los Angeles");
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-07");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    setSearching(true); setErr(""); setResults([]);
    try {
      const cityRes = await apiFetch(`/api/bookings/hotels/city?name=${encodeURIComponent(city)}`);
      if (cityRes.error || !cityRes.data?.length) { setErr(cityRes.error || "City not found"); return; }
      const cityId = cityRes.data[0].city_id ?? cityRes.data[0].id ?? cityRes.data[0].dest_id;
      const res = await apiFetch(`/api/bookings/attractions/search?city_id=${cityId}&start_date=${startDate}&end_date=${endDate}`);
      if (res.error && res.data?.length === 0) { setErr(res.error); return; }
      setResults(res.data || []);
      if (res.error) setErr(res.error);
    } catch (e) { setErr(e.message); }
    finally { setSearching(false); }
  }

  return (
    <Modal open={open} title="🎡 Search Tours & Attractions" onClose={onClose}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Field label="City"><input className={inputCls} style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
        <Field label="Start date"><input type="date" className={inputCls} style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="End date"><input type="date" className={inputCls} style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <button onClick={search} disabled={searching} className="px-5 py-2.5 rounded-xl text-sm font-semibold mb-4 transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff" }}>
        {searching ? "Searching…" : "Search Tours"}
      </button>
      {err && <p className="text-sm mb-3" style={{ color: "#dc2626" }}>{err}</p>}
      <div className="flex flex-col gap-2">
        {results.map((a, i) => {
          const name = a.name ?? a.title ?? `Attraction ${i + 1}`;
          const price = a.price?.amount ?? a.min_price ?? a.from_price;
          return (
            <div key={a.id ?? i} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#160f29" }}>{name}</p>
                {price != null && <p className="text-xs mt-0.5" style={{ color: "#5c6b73" }}>From ${Number(price).toFixed(2)}</p>}
              </div>
              <button onClick={() => onSave({ title: name, vendor: "", type: "activity", cost: price ?? "", start_time: startDate, end_time: endDate })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff", whiteSpace: "nowrap" }}>
                + Save
              </button>
            </div>
          );
        })}
        {!searching && results.length === 0 && !err && <p className="text-sm" style={{ color: "#9ca3af" }}>Enter a city and dates, then click Search.</p>}
      </div>
    </Modal>
  );
}

// ── Booking card ───────────────────────────────────────────────────────────────
function BookingCard({ b, onEdit, onCancel, onDelete, loading }) {
  const icon = TYPE_ICONS[b.type] || "📋";
  const isCancelled = (b.status || "active") === "cancelled";
  return (
    <div
      className="rounded-2xl p-4 flex gap-4 transition"
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        opacity: isCancelled ? 0.65 : 1,
      }}
    >
      {/* Icon */}
      <div
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-xl"
        style={{ background: "#f3f4f6" }}
      >
        {icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-semibold text-sm truncate" style={{ color: "#160f29" }}>{b.title}</p>
          <StatusBadge status={b.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: "#5c6b73" }}>
          {b.vendor && <span>🏢 {b.vendor}</span>}
          {b.confirmation_code && <span>🔖 {b.confirmation_code}</span>}
          {b.start_time && (
            <span>
              📅 {fmtDate(b.start_time)} {fmtTime(b.start_time)}
              {b.end_time && ` → ${fmtDate(b.end_time)}`}
            </span>
          )}
          {b.cost != null && <span>💰 {b.cost} {b.currency || "USD"}</span>}
        </div>
        {b.notes && (
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#6b7280" }}>{b.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          onClick={() => onEdit(b)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-gray-100"
          style={{ border: "1px solid #e5e7eb", color: "#374151" }}
        >
          Edit
        </button>
        <button
          onClick={() => onCancel(b)}
          disabled={loading || isCancelled}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-amber-50 disabled:opacity-40"
          style={{ border: "1px solid #fcd34d", color: "#92400e" }}
        >
          Cancel
        </button>
        <button
          onClick={() => onDelete(b)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-red-50"
          style={{ border: "1px solid #fca5a5", color: "#dc2626" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Booking({ tripId: tripIdProp }) {
  const navigate = useNavigate();
  const tripId = tripIdProp || "t1";

  const user = (() => {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  })();
  const displayName = user?.username || user?.name || "Traveler";

  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [err, setErr]                     = useState("");
  const [activeTab, setActiveTab]         = useState("all");
  const [query, setQuery]                 = useState("");

  // Create/Edit modal
  const [modalOpen, setModalOpen]         = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(DEFAULT_FORM);
  const [formErr, setFormErr]             = useState("");

  // Confirm modal
  const [confirmOpen, setConfirmOpen]     = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Search modals
  const [hotelOpen, setHotelOpen]         = useState(false);
  const [carOpen, setCarOpen]             = useState(false);
  const [toursOpen, setToursOpen]         = useState(false);

  useEffect(() => {
    setLoading(true);
    try { setBookings(SEED_BOOKINGS); }
    catch (e) { setErr(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }, [tripId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => b.trip_id === tripId)
      .filter((b) => activeTab === "all" || b.type === activeTab || (activeTab === "car" && b.type === "car_rental") || (activeTab === "activity" && b.type === "attraction"))
      .filter((b) => !q || [b.title, b.vendor, b.type, b.confirmation_code, b.notes].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
  }, [bookings, activeTab, query, tripId]);

  // Summarise counts per tab
  const counts = useMemo(() => {
    const c = { all: 0, hotel: 0, flight: 0, car: 0, activity: 0 };
    bookings.filter((b) => b.trip_id === tripId).forEach((b) => {
      c.all++;
      const t = b.type === "car_rental" ? "car" : b.type === "attraction" ? "activity" : b.type;
      if (t in c) c[t]++;
    });
    return c;
  }, [bookings, tripId]);

  function openCreate(prefill = {}) {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, ...prefill });
    setFormErr("");
    setModalOpen(true);
  }
  function openEdit(b) {
    setEditing(b);
    setForm({
      title: b.title ?? "", vendor: b.vendor ?? "", type: b.type ?? "hotel",
      start_time: toInputDateTime(b.start_time), end_time: toInputDateTime(b.end_time),
      confirmation_code: b.confirmation_code ?? "",
      cost: b.cost != null ? String(b.cost) : "",
      currency: b.currency ?? "USD", notes: b.notes ?? "",
    });
    setFormErr("");
    setModalOpen(true);
  }
  function validateForm() {
    if (!form.title.trim()) return "Title is required";
    const s = fromInputDateTime(form.start_time), e = fromInputDateTime(form.end_time);
    if (s && e && new Date(e) < new Date(s)) return "End time cannot be before start time";
    if (form.cost && isNaN(Number(form.cost))) return "Cost must be a number";
    return "";
  }
  function submit() {
    const v = validateForm();
    if (v) { setFormErr(v); return; }
    const now = new Date().toISOString();
    const payload = {
      trip_id: tripId, title: form.title.trim(), vendor: form.vendor.trim() || null,
      type: form.type, start_time: fromInputDateTime(form.start_time),
      end_time: fromInputDateTime(form.end_time),
      confirmation_code: form.confirmation_code.trim() || null,
      cost: form.cost === "" ? null : Number(form.cost),
      currency: form.currency || "USD", notes: form.notes.trim() || null,
    };
    if (editing?.id) {
      setBookings((prev) => prev.map((b) => b.id === editing.id ? { ...b, ...payload, updated_at: now } : b));
    } else {
      setBookings((prev) => [{ id: uid(), status: "active", created_at: now, updated_at: now, ...payload }, ...prev]);
    }
    setModalOpen(false);
  }
  function doConfirm() {
    if (!confirmAction) return;
    const { kind, booking } = confirmAction;
    const now = new Date().toISOString();
    if (kind === "cancel") {
      setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: "cancelled", updated_at: now } : b));
    } else {
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    }
    setConfirmOpen(false);
    setConfirmAction(null);
  }
  function handleSearchSave(prefill) {
    setHotelOpen(false); setCarOpen(false); setToursOpen(false);
    openCreate(prefill);
  }

  const totalCost = useMemo(() =>
    bookings.filter((b) => b.trip_id === tripId && (b.status || "active") !== "cancelled" && b.cost != null)
      .reduce((s, b) => s + Number(b.cost), 0)
  , [bookings, tripId]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>
        {/* Greeting */}
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>Hi,</p>
          <p className="font-bold text-lg leading-tight truncate" style={{ color: "#f9fafb" }}>{displayName}</p>
        </div>

        {/* Page nav */}
        <nav className="flex flex-col gap-1 px-3 py-4">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.path === "/booking";
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? "font-bold" : isDisabled ? "cursor-not-allowed" : "hover:bg-white/10"}`}
                style={{ background: isActive ? "#ffffff" : "transparent", color: isActive ? "#000000" : isDisabled ? "#4b5563" : "#9ca3af" }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t" style={{ borderColor: "#374151" }} />

        {/* Booking type tabs */}
        <div className="px-3 py-3 flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "#4b5563" }}>
            Filter by type
          </p>
          {BOOKING_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between"
                style={{
                  background: isActive ? "#183a37" : "transparent",
                  color: isActive ? "#ffffff" : "#9ca3af",
                }}
              >
                <span>{tab.icon} {tab.label}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.2)" : "#374151",
                    color: isActive ? "#fff" : "#9ca3af",
                  }}
                >
                  {counts[tab.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add booking button */}
        <div className="mt-auto px-3 pb-5">
          <button
            onClick={() => openCreate()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
            style={{ background: "#374151", color: "#f9fafb" }}
          >
            + New Booking
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* ── Header row ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#160f29" }}>Bookings</h1>
              <p className="text-sm mt-0.5" style={{ color: "#5c6b73" }}>Manage your hotels, flights, cars, and activities</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setHotelOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-90"
                style={{ background: "#1e3a5f", color: "#fff" }}>
                🏨 Hotels
              </button>
              <button onClick={() => setCarOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-90"
                style={{ background: "#183a37", color: "#fff" }}>
                🚗 Car Rentals
              </button>
              <button onClick={() => setToursOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-90"
                style={{ background: "#2d1b4e", color: "#fff" }}>
                🎡 Tours
              </button>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Bookings",  value: counts.all,                        icon: "📋" },
              { label: "Hotels",          value: counts.hotel,                       icon: "🏨" },
              { label: "Flights",         value: counts.flight,                      icon: "✈️" },
              { label: "Total Cost",      value: `$${totalCost.toFixed(2)}`,         icon: "💰" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className="text-lg font-bold leading-tight" style={{ color: "#160f29" }}>{c.value}</p>
                  <p className="text-xs" style={{ color: "#5c6b73" }}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Search bar ── */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="#9ca3af" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, vendor, or confirmation code…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2"
              style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#160f29", "--tw-ring-color": "#183a37" }}
            />
          </div>

          {/* ── Error ── */}
          {err && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626" }}>
              {err}
            </div>
          )}

          {/* ── Bookings list ── */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#e5e7eb" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
              <span className="text-5xl">🗂️</span>
              <p className="font-semibold" style={{ color: "#160f29" }}>No bookings found</p>
              <p className="text-sm text-center" style={{ color: "#5c6b73" }}>
                {query ? "Try a different search term." : "Use the search buttons above to find hotels, cars, or tours."}
              </p>
              <button onClick={() => openCreate()} className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff" }}>
                + Add manually
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((b) => (
                <BookingCard
                  key={b.id} b={b} loading={loading}
                  onEdit={openEdit}
                  onCancel={(b) => { setConfirmAction({ kind: "cancel", booking: b }); setConfirmOpen(true); }}
                  onDelete={(b) => { setConfirmAction({ kind: "delete", booking: b }); setConfirmOpen(true); }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ══ Modals ════════════════════════════════════════════════════════════════ */}

      {/* Create / Edit */}
      <Modal open={modalOpen} title={editing ? "Edit Booking" : "New Booking"} onClose={() => setModalOpen(false)}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Title *">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Marriott SF / Flight UA123…" />
          </Field>
          <Field label="Type *">
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputCls} style={inputStyle}>
              <option value="hotel">🏨 Hotel</option>
              <option value="flight">✈️ Flight</option>
              <option value="car">🚗 Car Rental</option>
              <option value="activity">🎡 Activity / Tour</option>
              <option value="other">📋 Other</option>
            </select>
          </Field>
          <Field label="Vendor">
            <input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Marriott / United / Hertz…" />
          </Field>
          <Field label="Confirmation Code">
            <input value={form.confirmation_code} onChange={(e) => setForm((p) => ({ ...p, confirmation_code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="ABC123" />
          </Field>
          <Field label="Start Date & Time">
            <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="End Date & Time">
            <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Cost">
            <input value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} className={inputCls} style={inputStyle} placeholder="199.99" />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className={inputCls} style={inputStyle}>
              <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>CAD</option><option>AUD</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputCls} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Check-in instructions, seat numbers, anything important…" />
            </Field>
          </div>
        </div>
        {formErr && <p className="text-sm mb-3" style={{ color: "#dc2626" }}>{formErr}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm transition hover:bg-gray-100" style={{ border: "1px solid #e5e7eb", color: "#374151" }}>Cancel</button>
          <button onClick={submit} className="px-5 py-2 rounded-xl text-sm font-semibold transition hover:bg-gray-800" style={{ background: "#160f29", color: "#fff" }}>
            {editing ? "Save Changes" : "Create Booking"}
          </button>
        </div>
      </Modal>

      {/* Confirm cancel/delete */}
      <Modal
        open={confirmOpen}
        title={confirmAction?.kind === "delete" ? "Delete Booking?" : "Cancel Booking?"}
        onClose={() => setConfirmOpen(false)}
      >
        <p className="text-sm mb-5" style={{ color: "#374151" }}>
          {confirmAction?.kind === "delete"
            ? `Permanently delete "${confirmAction?.booking?.title}"? This cannot be undone.`
            : `Mark "${confirmAction?.booking?.title}" as cancelled?`}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl text-sm transition hover:bg-gray-100" style={{ border: "1px solid #e5e7eb", color: "#374151" }}>Go back</button>
          <button
            onClick={doConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: confirmAction?.kind === "delete" ? "#dc2626" : "#92400e", color: "#fff" }}
          >
            {confirmAction?.kind === "delete" ? "Delete" : "Cancel Booking"}
          </button>
        </div>
      </Modal>

      {/* Search modals */}
      <HotelSearchModal open={hotelOpen} onClose={() => setHotelOpen(false)} onSave={handleSearchSave} />
      <CarSearchModal   open={carOpen}   onClose={() => setCarOpen(false)}   onSave={handleSearchSave} />
      <ToursSearchModal open={toursOpen} onClose={() => setToursOpen(false)} onSave={handleSearchSave} />
    </div>
  );
}
