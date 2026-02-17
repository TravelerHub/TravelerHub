import React, { useEffect, useMemo, useState } from "react";

/**
 * Booking.jsx (HARD-CODE DEMO)
 * ---------------------------------------------------------
 * Purpose:
 *  - This page renders a Booking list UI with full CRUD behavior
 *    (Create/Edit/Cancel/Delete) WITHOUT calling any backend.
 *  - All data lives in React state so the UI is demo-ready.
 *
 * How to switch to real backend later:
 *  1) Replace `load()` to call bookingApi.list({ tripId })
 *  2) Replace `submit()` to call bookingApi.create/update
 *  3) Replace `doConfirm()` to call bookingApi.cancel/remove
 *  4) Remove SEED_BOOKINGS or use it as fallback/mock
 *
 * Data model assumptions (align with your DB later):
 *  id, trip_id, title, vendor, type, start_time, end_time,
 *  confirmation_code, cost, currency, notes, status,
 *  created_by, created_at, updated_at
 */

// Default form values for Create/Edit modal
const DEFAULT_FORM = {
  title: "",
  vendor: "",
  type: "hotel", // hotel | flight | car | activity | other
  start_time: "",
  end_time: "",
  confirmation_code: "",
  cost: "",
  currency: "USD",
  notes: "",
};

// Hardcoded seed data for demo UI (pretend these came from the backend)
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

/**
 * Converts an ISO datetime string into a "datetime-local" input format:
 *   - strips seconds and timezone
 *   - e.g. "2026-02-20T20:00:00.000Z" => "2026-02-20T12:00" (local time)
 */
function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Converts a "datetime-local" input value into an ISO string for storing.
 * Returns null if input is empty/invalid.
 */
function fromInputDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Small pill UI for booking status */
function StatusPill({ status }) {
  const label = status || "active";
  const style = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    fontSize: 12,
    background: label === "cancelled" ? "#fff5f5" : "#f6ffed",
  };
  return <span style={style}>{label}</span>;
}

/**
 * Minimal modal component.
 * Click outside (overlay) closes modal.
 */
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
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ borderRadius: 10, padding: "6px 10px" }}>
            ✕
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

/** Reusable field wrapper for label + input */
function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, color: "#444" }}>{label}</div>
      {children}
    </label>
  );
}

/**
 * Generates a pseudo-unique id for demo records.
 * (Backend will generate real UUIDs later.)
 */
