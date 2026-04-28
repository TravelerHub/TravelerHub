/**
 * Shared sidebar navigation items — single source of truth across all pages.
 * Each page imports this and marks its own path as active.
 *
 * Items are grouped into sections so the drawer scans as ~3 small lists
 * instead of one long block. Icons hint at what each item is at a glance —
 * the previous text-only column made eight visually-identical rows that
 * felt overwhelming to skim.
 */
export const SIDEBAR_SECTIONS = [
  {
    title: "Today",
    items: [
      { label: "Dashboard",  path: "/dashboard",  icon: "home"     },
      { label: "Chat",       path: "/message",    icon: "chat"     },
      { label: "Calendar",   path: "/calendar",   icon: "calendar" },
      { label: "Navigation", path: "/navigation", icon: "map"      },
    ],
  },
  {
    title: "Plan",
    items: [
      { label: "Booking",    path: "/booking",    icon: "plane"     },
      { label: "Wallet",     path: "/finance",    icon: "wallet"    },
      { label: "To-Do",      path: "/todo",       icon: "checklist" },
    ],
  },
  {
    title: "Safety",
    items: [
      { label: "Emergency",  path: "/emergency",  icon: "sos"       },
    ],
  },
];

// Flat list kept exported for any older callers that still import it.
export const SIDEBAR_ITEMS = SIDEBAR_SECTIONS.flatMap((s) => s.items);
