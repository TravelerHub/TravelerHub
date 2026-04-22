import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ── Icons ────────────────────────────────────────────────────────────────────

function IconSearch({ size = 18, color = "#5c6b73" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#183a37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#183a37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#183a37" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5c6b73" strokeWidth={2} strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// ── Type → icon map ──────────────────────────────────────────────────────────

const RESULT_ICON = {
  trip: <IconMapPin />,
  expense: <IconDollar />,
  photo: <IconCamera />,
};

const TYPE_LABEL = {
  trip: "TRIPS",
  expense: "EXPENSES",
  photo: "PHOTOS",
};

// ── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Search dropdown ──────────────────────────────────────────────────────────

function SearchDropdown({ results, loading, query, onSelect }) {
  if (!query || query.length < 2) return null;

  // Group results by type
  const groups = {};
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  }
  const typeOrder = ["trip", "expense", "photo"];
  const hasResults = results.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        right: 0,
        background: "#fbfbf2",
        border: "1px solid #d1d1c7",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        zIndex: 200,
        overflow: "hidden",
        maxHeight: "420px",
        overflowY: "auto",
      }}
    >
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", color: "#5c6b73", fontSize: 13 }}>
          <IconSpinner />
          Searching…
        </div>
      ) : !hasResults ? (
        <div style={{ padding: "14px 16px", fontSize: 13, color: "#5c6b73" }}>
          No results for &ldquo;{query}&rdquo;
        </div>
      ) : (
        typeOrder
          .filter((type) => groups[type]?.length)
          .map((type) => (
            <div key={type}>
              {/* Section label */}
              <div
                style={{
                  padding: "8px 16px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#9ca3af",
                  borderTop: "1px solid #e8e8e0",
                }}
              >
                {TYPE_LABEL[type]}
              </div>
              {groups[type].map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelect(result)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0e8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {/* Icon */}
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#e8e8e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {RESULT_ICON[result.type]}
                  </span>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#160f29",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {result.title}
                    </div>
                    {result.subtitle && (
                      <div style={{ fontSize: 11, color: "#5c6b73", marginTop: 1 }}>
                        {result.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Thumbnail for photos */}
                  {result.type === "photo" && result.thumbnail && (
                    <img
                      src={result.thumbnail}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          ))
      )}
    </div>
  );
}

// ── Main navbar ──────────────────────────────────────────────────────────────

function Navbar_Dashboard() {
  const navigate = useNavigate();

  // Profile dropdown
  const [showProfile, setShowProfile] = useState(false);

  // Global search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchWrapRef = useRef(null);
  const inputRef = useRef(null);

  const stored = localStorage.getItem("user");
  const user = stored ? JSON.parse(stored) : null;
  const displayName = user?.username || user?.name || "Traveler";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    // Only remove auth tokens — keep user_keypair and conversation_keys
    // so encrypted messages remain readable on next login.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Debounced query
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch results when debounced query changes
  const fetchResults = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("[search]", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  // Open search bar and focus input
  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Close and reset search
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Escape key closes search
  const handleKeyDown = (e) => {
    if (e.key === "Escape") closeSearch();
  };

  // Click outside closes search
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Navigate to result and close
  const handleSelectResult = (result) => {
    navigate(result.url);
    closeSearch();
  };

  return (
    <header
      className="h-14 shrink-0 flex items-center gap-4 px-6 border-b"
      style={{ background: "#fbfbf2", borderColor: "#d1d1c7", paddingTop: "var(--sat, 0px)" }}
    >
      {/* ── Search area ── */}
      <div
        ref={searchWrapRef}
        style={{
          flex: 1,
          maxWidth: 440,
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Collapsed: icon button */}
        {!searchOpen && (
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <button
              onClick={openSearch}
              title="Search"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 10,
                background: "#e8e8e0",
                border: "none",
                cursor: "pointer",
                color: "#5c6b73",
                fontSize: 13,
                transition: "background 0.15s",
                width: "100%",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#dcdcd4")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#e8e8e0")}
            >
              <IconSearch />
              <span>Search trips, expenses, photos…</span>
            </button>
          </div>
        )}

        {/* Expanded: full input */}
        {searchOpen && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#e8e8e0",
                borderRadius: 10,
                padding: "6px 12px",
                width: "100%",
                animation: "searchExpand 0.2s ease forwards",
              }}
            >
              {searchLoading ? <IconSpinner /> : <IconSearch />}
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search trips, expenses, photos…"
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "#160f29",
                  caretColor: "#183a37",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1,
                    color: "#5c6b73",
                    fontSize: 16,
                  }}
                  title="Clear"
                >
                  ×
                </button>
              )}
            </div>

            {/* Dropdown */}
            <SearchDropdown
              results={searchResults}
              loading={searchLoading}
              query={searchQuery}
              onSelect={handleSelectResult}
            />
          </>
        )}
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Language badge */}
        <span
          className="text-xs font-semibold px-2 py-1 rounded select-none"
          style={{ color: "#5c6b73", background: "#e2e2da" }}
        >
          EN
        </span>

        {/* Chat notifications */}
        <button
          onClick={() => navigate("/message")}
          title="Messages"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#5c6b73" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.84L3 20l1.09-3.27A7.958 7.958 0 013 12C3 7.582 7.03 4 12 4s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Event notifications */}
        <button
          onClick={() => navigate("/calendar")}
          title="Events"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#5c6b73" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Profile avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition hover:opacity-90 select-none"
            style={{ background: "#183a37" }}
          >
            {initials}
          </button>

          {showProfile && (
            <>
              {/* Click-away overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProfile(false)}
              />
              <div
                className="absolute right-0 top-10 w-36 rounded-xl shadow-lg overflow-hidden z-50"
                style={{ background: "#fbfbf2", border: "1px solid #d1d1c7" }}
              >
                <button
                  onClick={() => { navigate("/profile"); setShowProfile(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition"
                  style={{ color: "#160f29" }}
                >
                  Profile
                </button>
                <div style={{ borderTop: "1px solid #d1d1c7" }} />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition"
                  style={{ color: "#160f29" }}
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expand animation keyframes */}
      <style>{`
        @keyframes searchExpand {
          from { opacity: 0.6; transform: scaleX(0.95); transform-origin: left; }
          to   { opacity: 1;   transform: scaleX(1);    transform-origin: left; }
        }
      `}</style>
    </header>
  );
}

export default Navbar_Dashboard;