function uid() {
  return `b_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export default function Booking({ tripId: tripIdProp }) {
  /**
   * In the real app, tripId should come from router params:
   *   const { tripId } = useParams();
   *
   * For demo, if tripId is missing, we default to "t1"
   * so the seeded items show up.
   */
  const tripId = tripIdProp || "t1";

  // Loading/error states (useful when swapping to real API later)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Local data store (this is our "fake database")
  const [bookings, setBookings] = useState([]);

  // Search + filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Create/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // holds the booking being edited
  const [form, setForm] = useState(DEFAULT_FORM);

  // Confirm modal state (cancel/delete)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { kind: "cancel"|"delete", booking }

  /**
   * Derived array used by the UI:
   *  - filters by tripId
   *  - applies search + status/type filters
   *  - sorts by start_time descending
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => b.trip_id === tripId)
      .filter((b) => {
        if (statusFilter !== "all" && (b.status || "active") !== statusFilter) return false;
        if (typeFilter !== "all" && (b.type || "other") !== typeFilter) return false;
        if (!q) return true;

        const hay = [
          b.title,
          b.vendor,
          b.type,
          b.confirmation_code,
          b.notes,
          b.status,
        ]
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

  /**
   * "Load" function:
   * - In demo: assigns SEED_BOOKINGS into state
   * - In real app: replace with bookingApi.list({ tripId })
   */
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

  // Load seed data when the trip changes
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  /** Open modal for creating a new booking */
  function openCreate() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  }

  /** Open modal for editing an existing booking */
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

  /** Simple client-side validation (backend should also validate later) */
  function validateForm() {
    if (!form.title.trim()) return "Title is required";
    if (!form.type) return "Type is required";

    const start = fromInputDateTime(form.start_time);
    const end = fromInputDateTime(form.end_time);
    if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
      return "End time cannot be earlier than start time";
    }

    if (form.cost && Number.isNaN(Number(form.cost))) return "Cost must be a number";
    return "";
  }

  /**
   * Save handler for Create/Edit modal:
   * - If editing exists: update that record in local state
   * - Otherwise: create a new record in local state
   */
  async function submit() {
    const v = validateForm();
    if (v) {
      setErr(v);
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const now = new Date().toISOString();

      // Normalize form values into a "DB-like" booking row
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
        // Edit existing
        setBookings((prev) =>
          prev.map((b) => (b.id === editing.id ? { ...b, ...payload, updated_at: now } : b))
        );
      } else {
        // Create new
        const newRow = {
          id: uid(),
          status: "active",
          created_by: "u1", // demo user id (swap to real auth user later)
          created_at: now,
          updated_at: now,
          ...payload,
        };
        setBookings((prev) => [newRow, ...prev]);
      }

      // Reset modal state
      setModalOpen(false);
      setEditing(null);
      setForm(DEFAULT_FORM);
    } catch (e) {
      setErr(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  /** Open confirm modal for cancel */
  function askCancel(b) {
    setConfirmAction({ kind: "cancel", booking: b });
    setConfirmOpen(true);
  }

  /** Open confirm modal for delete */
  function askDelete(b) {
    setConfirmAction({ kind: "delete", booking: b });
    setConfirmOpen(true);
  }

  /**
   * Confirm handler for cancel/delete:
   * - Cancel: mark status = cancelled
   * - Delete: remove from local state
   */
  async function doConfirm() {
    if (!confirmAction) return;
    const { kind, booking } = confirmAction;

    setLoading(true);
    setErr("");
    try {
      const now = new Date().toISOString();

      if (kind === "cancel") {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, status: "cancelled", updated_at: now } : b))
        );
      } else if (kind === "delete") {
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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Bookings</h1>
          <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
            (Demo) Create, edit, cancel, and delete bookings locally.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ borderRadius: 12, padding: "10px 12px" }}>
            Refresh
          </button>
          <button
            onClick={openCreate}
            disabled={loading || !tripId}
            style={{ borderRadius: 12, padding: "10px 12px", background: "black", color: "white" }}
          >
            + New booking
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {/* Error banner */}
        {err ? (
          <div style={{ padding: 12, border: "1px solid #ffd6d6", background: "#fff5f5", borderRadius: 12 }}>
            {err}
          </div>
        ) : null}

        {/* Search + filters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 160px 160px",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookings (title/vendor/code/notes)…"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
          >
            <option value="all">All types</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="car">Car</option>
            <option value="activity">Activity</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* List */}
        <div style={{ marginTop: 6 }}>
          {loading ? (
            <div style={{ color: "#666" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#666" }}>No bookings found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 16,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                  }}
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
                      {"  "}·{"  "}
                      <span style={{ color: "#666" }}>Code:</span>{" "}
                      {b.confirmation_code ? b.confirmation_code : <span style={{ color: "#999" }}>—</span>}
                    </div>

                    <div style={{ color: "#333", fontSize: 13 }}>
                      <span style={{ color: "#666" }}>Time:</span>{" "}
                      {b.start_time ? new Date(b.start_time).toLocaleString() : "—"}{" "}
                      {b.end_time ? `→ ${new Date(b.end_time).toLocaleString()}` : ""}
                      {"  "}·{"  "}
                      <span style={{ color: "#666" }}>Cost:</span>{" "}
                      {b.cost != null ? `${b.cost} ${b.currency || ""}` : "—"}
                    </div>

                    {b.notes ? (
                      <div style={{ color: "#444", fontSize: 13, marginTop: 4 }}>{b.notes}</div>
                    ) : null}
                  </div>

                  {/* Row actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
                    <button
                      onClick={() => openEdit(b)}
                      disabled={loading}
                      style={{ borderRadius: 12, padding: "10px 12px" }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => askCancel(b)}
                      disabled={loading || (b.status || "active") === "cancelled"}
                      style={{ borderRadius: 12, padding: "10px 12px" }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => askDelete(b)}
                      disabled={loading}
                      style={{
                        borderRadius: 12,
                        padding: "10px 12px",
                        border: "1px solid #ffd6d6",
                        background: "#fff5f5",
                      }}
                    >
                      Delete
                    </button>
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
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              placeholder="Marriott SF / Flight UA123 / Car rental…"
            />
          </Field>

          <Field label="Type *">
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="hotel">Hotel</option>
              <option value="flight">Flight</option>
              <option value="car">Car</option>
              <option value="activity">Activity</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Vendor">
            <input
              value={form.vendor}
              onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              placeholder="Marriott / United / Hertz…"
            />
          </Field>

          <Field label="Confirmation code">
            <input
              value={form.confirmation_code}
              onChange={(e) => setForm((p) => ({ ...p, confirmation_code: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              placeholder="ABC123"
            />
          </Field>

          <Field label="Start time">
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </Field>

          <Field label="End time">
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </Field>

          <Field label="Cost">
            <input
              value={form.cost}
              onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              placeholder="199.99"
            />
          </Field>

          <Field label="Currency">
            <input
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              placeholder="USD"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", minHeight: 90, resize: "vertical" }}
              placeholder="Anything important about this booking…"
            />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={() => setModalOpen(false)} style={{ borderRadius: 12, padding: "10px 12px" }}>
            Close
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{ borderRadius: 12, padding: "10px 12px", background: "black", color: "white" }}
          >
            {editing ? "Save changes" : "Create booking"}
          </button>
        </div>
      </Modal>

      {/* Confirm modal */}
      <Modal
        open={confirmOpen}
        title={confirmAction?.kind === "delete" ? "Delete booking?" : "Cancel booking?"}
        onClose={() => setConfirmOpen(false)}
      >
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
          <button onClick={() => setConfirmOpen(false)} style={{ borderRadius: 12, padding: "10px 12px" }}>
            No
          </button>
          <button
            onClick={doConfirm}
            disabled={loading}
            style={{
              borderRadius: 12,
              padding: "10px 12px",
              background: confirmAction?.kind === "delete" ? "#b00020" : "black",
              color: "white",
            }}
          >
            Yes
          </button>
        </div>
      </Modal>
    </div>
  );
}
