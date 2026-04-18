import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import MiniCalendar from "../../components/dashboard/MiniCalendar.jsx";
import { API_BASE } from "../../config";
import { logActivity } from "../../components/ActivityFeed.jsx";

// ── Color palette (matches Dashboard / Booking)
// #000000  sidebar bg
// #f3f4f6  page bg
// #ffffff  card bg
// #160f29  deep dark headings
// #6b7280  secondary text
// #374151  borders / muted
// #183a37  dark teal accent
// #fbfbf2  off-white

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "travel_todos";

const CATEGORIES = [
  { id: "booking",   label: "Booking",   icon: "✈️",  color: "#1e3a5f" },
  { id: "packing",   label: "Packing",   icon: "🎒",  color: "#183a37" },
  { id: "documents", label: "Documents", icon: "📄",  color: "#4a1942" },
  { id: "finance",   label: "Finance",   icon: "💰",  color: "#3b2d00" },
  { id: "activities",label: "Activities",icon: "🎡",  color: "#2d1b4e" },
  { id: "other",     label: "Other",     icon: "📋",  color: "#374151" },
];

const PRIORITIES = [
  { id: "high",   label: "High",   color: "#ef4444" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "low",    label: "Low",    color: "#22c55e" },
];

const FILTER_TABS = ["All", "Today", "This Week", "Completed"];

