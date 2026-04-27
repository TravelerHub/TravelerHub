// EmptyState — reusable centered empty-state card
// Props: icon — either an emoji string OR a ReactNode (e.g. an SVG)
//        tone — "neutral" | "lock" | "warning" | "celebrate" — picks bg color
//        title, subtitle,
//        action: { label, onClick }   (new API)
//        actionLabel + onAction       (legacy API, kept for backward compat)

const TONE_BG = {
  neutral:   "rgba(24,58,55,0.10)",   // soft teal
  lock:      "rgba(160,120,60,0.16)", // warm gold tint
  warning:   "rgba(220,120,40,0.14)", // amber tint
  celebrate: "rgba(200,169,110,0.18)",// gold celebrate
};

export default function EmptyState({ icon, tone = "neutral", title, subtitle, action, actionLabel, onAction }) {
  const btnLabel   = action?.label   ?? actionLabel;
  const btnHandler = action?.onClick ?? onAction;
  const isNode = icon && typeof icon !== "string";

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-8">
      {/* Icon circle — emoji renders text-sized; SVG nodes render at their own size */}
      {icon && (
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isNode ? "" : "text-4xl"}`}
          style={{ background: TONE_BG[tone] || TONE_BG.neutral }}
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
