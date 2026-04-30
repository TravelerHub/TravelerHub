/**
 * Geometric line glyphs from the marketing design system.
 *
 * Each glyph is 24x24, 1.5 stroke, currentColor — meaning the surrounding
 * text color drives the icon color. Wrap in a `<Glyph>` to get the
 * 56x56 circular frame with a 70%-opacity stroke that the marketing site
 * uses inside feature cards. Or import `<Icon name="vote" />` to drop the
 * raw 24x24 SVG anywhere (sidebar, button label, etc.).
 *
 * The set deliberately avoids emoji and brand-specific iconography — they
 * scale, recolor, and screen-read better as plain SVG.
 */

const PATHS = {
  // Vote — circle + plus. Used for "Vote together / decide faster".
  vote: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </>
  ),
  // Lock — encrypted chat / privacy.
  lock: (
    <>
      <rect x="5" y="10" width="14" height="9" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  // Split — divide expenses.
  split: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
      <path d="M10 8l-2 4 2 4" />
      <path d="M14 8l2 4-2 4" />
    </>
  ),
  // Route — smart routing / waypoints.
  route: (
    <>
      <path d="M5 19c0-4 6-4 6-8s-4-4-4-8" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
      <path d="M11 11l8-6" />
    </>
  ),
  // Map — folded paper map / shared pins.
  map: (
    <>
      <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  // Memory — camera / shared photo timeline.
  memory: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3" />
      <path d="M9 6l1.5-2h3L15 6" />
    </>
  ),
};

export function Icon({ name, size = 24, className = "", style = {} }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

/**
 * Framed glyph — 56x56 circle around a 24x24 icon. Use inside feature
 * cards / hero ornaments, where the marketing design always frames glyphs.
 */
export default function Glyph({ name, size = 56, iconSize = 24, className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        border: "1px solid currentColor",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.7,
        ...style,
      }}
    >
      <Icon name={name} size={iconSize} />
    </div>
  );
}