// Pre-built travel checklists
const TRAVEL_TEMPLATES = [
  {
    id: "pre-trip",
    label: "Pre-Trip Essentials",
    icon: "🗓️",
    tasks: [
      { text: "Book hotel / accommodation",        category: "booking",   priority: "high"   },
      { text: "Purchase flight tickets",           category: "booking",   priority: "high"   },
      { text: "Arrange airport transfer / car",    category: "booking",   priority: "medium" },
      { text: "Purchase travel insurance",         category: "documents", priority: "high"   },
      { text: "Notify bank of travel dates",       category: "finance",   priority: "medium" },
      { text: "Exchange currency or load card",    category: "finance",   priority: "medium" },
      { text: "Share itinerary with emergency contact", category: "other", priority: "low"  },
    ],
  },
  {
    id: "packing",
    label: "Packing Checklist",
    icon: "🎒",
    tasks: [
      { text: "Passport / ID",                    category: "documents", priority: "high"   },
      { text: "Travel adapter / chargers",        category: "packing",   priority: "medium" },
      { text: "Medication + first-aid kit",       category: "packing",   priority: "high"   },
      { text: "Sunscreen + toiletries",           category: "packing",   priority: "low"    },
      { text: "Comfortable walking shoes",        category: "packing",   priority: "medium" },
      { text: "Weather-appropriate clothing",     category: "packing",   priority: "medium" },
      { text: "Snacks for transit",               category: "packing",   priority: "low"    },
    ],
  },
  {
    id: "documents",
    label: "Document Checklist",
    icon: "📄",
    tasks: [
      { text: "Check passport expiry (6+ months)", category: "documents", priority: "high"  },
      { text: "Apply for visa if required",        category: "documents", priority: "high"  },
      { text: "Print / save boarding passes",      category: "documents", priority: "high"  },
      { text: "Save hotel confirmation",           category: "documents", priority: "medium"},
      { text: "Travel insurance card / details",   category: "documents", priority: "medium"},
      { text: "Emergency contacts list",           category: "documents", priority: "low"   },
    ],
  },
  {
    id: "activities",
    label: "Activities & Exploration",
    icon: "🎡",
    tasks: [
      { text: "Research top attractions at destination", category: "activities", priority: "low"  },
      { text: "Book tours / experiences in advance",     category: "activities", priority: "medium"},
      { text: "Find recommended restaurants",            category: "activities", priority: "low"  },
      { text: "Download offline maps",                   category: "activities", priority: "medium"},
      { text: "Check local events during stay",          category: "activities", priority: "low"  },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => `t_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const loadTodos  = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const saveTodos  = (todos) => localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

function getActiveTripId() {
  return localStorage.getItem("active_group_id") || localStorage.getItem("activeGroupId") || null;
}

// Normalize a server todo to the local shape used in state
function fromServer(t) {
  return {
    id:        t.id,
    text:      t.text,
    done:      t.done,
    priority:  t.priority,
    category:  t.category,
    dueDate:   t.due_date || null,
    createdAt: t.created_at,
    _server:   true,
  };
}

const isToday    = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth()    === t.getMonth()    &&
    d.getDate()     === t.getDate();
};
const isThisWeek = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  const start = new Date(t); start.setDate(t.getDate() - t.getDay());
  const end   = new Date(start); end.setDate(start.getDate() + 7);
  return d >= start && d <= end;
};
const isOverdue  = (dateStr, done) => {
  if (!dateStr || done) return false;
  return new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
};
const fmtDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];
const priOf = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

// ── Component ──────────────────────────────────────────────────────────────────
export default function Todo() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [todos,       setTodos]       = useState(loadTodos);
  const [activeFilter, setFilter]     = useState("All");
  const [activeCategory, setCategory] = useState("all");
  const [searchQuery, setSearch]      = useState("");
  const [editingId,   setEditingId]   = useState(null);
  const [editText,    setEditText]    = useState("");
  const [syncing,     setSyncing]     = useState(false);
  const [syncMode,    setSyncMode]    = useState(false);   // true = connected to server

  // Add-form state
  const [newText,     setNewText]     = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newCategory, setNewCategory] = useState("other");
  const [newDueDate,  setNewDueDate]  = useState("");
  const [showForm,    setShowForm]    = useState(false);

  // Template state
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [templateAdded,    setTemplateAdded]    = useState({});

  // Calendar selected date
  const [selectedDate, setSelectedDate] = useState(null);

  const inputRef = useRef(null);
  const tripId   = getActiveTripId();

  // ── Server sync ───────────────────────────────────────────────────────────
  const fetchServerTodos = useCallback(async () => {
    if (!tripId || !getToken()) return;
    try {
      setSyncing(true);
      const res = await fetch(`${API_BASE}/todos/?trip_id=${tripId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = data.map(fromServer);
        setTodos(normalized);
        saveTodos(normalized);
        setSyncMode(true);
      }
    } catch { /* offline — use localStorage */ }
    finally { setSyncing(false); }
  }, [tripId]);

  useEffect(() => { fetchServerTodos(); }, [fetchServerTodos]);

  // ── Persist locally whenever todos change ──────────────────────────────────
  useEffect(() => { saveTodos(todos); }, [todos]);

  // Focus new-todo input when form opens
  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total     = todos.length;
  const doneCount = todos.filter((t) => t.done).length;
  const todayCount = todos.filter((t) => isToday(t.dueDate) && !t.done).length;
  const overdueCount = todos.filter((t) => isOverdue(t.dueDate, t.done)).length;
  const progress  = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  // Todos with due dates — for the calendar dot indicators
  const calendarEvents = todos.map((t) => ({ date: t.dueDate })).filter((e) => e.date);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = todos;

    // Tab filter
    if (activeFilter === "Today")     list = list.filter((t) => !t.done && isToday(t.dueDate));
    if (activeFilter === "This Week") list = list.filter((t) => !t.done && isThisWeek(t.dueDate));
    if (activeFilter === "Completed") list = list.filter((t) => t.done);
    if (activeFilter === "All")       list = list.filter((t) => !t.done);

    // Category sidebar filter
    if (activeCategory !== "all") list = list.filter((t) => t.category === activeCategory);

    // Date click on calendar
    if (selectedDate) {
      list = list.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return (
          d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth()    === selectedDate.getMonth()    &&
          d.getDate()     === selectedDate.getDate()
        );
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.text.toLowerCase().includes(q));
    }

    // Sort: overdue first, then by due date, undated last
    return [...list].sort((a, b) => {
      const aOver = isOverdue(a.dueDate, a.done);
      const bOver = isOverdue(b.dueDate, b.done);
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [todos, activeFilter, activeCategory, searchQuery, selectedDate]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addTodo = async (e) => {
    e?.preventDefault();
    if (!newText.trim()) return;

    // Optimistic local add
    const tempId = uid();
    const localTodo = {
      id: tempId, text: newText.trim(), done: false,
      priority: newPriority, category: newCategory,
      dueDate: newDueDate || null, createdAt: new Date().toISOString(),
    };
    setTodos((prev) => [localTodo, ...prev]);
    setNewText(""); setNewDueDate(""); setShowForm(false);

    if (syncMode && tripId && getToken()) {
      try {
        const res = await fetch(`${API_BASE}/todos/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            trip_id: tripId, text: localTodo.text,
            priority: localTodo.priority, category: localTodo.category,
            due_date: localTodo.dueDate || null,
          }),
        });
        if (res.ok) {
          const server = await res.json();
          // Replace the temp id with the real server id
          setTodos((prev) => prev.map((t) => t.id === tempId ? fromServer(server) : t));
          logActivity(tripId, "added_todo", localTodo.text);
        }
      } catch { /* keep local copy */ }
    }
  };

  const toggleTodo = async (id) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newDone = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: newDone } : t)));

    if (syncMode && getToken()) {
      try {
        await fetch(`${API_BASE}/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ done: newDone }),
        });
        if (newDone) logActivity(tripId, "checked_task", todo.text);
      } catch { /* keep local state */ }
    }
  };

  const deleteTodo = async (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (syncMode && getToken()) {
      try {
        await fetch(`${API_BASE}/todos/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      } catch { /* already removed locally */ }
    }
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text: editText.trim() } : t)));
    setEditingId(null);

    if (syncMode && getToken()) {
      try {
        await fetch(`${API_BASE}/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ text: editText.trim() }),
        });
      } catch { /* local update already applied */ }
    }
  };

  const clearCompleted = async () => {
    const completed = todos.filter((t) => t.done);
    setTodos((prev) => prev.filter((t) => !t.done));
    if (syncMode && getToken()) {
      await Promise.all(completed.map((t) =>
        fetch(`${API_BASE}/todos/${t.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` },
        }).catch(() => {})
      ));
    }
  };

  // Add a full template as todos
  const addTemplate = async (template) => {
    const now = new Date().toISOString();
    const newTodos = template.tasks.map((task) => ({
      id: uid(), text: task.text, done: false,
      priority: task.priority, category: task.category,
      dueDate: null, createdAt: now,
    }));
    setTodos((prev) => [...newTodos, ...prev]);
    setTemplateAdded((p) => ({ ...p, [template.id]: true }));
    setTimeout(() => setTemplateAdded((p) => ({ ...p, [template.id]: false })), 2000);

    if (syncMode && tripId && getToken()) {
      await Promise.all(newTodos.map((task) =>
        fetch(`${API_BASE}/todos/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            trip_id: tripId, text: task.text,
            priority: task.priority, category: task.category,
          }),
        }).catch(() => {})
      ));
      // Re-fetch to get real server ids
      fetchServerTodos();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ══ SIDEBAR ═════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>
            Trip Planner
          </p>
          <p className="font-bold text-lg leading-tight text-white">To-Do Hub</p>
        </div>

        {/* Category filter in sidebar */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          <p className="px-2 py-1 text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "#4b5563" }}>
            Pages
          </p>
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition hover:bg-white/10"
              style={{ color: "#9ca3af" }}
            >
              {item.label}
            </button>
          ))}

          <div className="my-2 border-t" style={{ borderColor: "#374151" }} />

          <p className="px-2 py-1 text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: "#4b5563" }}>
            Filter by Category
          </p>
          <button
            onClick={() => setCategory("all")}
            className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition`}
            style={{
              background: activeCategory === "all" ? "#ffffff" : "transparent",
              color:      activeCategory === "all" ? "#000000" : "#9ca3af",
            }}
          >
            📋 All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-white/10"
              style={{
                background: activeCategory === cat.id ? "#ffffff" : "transparent",
                color:      activeCategory === cat.id ? "#000000" : "#9ca3af",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </nav>

        {/* Stats footer */}
        <div className="px-4 pb-5 space-y-1.5">
          <div className="rounded-xl p-3 text-xs" style={{ background: "#111827" }}>
            <div className="flex justify-between mb-1.5">
              <span style={{ color: "#9ca3af" }}>Progress</span>
              <span className="font-bold" style={{ color: "#f9fafb" }}>{progress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "#374151" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: progress === 100 ? "#22c55e" : "#ffffff" }}
              />
            </div>
            <div className="mt-2 flex justify-between">
              <span style={{ color: "#6b7280" }}>{doneCount}/{total} done</span>
              {overdueCount > 0 && (
                <span style={{ color: "#ef4444" }}>{overdueCount} overdue</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-4" style={{ background: "#f3f4f6" }}>

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#160f29" }}>To-Do Hub</h2>
              <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "#6b7280" }}>
                {syncMode ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Synced with your group
                    {syncing && <span className="animate-pulse">…</span>}
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                    Saved locally — select a trip to sync
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick stats pills */}
              {todayCount > 0 && (
                <span
                  className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background: "#1e3a5f", color: "#93c5fd" }}
                >
                  {todayCount} due today
                </span>
              )}
              {overdueCount > 0 && (
                <span
                  className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ background: "#3b0000", color: "#fca5a5" }}
                >
                  {overdueCount} overdue
                </span>
              )}
              <button
                onClick={() => { setShowForm((v) => !v); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
                style={{ background: "#000000", color: "#f9fafb" }}
              >
                + Add Task
              </button>
            </div>
          </div>

          {/* ── Two-column body ──────────────────────────────────────────── */}
          <div className="flex gap-4">

            {/* ── LEFT: Todo list ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Add form */}
              {showForm && (
                <div
                  className="rounded-2xl p-4 shadow-sm"
                  style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
                >
                  <form onSubmit={addTodo} className="space-y-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="What needs to be done? (e.g., Book hotel in Tokyo)"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition focus:ring-2"
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        color: "#111827",
                        "--tw-ring-color": "#374151",
                      }}
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Priority */}
                      <div className="flex gap-1">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setNewPriority(p.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition"
                            style={{
                              background: newPriority === p.id ? p.color : "#f3f4f6",
                              color:      newPriority === p.id ? "#ffffff" : "#6b7280",
                              border: `1px solid ${newPriority === p.id ? p.color : "#e5e7eb"}`,
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="w-px h-5 self-center" style={{ background: "#e5e7eb" }} />

                      {/* Category */}
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium outline-none"
                        style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                        ))}
                      </select>

                      {/* Due date */}
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="px-2.5 py-1 rounded-lg text-xs outline-none"
                        style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                      />

                      <div className="flex-1" />

                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-gray-100"
                        style={{ color: "#6b7280" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newText.trim()}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-800 disabled:opacity-40"
                        style={{ background: "#000000", color: "#ffffff" }}
                      >
                        Add Task
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Search + filter bar */}
              <div
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                {/* Search */}
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tasks…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#111827" }}
                  />
                </div>

                <div className="w-px h-6" style={{ background: "#e5e7eb" }} />

                {/* Filter tabs */}
                <div className="flex gap-1">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setFilter(tab); setSelectedDate(null); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      style={{
                        background: activeFilter === tab ? "#000000" : "#f3f4f6",
                        color:      activeFilter === tab ? "#ffffff" : "#6b7280",
                      }}
                    >
                      {tab}
                      {tab === "Today"     && todayCount   > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                          style={{ background: "#1e3a5f", color: "#93c5fd" }}>{todayCount}</span>
                      )}
                      {tab === "All" && overdueCount > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                          style={{ background: "#3b0000", color: "#fca5a5" }}>{overdueCount}</span>
                      )}
                    </button>
                  ))}
                </div>

                {activeFilter === "Completed" && doneCount > 0 && (
                  <>
                    <div className="w-px h-6" style={{ background: "#e5e7eb" }} />
                    <button
                      onClick={clearCompleted}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-red-50"
                      style={{ color: "#ef4444" }}
                    >
                      Clear all
                    </button>
                  </>
                )}
              </div>

              {/* Selected date indicator */}
              {selectedDate && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                >
                  <span style={{ color: "#92400e" }}>
                    Showing tasks due on{" "}
                    <strong>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="ml-auto text-xs font-medium hover:underline"
                    style={{ color: "#92400e" }}
                  >
                    Clear ×
                  </button>
                </div>
              )}

              {/* Todo list */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <span className="text-4xl">
                      {activeFilter === "Completed" ? "🎉" : "📋"}
                    </span>
                    <p className="font-semibold text-sm" style={{ color: "#374151" }}>
                      {activeFilter === "Completed"
                        ? "No completed tasks yet"
                        : searchQuery
                        ? "No tasks match your search"
                        : "No tasks here — add one above!"}
                    </p>
                    {!showForm && activeFilter !== "Completed" && !searchQuery && (
                      <button
                        onClick={() => setShowForm(true)}
                        className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold transition hover:bg-gray-700"
                        style={{ background: "#000000", color: "#ffffff" }}
                      >
                        + Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#f3f4f6" }}>
                    {filtered.map((todo) => {
                      const cat  = catOf(todo.category);
                      const pri  = priOf(todo.priority);
                      const over = isOverdue(todo.dueDate, todo.done);
                      const isEditing = editingId === todo.id;

                      return (
                        <div
                          key={todo.id}
                          className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-gray-50"
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleTodo(todo.id)}
                            className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                            style={{
                              borderColor: todo.done ? "#000000" : "#d1d5db",
                              background:  todo.done ? "#000000"  : "transparent",
                            }}
                          >
                            {todo.done && (
                              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  autoFocus
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit(todo.id);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  className="flex-1 px-2 py-1 rounded-lg text-sm outline-none"
                                  style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#111827" }}
                                />
                                <button
                                  onClick={() => saveEdit(todo.id)}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold"
                                  style={{ background: "#000000", color: "#ffffff" }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 rounded-lg text-xs"
                                  style={{ color: "#6b7280" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <p
                                className="text-sm leading-snug"
                                style={{
                                  color:          todo.done ? "#9ca3af" : over ? "#ef4444" : "#111827",
                                  textDecoration: todo.done ? "line-through" : "none",
                                }}
                              >
                                {todo.text}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {/* Priority dot */}
                              <span
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: `${pri.color}18`, color: pri.color }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: pri.color }} />
                                {pri.label}
                              </span>

                              {/* Category */}
                              <span
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: `${cat.color}22`, color: "#374151" }}
                              >
                                {cat.icon} {cat.label}
                              </span>

                              {/* Due date */}
                              {todo.dueDate && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                                  style={{
                                    background: over ? "#fef2f2" : isToday(todo.dueDate) ? "#fffbeb" : "#f3f4f6",
                                    color:      over ? "#ef4444" : isToday(todo.dueDate) ? "#d97706" : "#6b7280",
                                  }}
                                >
                                  {over ? "⚠️ " : isToday(todo.dueDate) ? "📅 " : "🗓️ "}
                                  {fmtDate(todo.dueDate)}
                                  {over && " (overdue)"}
                                  {!over && isToday(todo.dueDate) && " (today)"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions (visible on hover) */}
                          <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(todo)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-gray-200"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTodo(todo.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-red-50"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Calendar + Templates ──────────────────────────── */}
            <div className="w-72 shrink-0 flex flex-col gap-4">

              {/* Mini Calendar */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#f3f4f6" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                    Calendar
                  </p>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-[10px] font-medium hover:underline"
                      style={{ color: "#6b7280" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <ClickableMiniCalendar
                    events={calendarEvents}
                    selectedDate={selectedDate}
                    onDateClick={(d) => {
                      setSelectedDate((prev) =>
                        prev?.toDateString() === d.toDateString() ? null : d
                      );
                      setFilter("All");
                    }}
                  />
                </div>
                <div className="px-4 pb-3">
                  <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                    Click a date to filter tasks by due date.
                  </p>
                </div>
              </div>

              {/* Overall progress card */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#374151" }}>
                  Overview
                </p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Total",     value: total,        color: "#374151" },
                    { label: "Done",      value: doneCount,    color: "#22c55e" },
                    { label: "Remaining", value: total - doneCount, color: "#6b7280" },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: "#f9fafb" }}>
                      <p className="text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] mt-1 font-medium" style={{ color: "#9ca3af" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progress}%`,
                      background: progress === 100 ? "#22c55e" : "#000000",
                    }}
                  />
                </div>
                <p className="text-xs mt-2 font-medium text-right" style={{ color: "#6b7280" }}>
                  {progress}% complete
                </p>
              </div>

              {/* Travel Templates */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: "#f3f4f6" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                    Travel Templates
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>
                    Bulk-add common checklists instantly
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: "#f9fafb" }}>
                  {TRAVEL_TEMPLATES.map((tmpl) => (
                    <div key={tmpl.id}>
                      <button
                        onClick={() => setExpandedTemplate(
                          expandedTemplate === tmpl.id ? null : tmpl.id
                        )}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                      >
                        <span className="text-lg shrink-0">{tmpl.icon}</span>
                        <span className="flex-1 text-sm font-medium" style={{ color: "#111827" }}>
                          {tmpl.label}
                        </span>
                        <span className="text-xs" style={{ color: "#9ca3af" }}>
                          {tmpl.tasks.length} tasks
                        </span>
                        <svg
                          className="w-4 h-4 shrink-0 transition-transform"
                          style={{
                            color: "#9ca3af",
                            transform: expandedTemplate === tmpl.id ? "rotate(180deg)" : "none",
                          }}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {expandedTemplate === tmpl.id && (
                        <div className="px-4 pb-3 space-y-1">
                          {tmpl.tasks.slice(0, 4).map((task, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "#6b7280" }}>
                              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: priOf(task.priority).color }} />
                              {task.text}
                            </div>
                          ))}
                          {tmpl.tasks.length > 4 && (
                            <p className="text-xs italic" style={{ color: "#9ca3af" }}>
                              +{tmpl.tasks.length - 4} more…
                            </p>
                          )}
                          <button
                            onClick={() => addTemplate(tmpl)}
                            disabled={templateAdded[tmpl.id]}
                            className="mt-2 w-full py-2 rounded-xl text-xs font-semibold transition"
                            style={{
                              background: templateAdded[tmpl.id] ? "#22c55e" : "#000000",
                              color: "#ffffff",
                            }}
                          >
                            {templateAdded[tmpl.id] ? "✓ Added!" : `Add all ${tmpl.tasks.length} tasks`}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Clickable Mini Calendar (extends MiniCalendar with click support) ─────────
const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function ClickableMiniCalendar({ events = [], selectedDate, onDateClick }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const isToday_ = (d) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const hasEvent = (d) =>
    events.some((e) => {
      if (!e.date) return false;
      const ed = new Date(e.date);
      return ed.getDate() === d && ed.getMonth() === month && ed.getFullYear() === year;
    });

  const isSelected = (d) =>
    selectedDate &&
    selectedDate.getDate() === d &&
    selectedDate.getMonth() === month &&
    selectedDate.getFullYear() === year;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 transition text-gray-400 text-lg">‹</button>
        <span className="font-semibold text-xs tracking-wide" style={{ color: "#160f29" }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 transition text-gray-400 text-lg">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-gray-300 py-1 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const today_    = isToday_(d);
          const event_    = hasEvent(d);
          const selected_ = isSelected(d);
          return (
            <button
              key={i}
              onClick={() => onDateClick(new Date(year, month, d))}
              className="relative text-center text-xs py-1.5 rounded-md transition hover:bg-black/10"
              style={{
                background: selected_
                  ? "#374151"
                  : today_
                  ? "#000000"
                  : "transparent",
                color: selected_ || today_
                  ? "#ffffff"
                  : event_
                  ? "#111827"
                  : "#6b7280",
                fontWeight: event_ || today_ || selected_ ? "600" : "400",
              }}
            >
              {d}
              {event_ && !today_ && !selected_ && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "#183a37" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
