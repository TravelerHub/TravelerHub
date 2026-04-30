/**
 * Boarding-pass ticket — the reusable trip-at-a-glance surface.
 *
 * Two modes:
 *   - Default (full): from / to columns, dashed perforation, traveler
 *     avatars + status row. Used as the hero ornament on Landing and on
 *     trip-detail pages.
 *   - `compact`: single-line "LISBON · 19 JUN – 03 JUL · 6 travelers ▾"
 *     used as the persistent trip switcher header in the authed app.
 *
 * Avatars are stacked initials; pass {initials, color?} for each traveler.
 * `color` is optional and falls back to teal/clay/ink/teal-2 cycling so a
 * group of strangers gets a varied, deliberate-looking avatar row.
 */

const AVATAR_FALLBACK_COLORS = [
  "var(--teal)",
  "var(--clay)",
  "var(--ink)",
  "var(--teal-2)",
  "var(--sky)",
];

function Avatars({ travelers = [], extraCount = 0, max = 4 }) {
  const visible = travelers.slice(0, max);
  return (
    <div style={{ display: "flex" }}>
      {visible.map((t, i) => (
        <span
          key={i}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: t.color || AVATAR_FALLBACK_COLORS[i % AVATAR_FALLBACK_COLORS.length],
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 500,
            border: "2px solid var(--paper-2)",
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          {t.initials}
        </span>
      ))}
      {extraCount > 0 && (
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--ink-2)",
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 500,
            border: "2px solid var(--paper-2)",
            marginLeft: -8,
          }}
        >
          +{extraCount}
        </span>
      )}
    </div>
  );
}

/**
 * Compact one-liner — `LISBON · 19 JUN – 03 JUL · 6 travelers ▾`. Used as
 * the persistent trip switcher in the authed app header.
 */
export function TripTicketCompact({
  destination,
  dateRange,
  travelerCount,
  onClick,
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--rule)",
        background: "var(--paper-2)",
        color: "var(--ink)",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
      {...rest}
    >
      <span style={{ color: "var(--teal)", fontWeight: 500 }}>{destination}</span>
      {dateRange && (
        <>
          <span style={{ color: "var(--rule)" }}>·</span>
          <span style={{ color: "var(--ink-2)" }}>{dateRange}</span>
        </>
      )}
      {typeof travelerCount === "number" && (
        <>
          <span style={{ color: "var(--rule)" }}>·</span>
          <span style={{ color: "var(--ink-2)" }}>{travelerCount} travelers</span>
        </>
      )}
      {onClick && (
        <span aria-hidden="true" style={{ color: "var(--muted)" }}>▾</span>
      )}
    </button>
  );
}

/**
 * Full boarding-pass ticket — used for marketing hero, trip-detail header
 * cards, booking confirmation reuse, etc.
 *
 * Props are all optional so an empty / partial trip still renders cleanly
 * (placeholder dashes for missing fields rather than a JSX crash).
 */
export default function TripTicket({
  fromLabel = "From",
  fromValue = "—",
  fromMeta,
  toLabel = "To",
  toValue = "—",
  toMeta,
  travelers = [],
  extraTravelerCount = 0,
  status,
  statusColor = "var(--teal)",
  className = "",
  style = {},
}) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-ticket)",
        padding: 22,
        background: "var(--paper-2)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Dashed perforation across the middle of the ticket. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -8,
          right: -8,
          top: 64,
          borderTop: "1px dashed var(--rule)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <Label>{fromLabel}</Label>
          <Value>{fromValue}</Value>
          {fromMeta && <Meta>{fromMeta}</Meta>}
        </div>
        <div style={{ textAlign: "right" }}>
          <Label>{toLabel}</Label>
          <Value italic>{toValue}</Value>
          {toMeta && <Meta>{toMeta}</Meta>}
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Label>Travelers</Label>
          <Avatars travelers={travelers} extraCount={extraTravelerCount} />
        </div>
        {status && (
          <div style={{ textAlign: "right" }}>
            <Label>Status</Label>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: statusColor,
                marginTop: 2,
              }}
            >
              {status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Value({ children, italic = false }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 28,
        lineHeight: 1,
        color: italic ? "var(--teal)" : "var(--ink)",
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {children}
    </div>
  );
}

function Meta({ children }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--muted)",
        marginTop: 2,
      }}
    >
      {children}
    </div>
  );
}
