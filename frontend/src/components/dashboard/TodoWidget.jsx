import { useState } from "react";

// Placeholder data — replaced when the full to-do page is built
const MOCK_TODOS = [
  { id: 1, text: "Book hotel in Paris",        done: true  },
  { id: 2, text: "Confirm flight tickets",     done: false },
  { id: 3, text: "Pack travel documents",      done: false },
  { id: 4, text: "Exchange currency",          done: false },
  { id: 5, text: "Share itinerary with group", done: false },
];

export default function TodoWidget() {
  const [todos, setTodos] = useState(MOCK_TODOS);
  const toggle = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const done  = todos.filter((t) => t.done).length;
  const total = todos.length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: "#6b7280" }}>{done}/{total} completed</p>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: done === total ? "#000000" : "#f3f4f6",
            color:      done === total ? "#ffffff"  : "#6b7280",
          }}
        >
          {done === total ? "All done! 🎉" : "In progress"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: "#e5e7eb" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(done / total) * 100}%`, background: "#000000" }}
        />
      </div>

      {/* Todo list */}
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {todos.map((todo) => (
          <button
            key={todo.id}
            onClick={() => toggle(todo.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-black/5 active:scale-[0.99] transition-all"
            style={{ border: "1px solid rgba(0,0,0,0.07)" }}
          >
            <span
              className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: todo.done ? "#000000" : "#d1d5db",
                background:  todo.done ? "#000000"  : "transparent",
              }}
            >
              {todo.done && (
                <span style={{ color: "#ffffff", fontSize: "9px", lineHeight: 1 }}>✓</span>
              )}
            </span>
            <span
              className="text-sm truncate transition-all"
              style={{
                color:          todo.done ? "#9ca3af" : "#111827",
                textDecoration: todo.done ? "line-through" : "none",
              }}
            >
              {todo.text}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] mt-2 shrink-0" style={{ color: "#9ca3af" }}>
        Full to-do page coming soon
      </p>
    </div>
  );
}
