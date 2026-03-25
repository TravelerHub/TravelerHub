// ui.jsx — shared chat UI primitives, themed to match Dashboard

export function Avatar({ name, size = "md" }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-full font-bold text-white select-none ${sizes[size]}`}
      style={{ background: "#183a37" }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}

export function Panel({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{ background: "#ffffff", border: "1px solid #ebebeb" }}
    >
      {children}
    </div>
  );
}

export function RowButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
      style={{
        background: active ? "#000000" : "transparent",
        color: active ? "#ffffff" : "inherit",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

export function Badge({ children }) {
  return (
    <span
      className="ml-auto shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "#f3f4f6", color: "#6b7280" }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 gap-1">
      <p className="text-sm font-semibold" style={{ color: "#374151" }}>{title}</p>
      {subtitle && <p className="text-xs" style={{ color: "#9ca3af" }}>{subtitle}</p>}
    </div>
  );
}
