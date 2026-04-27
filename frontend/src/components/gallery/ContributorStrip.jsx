import { useMemo } from "react";

// Per-name avatar tint so contributors look distinct (mirrors the chat palette).
const COLORS = [
  "#183a37", "#1e3a5f", "#2d1b4e", "#3b1f1f",
  "#3b2d00", "#1a3320", "#4a1942", "#160f29",
];
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(h) % COLORS.length];
}
function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}

/**
 * Stories-ribbon style horizontal strip of contributors.
 *
 * Looks like Instagram Stories: circular avatars in a horizontal scroll, the
 * active one wrapped in a teal ring. Tapping a circle filters the gallery to
 * that contributor; the leftmost "Everyone" pill clears the filter.
 *
 * `photos` is the current photos array — we count who shot what for the badges.
 */
export default function ContributorStrip({
  photos = [],
  selectedContributorId,
  onSelect,
}) {
  const contributors = useMemo(() => {
    const map = new Map();
    for (const p of photos) {
      const id = p.uploaded_by || p.uploaded_by_id || p.uploader_id || p.uploaded_by_name;
      if (!id) continue;
      const existing = map.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(id, {
          id,
          name: p.uploaded_by_name || "Member",
          count: 1,
          avatarUrl: p.uploaded_by_avatar_url || null,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [photos]);

  if (contributors.length === 0) return null;

  return (
    <div className="px-5 sm:px-8 pt-4 pb-2">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
        {/* "Everyone" — clears the filter */}
        <Bubble
          label="All"
          subtitle={`${photos.length}`}
          active={!selectedContributorId}
          onClick={() => onSelect?.(null)}
          isAll
        />

        {contributors.map((c) => (
          <Bubble
            key={c.id}
            label={c.name}
            subtitle={`${c.count} photo${c.count === 1 ? "" : "s"}`}
            active={selectedContributorId === c.id}
            onClick={() => onSelect?.(c.id)}
            avatarUrl={c.avatarUrl}
            tint={colorFor(c.name)}
            initials={initials(c.name)}
          />
        ))}
      </div>
    </div>
  );
}

function Bubble({
  label,
  subtitle,
  active,
  onClick,
  avatarUrl,
  tint,
  initials: ini,
  isAll = false,
}) {
  // Outer ring uses the brand teal when active (Instagram uses a gradient; we
  // use a solid teal for a cleaner, more on-brand look).
  const ringColor = active ? "#c8a96e" : "transparent"; // warm gold accent

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 group"
      title={`${label}${subtitle ? ` · ${subtitle}` : ""}`}
    >
      <span
        className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-active:scale-95"
        style={{
          padding: 2.5,
          background: ringColor,
          boxShadow: active ? "0 0 0 1px rgba(200,169,110,0.5)" : "none",
        }}
      >
        <span
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
          style={{
            background: isAll ? "#fbfbf2" : tint,
            color: isAll ? "#160f29" : "#fbfbf2",
            border: active ? "2px solid #fbfbf2" : "none",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={label} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : isAll ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 19a6 6 0 0 1 12 0" />
              <circle cx="17" cy="7" r="2.3" />
              <path d="M14 17a4.5 4.5 0 0 1 7-3.7" />
            </svg>
          ) : (
            ini
          )}
        </span>
      </span>
      <span
        className="text-[10px] font-semibold leading-tight max-w-[64px] truncate"
        style={{ color: active ? "#fbfbf2" : "rgba(251,251,242,0.65)" }}
      >
        {label}
      </span>
    </button>
  );
}
