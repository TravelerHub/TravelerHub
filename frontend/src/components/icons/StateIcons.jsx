/**
 * Empty-state / status illustrations.
 *
 * Goal: warmer + friendlier than the strict NavIcons set. Chubby strokes
 * (~2.2–2.5px), rounded caps + joins, and small "personality" details (a
 * tiny smile, a sparkle, a heart) so empty states feel inviting instead of
 * sterile. Accepts a brand color (`color`) for the outline and an
 * optional `accent` color for highlight details — defaults match the brand
 * teal + warm gold palette.
 */

const baseProps = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// ── CameraSmile: empty gallery / no photos ────────────────────────────────
export function CameraSmile({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Body */}
      <path d="M9 17a3 3 0 0 1 3-3h5l2-3h8l2 3h5a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z" />
      {/* Lens */}
      <circle cx="24" cy="26" r="7.5" />
      {/* Lens smile */}
      <path d="M21 26.5q3 2.5 6 0" strokeWidth="2" />
      {/* Lens eye dots */}
      <circle cx="21.5" cy="24" r="0.6" fill={color} stroke="none" />
      <circle cx="26.5" cy="24" r="0.6" fill={color} stroke="none" />
      {/* Flash sparkle in warm gold */}
      <path d="M37 13l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={accent} stroke={accent} strokeWidth="1" />
    </svg>
  );
}

// ── LockHeart: locked / not a member ──────────────────────────────────────
export function LockHeart({ size = 44, color = "#160f29", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Shackle */}
      <path d="M16 22v-5a8 8 0 0 1 16 0v5" />
      {/* Body */}
      <rect x="11" y="22" width="26" height="18" rx="4" />
      {/* Heart in keyhole, in warm gold */}
      <path
        d="M24 34 q-3-2-3-4.5a2.5 2.5 0 0 1 3-2 2.5 2.5 0 0 1 3 2 q0 2.5-3 4.5z"
        fill={accent}
        stroke={accent}
        strokeWidth="1"
      />
    </svg>
  );
}

// ── AlertSpark: error state, friendlier than a plain warning triangle ─────
export function AlertSpark({ size = 44, color = "#b45309", accent = "#f59e0b" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Soft rounded triangle */}
      <path d="M24 8 L40 36 a3 3 0 0 1 -2.6 4.5 H10.6 a3 3 0 0 1 -2.6 -4.5 z" />
      {/* Exclamation */}
      <path d="M24 18v8" />
      <circle cx="24" cy="31" r="1.4" fill={color} stroke="none" />
      {/* Cute spark */}
      <path d="M38 14l0.7 1.6 1.6 0.7-1.6 0.7-0.7 1.6-0.7-1.6-1.6-0.7 1.6-0.7z" fill={accent} stroke={accent} strokeWidth="0.8" />
    </svg>
  );
}

// ── MapHeart: no albums / no groups yet ───────────────────────────────────
export function MapHeart({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Pin */}
      <path d="M24 6 a10 10 0 0 1 10 10 c0 7-10 18-10 18S14 23 14 16a10 10 0 0 1 10-10z" />
      {/* Heart inside pin in warm gold */}
      <path
        d="M24 21 q-3-2-3-4.5a2.5 2.5 0 0 1 3-2 2.5 2.5 0 0 1 3 2 q0 2.5-3 4.5z"
        fill={accent}
        stroke={accent}
        strokeWidth="1"
      />
      {/* Ground shadow */}
      <ellipse cx="24" cy="40" rx="6" ry="1.6" fill={color} fillOpacity="0.18" stroke="none" />
    </svg>
  );
}

// ── BellQuiet: empty notifications inbox ─────────────────────────────────
export function BellQuiet({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Bell body */}
      <path d="M14 32V22a10 10 0 0 1 20 0v10l3 3H11z" />
      {/* Clapper */}
      <path d="M21 38a3 3 0 0 0 6 0" />
      {/* "z" sparkle so it reads as quiet/asleep, not broken */}
      <path d="M38 12h5l-5 5h5" stroke={accent} strokeWidth="1.8" />
      <circle cx="11" cy="14" r="1" fill={accent} stroke="none" />
    </svg>
  );
}

// ── ChecklistSpark: empty to-do list ─────────────────────────────────────
export function ChecklistSpark({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Clipboard body */}
      <rect x="11" y="10" width="26" height="32" rx="3" />
      {/* Clip */}
      <path d="M19 8h10v6H19z" />
      {/* Checked line */}
      <path d="M16 22l3 3 5-5" stroke={accent} strokeWidth="2.2" />
      {/* Other rows (faint) */}
      <path d="M27 24h7" />
      <path d="M16 32h18" />
      <path d="M16 38h12" />
      {/* Sparkle */}
      <path d="M40 6l0.7 1.6 1.6 0.7-1.6 0.7-0.7 1.6-0.7-1.6-1.6-0.7 1.6-0.7z" fill={accent} stroke={accent} strokeWidth="0.8" />
    </svg>
  );
}

// ── BallotSpark: empty polls / no votes yet ──────────────────────────────
export function BallotSpark({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Box */}
      <path d="M9 22h30v18a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" />
      {/* Slot */}
      <path d="M16 22v-2h16v2" />
      {/* Ballot poking in */}
      <path d="M21 14h6v8h-6z" />
      <path d="M22.5 17h3" stroke={accent} strokeWidth="2" />
      <path d="M22.5 19.5h3" stroke={accent} strokeWidth="2" />
      {/* Sparkle */}
      <path d="M40 8l0.7 1.6 1.6 0.7-1.6 0.7-0.7 1.6-0.7-1.6-1.6-0.7 1.6-0.7z" fill={accent} stroke={accent} strokeWidth="0.8" />
    </svg>
  );
}

// ── PartyWelcome: celebratory empty / first-run state ─────────────────────
export function PartyWelcome({ size = 44, color = "#183a37", accent = "#c8a96e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...baseProps} stroke={color} strokeWidth="2.4">
      {/* Cone */}
      <path d="M10 38 L30 18 L36 24 L18 40 z" />
      <path d="M10 38 L18 40" />
      {/* Confetti (gold) */}
      <circle cx="36" cy="10" r="1.6" fill={accent} stroke="none" />
      <circle cx="42" cy="18" r="1.2" fill={accent} stroke="none" />
      <circle cx="32" cy="6" r="1" fill={accent} stroke="none" />
      <path d="M40 8 l1.5 1.5" stroke={accent} strokeWidth="1.6" />
      <path d="M44 14 l-1.5 1.5" stroke={accent} strokeWidth="1.6" />
      {/* Sparkle */}
      <path d="M38 28l0.7 1.6 1.6 0.7-1.6 0.7-0.7 1.6-0.7-1.6-1.6-0.7 1.6-0.7z" fill={accent} stroke={accent} strokeWidth="0.8" />
    </svg>
  );
}
