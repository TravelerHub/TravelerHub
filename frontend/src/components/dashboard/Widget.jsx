// Shared card wrapper used by every dashboard widget
export default function Widget({ title, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{ background: "#ffffff" }}
    >
      {title && (
        <div
          className="px-5 py-3 shrink-0 border-b"
          style={{ borderColor: "#374151" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#374151" }}
          >
            {title}
          </p>
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
