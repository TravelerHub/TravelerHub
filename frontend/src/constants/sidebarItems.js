/**
 * Shared sidebar navigation items — single source of truth across all pages.
 * Each page imports this and marks its own path as active.
 */
export const SIDEBAR_ITEMS = [
  { label: "Dashboard",  path: "/dashboard"  },
  { label: "Chat",       path: "/message"    },
  { label: "Navigation", path: "/navigation" },
  { label: "Booking",    path: "/booking"    },
  { label: "Calendar",   path: "/calendar"   },
  { label: "Wallet",     path: "/finance"    },
];
