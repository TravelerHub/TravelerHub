/**
 * Mono-cap pill — the only badge component in the system.
 *
 * Variants are kept tiny on purpose: default (paper-2 background), `win`
 * (teal — primary state, e.g. "leading"), `clay` (status, "live", "now"),
 * `sky` (info, neutral metadata). Anything that wants to be louder than
 * one of these should be a button, not a pill.
 */
const VARIANT_STYLE = {
  default: { background: "var(--paper-2)", color: "var(--ink-2)" },
  win:     { background: "var(--teal)",    color: "var(--paper)" },
  clay:    { background: "var(--clay)",    color: "var(--paper)" },
  sky:     { background: "var(--sky)",     color: "var(--paper)" },
  ghost:   { background: "transparent",    color: "var(--muted)", border: "1px solid var(--rule)" },
};

export default function Pill({ children, variant = "default", style = {}, className = "" }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        ...VARIANT_STYLE[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
