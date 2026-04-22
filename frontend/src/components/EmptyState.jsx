// EmptyState — reusable centered empty-state card
// Props: icon (emoji string), title, subtitle,
//   action: { label, onClick }   (new API)
//   actionLabel + onAction       (legacy API, kept for backward compat)

export default function EmptyState({ icon, title, subtitle, action, actionLabel, onAction }) {
  const btnLabel   = action?.label   ?? actionLabel;
  const btnHandler = action?.onClick ?? onAction;

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-8">
      {/* Icon circle */}
      {icon && (
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl"
          style={{ background: "rgba(24,58,55,0.4)" }}
        >
          {icon}
        </div>
      )}

      {/* Title */}
      {title && (
        <p className="text-xl font-bold mb-2" style={{ color: "#160f29" }}>
          {title}
        </p>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className="text-sm max-w-xs mb-6" style={{ color: "#5c6b73" }}>
          {subtitle}
        </p>
      )}

      {/* Optional CTA button */}
      {btnLabel && btnHandler && (
        <button
          onClick={btnHandler}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-95"
          style={{ background: "#c8a96e", color: "#160f29" }}
        >
          {btnLabel}
        </button>
      )}
    </div>
  );
}
