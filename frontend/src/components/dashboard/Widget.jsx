// Shared card wrapper used by every dashboard widget. The caller-supplied
// `style` (typically `minHeight`) is now threaded through, so the card
// reserves its final footprint while loading and we avoid the CLS jolt
// that happened when widgets shrank to their skeleton content then jumped
// back to size on hydrate.
export default function Widget({ title, children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{ background: "#ffffff", ...style }}
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
