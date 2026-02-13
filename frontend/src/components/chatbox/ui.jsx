// ui.js - shared UI pieces so styles aren't duplicated

export function Avatar({ name, size = "md" }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gray-200 text-gray-700 font-semibold ${sizes[size]}`}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}

export function Panel({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function RowButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left",
        "hover:bg-gray-50 transition",
        active ? "bg-gray-100" : "",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

export function Badge({ children }) {
  return (
    <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-6">
      <div className="text-lg font-semibold text-gray-800">{title}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
