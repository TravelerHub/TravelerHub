// ui.jsx — shared chat UI primitives, themed to match Dashboard.

// Per-name avatar palette so different members get distinct (but stable) colors,
// like Telegram. Uses a simple string hash so the same name always picks the
// same color across renders/sessions.
const AVATAR_COLORS = [
  "#183a37", // dark teal (brand)
  "#1e3a5f", // navy
  "#2d1b4e", // plum
  "#3b1f1f", // wine
  "#3b2d00", // mustard
  "#1a3320", // forest
  "#4a1942", // mulberry
  "#160f29", // deep dark
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarColorFor(name) {
  return AVATAR_COLORS[hashString(name || "?") % AVATAR_COLORS.length];
}

export function Avatar({ name, size = "md", color }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-9 w-9 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-full font-bold text-white select-none ${sizes[size] || sizes.md}`}
      style={{ background: color || avatarColorFor(name) }}
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

// ── Time helpers shared by ConversationList + bubbles ────────────────────────

export function formatTimeShort(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// "now" / "5m" / "2h" / "yesterday" / "Mar 14" — Telegram-ish brevity
export function relativeShort(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24 && new Date(now).getDate() === d.getDate()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    yesterday.getFullYear() === d.getFullYear() &&
    yesterday.getMonth() === d.getMonth() &&
    yesterday.getDate() === d.getDate()
  ) return "yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}
