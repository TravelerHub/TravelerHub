import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../config";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import { setActiveGroupId } from "../../services/groupService";

// ── Dashboard widgets ─────────────────────────────────────────────────────────
import Widget              from "../../components/dashboard/Widget.jsx";
import WeatherWidget       from "../../components/dashboard/WeatherWidget.jsx";
import MapSnapshot         from "../../components/dashboard/MapSnapshot.jsx";
import TodoWidget          from "../../components/dashboard/TodoWidget.jsx";
import MiniCalendar        from "../../components/dashboard/MiniCalendar.jsx";
import LocalInfoWidget     from "../../components/dashboard/LocalInfoWidget.jsx";
import BookingSummaryWidget from "../../components/dashboard/BookingSummaryWidget.jsx";

// ── Color palette ─────────────────────────────────────────────────────────────
// #160f29  deep dark   (sidebar, widget backgrounds)
// #fbfbf2  off-white   (page background, light text)
// #5c6b73  slate-gray  (secondary text, muted elements)
// #183a37  dark teal   (active accent, profile avatar)

// ── Quick Access feature tiles ────────────────────────────────────────────────
const FEATURES = [
  { icon: "🧾", label: "Scanner",      sub: "Scan receipts",    path: "/expenses",    accent: "#2d1b4e" },
  { icon: "👥", label: "Group Vote",   sub: "Decide together",  path: "/vote",        accent: "#3b1f1f" },
  { icon: "🌍", label: "Suggestions",  sub: "Travel ideas",     path: "/navigation", accent: "#183a37" },

  // need to do
  { icon: "📝", label: "To Do",  sub: "to do list",     path: "/todo", accent: "#183a37" },
  { icon: "🟡", label: "Emergency",  sub: "Share emergency info",     path: "/emergency", accent: "#183a37" },

  { icon: "🟡", label: "something",  sub: "coming soon",     path: "/dashboard", accent: "#183a37" },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  const user = (() => {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  })();

  // ── State ──────────────────────────────────────────────────────────────────
  const [showCreateModal,    setShowCreateModal]    = useState(false);
  const [newTripName,        setNewTripName]        = useState("");
  const [newTripDescription, setNewTripDescription] = useState("");
  const [creating,           setCreating]           = useState(false);
  const [createError,        setCreateError]        = useState("");
  const [availableUsers,     setAvailableUsers]     = useState([]);
  const [selectedInvitees,   setSelectedInvitees]   = useState([]);

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroup,    setSelectedGroup]    = useState(null);
  const [members,          setMembers]          = useState([]);
  const [loadingMembers,   setLoadingMembers]   = useState(false);

  const [latestConversations, setLatestConversations] = useState([]);
  const [upcomingBookings,    setUpcomingBookings]    = useState([]);

  useEffect(() => {
    if (!user) return;
    fetchLatestChat();
    fetchUpcomingBookings();
    fetchUsersForInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsersForInvites = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/users/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const users = await res.json();
      const others = (Array.isArray(users) ? users : []).filter((u) => u.id !== user?.id);
      setAvailableUsers(others);
    } catch (err) {
      console.error("fetchUsersForInvites:", err);
      setAvailableUsers([]);
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchLatestChat = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLatestConversations(Array.isArray(data) ? data.slice(0, 3) : []);
      }
    } catch (err) {
      console.error("fetchLatestChat:", err);
    }
  };

  const fetchUpcomingBookings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const tripsRes = await fetch(`${API_BASE}/groups/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tripsRes.ok) return;
      const tripsData = await tripsRes.json();
      if (!tripsData?.length) return;
      const tripId = tripsData[0]?.group_id || tripsData[0]?.id;
      const bRes = await fetch(`${API_BASE}/api/bookings?trip_id=${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        const bookings = Array.isArray(bData?.data) ? bData.data : Array.isArray(bData) ? bData : [];
        const now = new Date();
        const upcoming = bookings
          .filter((b) => {
            const d = new Date(b.check_in || b.pickup_datetime || b.start_date || b.created_at);
            return d >= now;
          })
          .sort((a, b) => {
            const da = new Date(a.check_in || a.pickup_datetime || a.start_date || a.created_at);
            const db = new Date(b.check_in || b.pickup_datetime || b.start_date || b.created_at);
            return da - db;
          })
          .slice(0, 3);
        setUpcomingBookings(upcoming);
      }
    } catch (err) {
      console.error("fetchUpcomingBookings:", err);
    }
  };

  // ── Create trip ────────────────────────────────────────────────────────────
  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTripName.trim()) { setCreateError("Trip name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/groups/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newTripName.trim(), description: newTripDescription.trim() || null }),
      });
      if (res.ok) {
        const created = await res.json();
        const createdGroupId = created?.group_id || created?.trip?.id;

        if (createdGroupId && selectedInvitees.length > 0) {
          await Promise.all(
            selectedInvitees.map((userId) =>
              fetch(`${API_BASE}/groups/${createdGroupId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ user_id: userId }),
              })
            )
          );
        }

        if (createdGroupId) {
          setActiveGroupId(createdGroupId);
        }

        setShowCreateModal(false);
        setNewTripName("");
        setNewTripDescription("");
        setSelectedInvitees([]);
      } else {
        const err = await res.json();
        setCreateError(err.detail || "Failed to create trip.");
      }
    } catch (err) {
      console.error(err);
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ── Group members ──────────────────────────────────────────────────────────
  const handleViewMembers = async (trip) => {
    setSelectedGroup(trip);
    setShowMembersModal(true);
    setLoadingMembers(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/groups/${trip.group_id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleMakeLeader = async (groupId, userId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/groups/${groupId}/members/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: "leader" }),
      });
      handleViewMembers(selectedGroup);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fbfbf2" }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: "#5c6b73" }}>You are not logged in.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 rounded-xl font-semibold text-white transition"
            style={{ background: "#160f29" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const displayName    = user?.username || user?.name || "Traveler";
  const calendarEvents = upcomingBookings.map((b) => ({
    date: b.check_in || b.pickup_datetime || b.start_date,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>Hi,</p>
          <p className="font-bold text-lg leading-tight truncate" style={{ color: "#f9fafb" }}>{displayName}</p>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive   = item.path === "/dashboard";
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? "font-bold" : isDisabled ? "cursor-not-allowed" : "hover:bg-white/10"
                }`}
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  color:      isActive ? "#000000" : isDisabled ? "#4b5563" : "#9ca3af",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={() => { setShowCreateModal(true); setCreateError(""); }}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
            style={{ background: "#374151", color: "#f9fafb" }}
          >
            + New Trip
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-4" style={{ background: "#f3f4f6" }}>
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#160f29" }}>Your Trip Groups</h2>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                Create and manage groups to share chat, finance, and navigation.
              </p>
            </div>
            <button
              onClick={() => { setShowCreateModal(true); setCreateError(""); }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
              style={{ background: "#000000", color: "#f9fafb" }}
            >
              + Create Group
            </button>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.4fr 1fr" }}>

            {/* ── ROW 1 · Weather (col 1-2) + Map Snapshot (col 3) ────────── */}
            <Widget title="Weather" className="col-span-2" style={{ minHeight: "88px" }}>
              <WeatherWidget />
            </Widget>

            <Widget title="Map Snapshot" style={{ minHeight: "88px" }}>
              <MapSnapshot />
            </Widget>

            {/* ── ROW 2 · Message + Upcoming Event + Quick Access ──────────── */}
            <Widget title="Message" style={{ minHeight: "220px" }}>
              <div className="h-full flex flex-col gap-2 p-4 overflow-y-auto">
                {latestConversations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.84L3 20l1.09-3.27A7.958 7.958 0 013 12C3 7.582 7.03 4 12 4s9 3.582 9 8z" />
                    </svg>
                    <p className="text-xs text-center" style={{ color: "#6b7280" }}>No recent messages</p>
                    <button
                      onClick={() => navigate("/message")}
                      className="mt-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-700"
                      style={{ background: "#000000", color: "#f9fafb" }}
                    >
                      Open Chat
                    </button>
                  </div>
                ) : (
                  <>
                    {latestConversations.map((conv) => (
                      <button
                        key={conv.id || conv.conversation_id}
                        onClick={() => navigate("/message")}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-black/5 transition"
                        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                      >
                        <p className="text-sm font-medium truncate" style={{ color: "#000000" }}>
                          {conv.name || conv.conversation_name || "Conversation"}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>
                          {conv.last_message || "Tap to open"}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => navigate("/message")}
                      className="mt-auto text-xs font-medium hover:underline"
                      style={{ color: "#374151" }}
                    >
                      View all →
                    </button>
                  </>
                )}
              </div>
            </Widget>

            <Widget title="Upcoming Event" style={{ minHeight: "220px" }}>
              <div className="h-full flex flex-col gap-2 p-4 overflow-y-auto">
                {upcomingBookings.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-center" style={{ color: "#6b7280" }}>No upcoming events</p>
                    <button
                      onClick={() => navigate("/booking")}
                      className="mt-1 px-4 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-700"
                      style={{ background: "#000000", color: "#f9fafb" }}
                    >
                      Add Booking
                    </button>
                  </div>
                ) : (
                  <>
                    {upcomingBookings.map((b, i) => {
                      const typeIcon = { hotel: "🏨", car_rental: "🚗", attraction: "🎡", flight: "✈️" }[b.type] || "📋";
                      const dateRaw  = b.check_in || b.pickup_datetime || b.start_date;
                      const date     = dateRaw
                        ? new Date(dateRaw).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "";
                      return (
                        <div
                          key={b.id || i}
                          className="flex items-start gap-3 px-3 py-3 rounded-xl"
                          style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
                        >
                          <span className="text-lg shrink-0 mt-0.5">{typeIcon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate" style={{ color: "#000000" }}>
                              {b.vendor || b.hotel_name || b.name || "Booking"}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                              {[b.type?.replace("_", " "), date].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full shrink-0"
                            style={{
                              background: b.status === "confirmed" ? "#000000" : "#f3f4f6",
                              color:      b.status === "confirmed" ? "#f9fafb"  : "#6b7280",
                            }}
                          >
                            {b.status || "pending"}
                          </span>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => navigate("/booking")}
                      className="mt-auto text-xs font-medium hover:underline"
                      style={{ color: "#374151" }}
                    >
                      View all bookings →
                    </button>
                  </>
                )}
              </div>
            </Widget>

            <Widget title="Quick Access" style={{ minHeight: "220px" }}>
              <div className="h-full p-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {FEATURES.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => f.path && navigate(f.path)}
                      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:shadow-sm"
                      style={{ background: "rgba(0,0,0,0.035)", border: "1px solid rgba(0,0,0,0.08)" }}
                    >
                      <span
                        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: f.accent ?? "rgba(0,0,0,0.12)" }}
                      >
                        {f.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-tight truncate" style={{ color: "#111827" }}>
                          {f.label}
                        </p>
                        <p className="text-[10px] leading-tight truncate mt-0.5" style={{ color: "#6b7280" }}>
                          {f.sub}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity"
                        style={{ color: "#374151" }}
                      >
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Widget>

            {/* ── ROW 3 · To-Do (col 1) + Calendar (col 2-3) ──────────────── */}
            <Widget title="To-Do" style={{ minHeight: "220px" }}>
              <TodoWidget />
            </Widget>

            <Widget title="Calendar" className="col-span-2" style={{ minHeight: "220px" }}>
              <div className="h-full p-4">
                <MiniCalendar events={calendarEvents} />
              </div>
            </Widget>

            {/* ── ROW 4 · Local Info (col 1) + Booking Summary (col 2-3) ──── */}
            <Widget title="Local Info" style={{ minHeight: "260px" }}>
              <LocalInfoWidget />
            </Widget>

            <Widget title="Booking Summary" className="col-span-2" style={{ minHeight: "260px" }}>
              <BookingSummaryWidget bookings={upcomingBookings} />
            </Widget>

          </div>
        </main>
      </div>

      {/* ══ CREATE TRIP MODAL ════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ background: "#fbfbf2" }}>
            <h3 className="text-xl font-bold mb-1" style={{ color: "#000000" }}>Create New Trip</h3>
            <p className="text-sm mb-5" style={{ color: "#6b7280" }}>Give your adventure a name and get started.</p>

            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#000000" }}>
                  Trip Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="e.g., Europe Summer 2025"
                  className="w-full px-4 py-2.5 rounded-xl outline-none text-sm transition focus:ring-2 focus:ring-gray-700"
                  style={{ background: "#f3f4f6", color: "#000000", border: "1px solid #374151" }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#000000" }}>
                  Description <span className="font-normal" style={{ color: "#6b7280" }}>(optional)</span>
                </label>
                <textarea
                  value={newTripDescription}
                  onChange={(e) => setNewTripDescription(e.target.value)}
                  placeholder="Where are you going and with who?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl outline-none resize-none text-sm transition focus:ring-2 focus:ring-gray-700"
                  style={{ background: "#f3f4f6", color: "#000000", border: "1px solid #374151" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#000000" }}>
                  Invite Members <span className="font-normal" style={{ color: "#6b7280" }}>(optional)</span>
                </label>
                <div
                  className="rounded-xl overflow-y-auto"
                  style={{ border: "1px solid #374151", background: "#f3f4f6", maxHeight: 140 }}
                >
                  {availableUsers.length === 0 ? (
                    <p className="px-3 py-2 text-xs" style={{ color: "#6b7280" }}>No users available</p>
                  ) : (
                    availableUsers.map((u) => {
                      const selected = selectedInvitees.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm"
                          style={{ borderBottom: "1px solid #e5e7eb" }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvitees((prev) => [...prev, u.id]);
                              } else {
                                setSelectedInvitees((prev) => prev.filter((id) => id !== u.id));
                              }
                            }}
                          />
                          <span style={{ color: "#111827" }}>{u.username || u.email}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {createError && <p className="text-sm text-red-500">{createError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition hover:bg-gray-700 disabled:opacity-50"
                  style={{ background: "#000000", color: "#f9fafb" }}
                >
                  {creating ? "Creating…" : "Create Trip"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedInvitees([]);
                  }}
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition hover:bg-gray-200"
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #374151" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MEMBERS MODAL ════════════════════════════════════════════════════ */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ background: "#fbfbf2" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "#160f29" }}>{selectedGroup.name}</h3>
                <p className="text-sm mt-0.5" style={{ color: "#5c6b73" }}>Group members</p>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-xl transition"
                style={{ color: "#5c6b73" }}
              >
                ×
              </button>
            </div>

            {loadingMembers ? (
              <p className="text-sm py-6 text-center" style={{ color: "#5c6b73" }}>Loading members…</p>
            ) : members.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "#5c6b73" }}>No members found.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3.5 rounded-xl hover:bg-black/5 transition"
                    style={{ border: "1px solid #d1d1c7" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ background: "#e8e8e0", color: "#5c6b73" }}
                      >
                        {(member.username || member.email || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: "#160f29" }}>
                          {member.username || member.email || member.user_id}
                        </p>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: member.role === "leader" ? "rgba(163,230,53,0.15)" : "#e8e8e0",
                            color:      member.role === "leader" ? "#183a37"               : "#5c6b73",
                          }}
                        >
                          {member.role === "leader" ? "👑 Leader" : "Member"}
                        </span>
                      </div>
                    </div>
                    {selectedGroup.my_role === "leader" &&
                      member.role !== "leader" &&
                      member.user_id !== user?.id && (
                        <button
                          onClick={() => handleMakeLeader(selectedGroup.group_id, member.user_id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-80"
                          style={{ background: "#183a37", color: "#fbfbf2" }}
                        >
                          Make Leader
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowMembersModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl font-medium text-sm transition hover:bg-black/5"
              style={{ background: "#e8e8e0", color: "#160f29" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
