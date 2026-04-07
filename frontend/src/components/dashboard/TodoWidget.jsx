import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "travel_todos";

const loadTodos = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const isOverdue = (dateStr, done) => {
  if (!dateStr || done) return false;
  return new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
};

export default function TodoWidget() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);

  // Sync from localStorage on mount and whenever storage changes
  useEffect(() => {
    setTodos(loadTodos());
    const onStorage = () => setTodos(loadTodos());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = (id) => {
    const updated = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTodos(updated);
  };

  // Show at most 5 active (non-done) tasks, sorted: overdue first, then by due date
  const active = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      const aOver = isOverdue(a.dueDate, a.done);
      const bOver = isOverdue(b.dueDate, b.done);
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return 0;
    })
    .slice(0, 5);

  const done  = todos.filter((t) => t.done).length;
  const total = todos.length;
  const overdueCount = todos.filter((t) => isOverdue(t.dueDate, t.done)).length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
          {done}/{total} completed
        </p>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: done === total && total > 0 ? "#000000" : "#f3f4f6",
            color:      done === total && total > 0 ? "#ffffff"  : "#6b7280",
          }}
        >
          {done === total && total > 0 ? "All done! 🎉" : overdueCount > 0 ? `${overdueCount} overdue` : "In progress"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: "#e5e7eb" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: total === 0 ? "0%" : `${(done / total) * 100}%`,
            background: done === total && total > 0 ? "#22c55e" : "#000000",
          }}
        />
      </div>

      {/* Todo list */}
      {active.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <span className="text-2xl">{total === 0 ? "📋" : "🎉"}</span>
          <p className="text-xs text-center" style={{ color: "#9ca3af" }}>
            {total === 0 ? "No tasks yet" : "All tasks complete!"}
          </p>
          <button
            onClick={() => navigate("/todo")}
            className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:bg-gray-700"
            style={{ background: "#000000", color: "#f9fafb" }}
          >
            {total === 0 ? "Add tasks" : "View all"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
            {active.map((todo) => {
              const over = isOverdue(todo.dueDate, todo.done);
              return (
                <button
                  key={todo.id}
                  onClick={() => toggle(todo.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-black/5 active:scale-[0.99] transition-all"
                  style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: "#d1d5db", background: "transparent" }}
                  />
                  <span
                    className="text-sm truncate flex-1 transition-all"
                    style={{ color: over ? "#ef4444" : "#111827" }}
                  >
                    {todo.text}
                  </span>
                  {over && (
                    <span className="text-[10px] shrink-0" style={{ color: "#ef4444" }}>⚠️</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/todo")}
            className="mt-2 shrink-0 text-xs font-medium hover:underline text-right"
            style={{ color: "#374151" }}
          >
            View all {total} tasks →
          </button>
        </>
      )}
    </div>
  );
}
