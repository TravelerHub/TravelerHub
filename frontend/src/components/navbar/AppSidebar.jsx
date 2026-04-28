import { useLocation, useNavigate } from "react-router-dom";
import {
  XMarkIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  MapIcon as HeroMapIcon,
  PaperAirplaneIcon,
  WalletIcon as HeroWalletIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { SIDEBAR_SECTIONS } from "../../constants/sidebarItems.js";

const ICON_FOR = {
  home:      HomeIcon,
  chat:      ChatBubbleLeftRightIcon,
  calendar:  CalendarDaysIcon,
  map:       HeroMapIcon,
  plane:     PaperAirplaneIcon,
  wallet:    HeroWalletIcon,
  checklist: CheckCircleIcon,
  sos:       ExclamationTriangleIcon,
};

/**
 * Shared app sidebar.
 *
 * Layout:
 *   - On `<lg`: fixed slide-over drawer; controlled via `open` + `onClose`.
 *   - On `lg+`: static column, always visible.
 *
 * Slots:
 *   - `header`     – override the default "Hi, {displayName}" greeting block
 *   - `topExtras`  – content rendered below the nav list (filters, badges)
 *   - `footer`     – content rendered at the bottom (CTA buttons, cards)
 *
 * Active item is computed from the current pathname; pages do not need to
 * pass it in.
 */
export default function AppSidebar({
  open = false,
  onClose,
  header,
  topExtras,
  footer,
  displayName = "Traveler",
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const close = () => onClose && onClose();

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-52 flex flex-col transition-transform duration-300
          lg:static lg:translate-x-0 lg:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: "#000000" }}
      >
        {/* Header slot */}
        <div
          className="px-5 pt-6 pb-5 border-b shrink-0 flex items-start justify-between gap-2"
          style={{ borderColor: "#374151" }}
        >
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                <p
                  className="text-xs font-medium uppercase tracking-widest mb-1"
                  style={{ color: "#6b7280" }}
                >
                  Hi,
                </p>
                <p
                  className="font-bold text-lg leading-tight truncate"
                  style={{ color: "#f9fafb" }}
                >
                  {displayName}
                </p>
              </>
            )}
          </div>
          <button
            onClick={close}
            className="lg:hidden p-1 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-5 h-5" style={{ color: "#9ca3af" }} />
          </button>
        </div>

        {/* Nav list — grouped into sections with icons so 8 destinations
            don't all read as one long undifferentiated stack. */}
        <nav className="flex flex-col gap-3 px-3 py-4 flex-1 overflow-y-auto min-h-0">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <p
                className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#4b5563" }}
              >
                {section.title}
              </p>
              {section.items.map((item) => {
                const isActive = item.path && pathname.startsWith(item.path);
                const isDisabled = !item.path;
                const Icon = ICON_FOR[item.icon];
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.path) {
                        navigate(item.path);
                        close();
                      }
                    }}
                    disabled={isDisabled}
                    className={`
                      w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition
                      flex items-center gap-3
                      ${isActive ? "font-bold" : isDisabled ? "cursor-not-allowed" : "hover:bg-white/10"}
                    `}
                    style={{
                      background: isActive ? "#ffffff" : "transparent",
                      color: isActive
                        ? "#000000"
                        : isDisabled
                        ? "#4b5563"
                        : "#9ca3af",
                    }}
                  >
                    {Icon && (
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: "currentColor" }}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {topExtras && <div className="mt-2">{topExtras}</div>}
        </nav>

        {/* Footer slot */}
        {footer && <div className="px-3 pb-5 shrink-0">{footer}</div>}
      </aside>
    </>
  );
}
