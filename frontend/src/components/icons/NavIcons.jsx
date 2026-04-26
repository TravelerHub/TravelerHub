/**
 * Minimal, consistent SVG icons for top-level nav and feature tiles.
 *
 * Style: 1.5px stroke, rounded caps/joins, currentColor, 24×24 box.
 * Sized via the `size` prop (default 24); colored via the surrounding
 * element's `color` (currentColor inherits).
 */

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function MapIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7" />
      <path d="M9 4v13M15 7v12.5" />
    </svg>
  );
}

export function WalletIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChatIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" />
    </svg>
  );
}

export function GalleryIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5L13 17l3-3 4.5 4.5" />
    </svg>
  );
}

export function ProfileIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function ScannerIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M6 3h9l4 4v14H6Z" />
      <path d="M14 3v4h5" />
      <path d="M9 12h7M9 15h5" />
    </svg>
  );
}

export function VoteIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 7l1.8 1.8L21 5.6" />
    </svg>
  );
}

export function CompassIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.2 4.3-4.3 1.2 1.2-4.3 4.3-1.2Z" />
    </svg>
  );
}

export function ChecklistIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="m8 10 1.5 1.5L12 9" />
      <path d="m8 15 1.5 1.5L12 14" />
      <path d="M14 10.5h3M14 15.5h3" />
    </svg>
  );
}

export function SosIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M12 2.5 3.5 6v6.4c0 4.6 3.4 8.5 8.5 9.6 5.1-1.1 8.5-5 8.5-9.6V6Z" />
      <path d="M12 8v4.5M12 16h.01" />
    </svg>
  );
}

export function PlaneIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M21 13.5 13.5 21l-1.5-6.5L5.5 13l-2.5-2 18-7-7 18Z" />
    </svg>
  );
}

export function GroupIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="8" r="2.3" />
      <path d="M14.5 17a4.5 4.5 0 0 1 6.5-3.8" />
    </svg>
  );
}

export function CashIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </svg>
  );
}

export function CameraIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M4 8a2 2 0 0 1 2-2h2.5l1.5-2h4l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function ConfettiIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="m4 20 6.5-13.5 7 7L4 20Z" />
      <path d="M14.5 4.5 16 6M19 7l1.5-1.5M17.5 11l1.5 1.5M14 7v.01M20 11.5v.01" />
    </svg>
  );
}

export function SparkleIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} className={className} {...baseProps}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.5 10.4 12.2 5 10.6 10.4 9Z" />
      <path d="M19 17.5 19.7 19.5 21.5 20.2 19.7 20.9 19 23 18.3 20.9 16.5 20.2 18.3 19.5Z" />
    </svg>
  );
}
