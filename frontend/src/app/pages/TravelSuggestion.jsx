import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import { searchPlaces as geocodeDestination } from "../../services/geocodingService.js";
import {
  searchPlacesByText,
  searchNearbyPlaces,
  getPhotoUrl,
  getPriceLevelSymbol,
  searchHiddenGems,
} from "../../services/googlePlacesService.js";
import {
  CATEGORY_OPTIONS,
  INTEREST_OPTIONS,
} from "../../services/preferencesService.js";
import { addFavorite } from "../../services/favoritesService.js";

// ── Color palette (matches Dashboard / Booking / Finance)
// #160f29  deep dark   (sidebar bg, headings)
// #fbfbf2  off-white   (page bg, light text)
// #5c6b73  slate-gray  (secondary text)
// #183a37  dark teal   (accent / active)
// #f3f4f6  light gray  (main bg)

const BUDGET_OPTIONS = [
  { id: "low",    label: "Budget",    symbol: "$"   },
  { id: "medium", label: "Moderate",  symbol: "$$"  },
  { id: "high",   label: "Expensive", symbol: "$$$" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StarRating({ rating }) {
  if (!rating) return <span style={{ color: "#9ca3af", fontSize: 12 }}>No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          style={{
            color: i < full ? "#f59e0b" : i === full && half ? "#fbbf24" : "#d1d5db",
            fontSize: 13,
          }}
        >
          {i < full ? "★" : i === full && half ? "★" : "☆"}
        </span>
      ))}
      <span className="ml-1 text-xs" style={{ color: "#5c6b73" }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function PlaceCard({ place, isSaved, onToggleFavorite, saving }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = place.photos?.[0] ? getPhotoUrl(place.photos[0].name, 400) : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.id}`;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col shadow-sm transition-shadow hover:shadow-md"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      {/* ── Photo ── */}
      <div style={{ height: 176, background: "#f3f4f6", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={place.name}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ background: "linear-gradient(135deg, #160f29 0%, #183a37 100%)" }}
          >
            <span style={{ fontSize: 44, opacity: 0.7 }}>🗺️</span>
          </div>
        )}

        {/* Price badge */}
        {place.priceLevel && (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fbfbf2" }}
          >
            {getPriceLevelSymbol(place.priceLevel)}
          </span>
        )}

        {/* Open / closed badge */}
        {place.isOpen !== null && place.isOpen !== undefined && (
          <span
            className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: place.isOpen
                ? "rgba(22, 163, 74, 0.88)"
                : "rgba(220, 38, 38, 0.88)",
              color: "#fff",
            }}
          >
            {place.isOpen ? "Open" : "Closed"}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-bold text-sm leading-snug line-clamp-2" style={{ color: "#160f29" }}>
          {place.name}
        </h3>

        <p className="text-xs line-clamp-2" style={{ color: "#5c6b73" }}>
          {place.address}
        </p>

        <StarRating rating={place.rating} />

        {/* Type chips */}
        {place.types?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {place.types.slice(0, 2).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-xs capitalize"
                style={{ background: "#f3f4f6", color: "#6b7280" }}
              >
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* ── Action row ── */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 rounded-lg text-xs font-semibold transition"
            style={{ background: "#160f29", color: "#fbfbf2" }}
          >
            View on Maps
          </a>
          <button
            onClick={() => onToggleFavorite(place)}
            disabled={saving === place.id}
            title={isSaved ? "Saved to favorites" : "Save to favorites"}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition text-base"
            style={{
              background: isSaved ? "#160f29" : "#f3f4f6",
              color: isSaved ? "#fbfbf2" : "#374151",
              border: "1.5px solid #e5e7eb",
              cursor: saving === place.id ? "wait" : "pointer",
            }}
          >
            {isSaved ? "♥" : "♡"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader cards ──────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <div style={{ height: 176, background: "#f3f4f6" }} className="animate-pulse" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 rounded-lg animate-pulse" style={{ background: "#f3f4f6", width: "75%" }} />
        <div className="h-3 rounded-lg animate-pulse" style={{ background: "#f3f4f6", width: "90%" }} />
        <div className="h-3 rounded-lg animate-pulse" style={{ background: "#f3f4f6", width: "50%" }} />
        <div className="h-8 rounded-lg animate-pulse mt-2" style={{ background: "#f3f4f6" }} />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TravelSuggestion() {
  const navigate = useNavigate();

  // ── Search form state ───────────────────────────────────────────────────────
  const [destination,        setDestination]        = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedInterests,  setSelectedInterests]  = useState([]);
  const [budget,             setBudget]             = useState("medium");
  const [radius,             setRadius]             = useState(5);

  // ── Results state ───────────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [results,     setResults]     = useState([]);
  const [hiddenGems,  setHiddenGems]  = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab,   setActiveTab]   = useState("all"); // "all" | "gems"
  const [resolvedDest,setResolvedDest]= useState("");

  // ── Favorites state ─────────────────────────────────────────────────────────
  const [savedIds,    setSavedIds]    = useState(new Set());
  const [savingId,    setSavingId]    = useState(null);
  const [saveMsg,     setSaveMsg]     = useState("");

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const toggleCategory = useCallback((id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const toggleInterest = useCallback((id) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!destination.trim()) {
      setError("Please enter a destination.");
      return;
    }
    setError("");
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setHiddenGems([]);
    setSavedIds(new Set());
    setActiveTab("all");

    try {
      // 1. Geocode destination → lat/lng
      const geoResults = await geocodeDestination(destination.trim(), { limit: 1 });
      if (!geoResults.length) {
        setError("Could not locate that destination. Please try a more specific name.");
        setLoading(false);
        return;
      }
      const [lng, lat] = geoResults[0].coordinates;
      setResolvedDest(geoResults[0].name || destination.trim());

      // 2. Build search query from interests + categories
      const interestLabels = selectedInterests.map(
        (id) => INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id
      );
      const categoryLabels = selectedCategories.map(
        (id) => CATEGORY_OPTIONS.find((o) => o.id === id)?.label ?? id
      );
      const terms = [...new Set([...interestLabels, ...categoryLabels])];
      const query =
        terms.length > 0
          ? `${terms.join(" ")} in ${destination}`
          : `top things to do in ${destination}`;

      // 3. Fire text-search + hidden-gems in parallel
      const [textPlaces, gems] = await Promise.all([
        searchPlacesByText(query, lat, lng),
        searchHiddenGems(lat, lng, radius * 1000),
      ]);

      // 4. Optional: nearby search for first selected category type
      let nearbyPlaces = [];
      if (selectedCategories.length > 0) {
        try {
          nearbyPlaces = await searchNearbyPlaces(
            lat,
            lng,
            selectedCategories[0],
            radius * 1000
          );
        } catch {
          // nearby search is bonus — ignore if it fails
        }
      }

      // 5. Merge + deduplicate
      const seen = new Set();
      const merged = [...textPlaces, ...nearbyPlaces].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      setResults(merged);
      setHiddenGems(gems);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Favorites toggle ─────────────────────────────────────────────────────────
  const handleToggleFavorite = async (place) => {
    if (savedIds.has(place.id)) return; // already saved — no remove in this flow
    setSavingId(place.id);
    try {
      await addFavorite(place);
      setSavedIds((prev) => new Set([...prev, place.id]));
      setSaveMsg(`"${place.name}" saved to favorites!`);
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(err?.message || "Failed to save favorite.");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSavingId(null);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const displayList = activeTab === "gems" ? hiddenGems : results;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col h-full"
        style={{ width: 220, background: "#000", color: "#fbfbf2" }}
      >
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <span className="text-xl font-bold tracking-tight" style={{ color: "#fbfbf2" }}>
            TravelHub
          </span>
        </div>

        <div className="px-4 pb-4">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.path === "/travelsuggestion";
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition"
                style={{
                  background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                  color: !item.path
                    ? "rgba(251,251,242,0.3)"
                    : isActive
                    ? "#fbfbf2"
                    : "rgba(251,251,242,0.75)",
                  cursor: item.path ? "pointer" : "default",
                  fontWeight: isActive ? 700 : 500,
                }}
                onMouseEnter={(e) => {
                  if (item.path && !isActive)
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </button>
            );
          })}

          {/* Suggestions — active highlight since not in SIDEBAR_ITEMS */}
          <button
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition"
            style={{
              background: "rgba(255,255,255,0.10)",
              color: "#fbfbf2",
            }}
          >
            Suggestions
          </button>
        </nav>

        {/* Sidebar bottom promo */}
        <div className="px-3 pb-6">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(24,58,55,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs font-bold" style={{ color: "#fbfbf2" }}>Hidden Gems</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(251,251,242,0.6)" }}>
              Search any destination to discover local favorites off the beaten path.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── Page header ─────────────────────────────────────────────────── */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "#160f29" }}>
              Travel Suggestions
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#5c6b73" }}>
              Discover places tailored to your interests and budget.
            </p>
          </div>

          {/* ── Search card ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 mb-5 shadow-sm"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            {/* Destination row */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Where do you want to explore? (e.g. Tokyo, Paris, Bali)"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
                  style={{
                    border: "1.5px solid #d1d5db",
                    background: "#f9fafb",
                    color: "#111827",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#160f29")}
                  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-3 rounded-xl text-sm font-semibold transition"
                style={{
                  background: loading ? "#9ca3af" : "#160f29",
                  color: "#fbfbf2",
                  cursor: loading ? "not-allowed" : "pointer",
                  minWidth: 130,
                }}
              >
                {loading ? "Searching…" : "Find Places"}
              </button>
            </div>

            {/* Categories */}
            <div className="mb-5">
              <p className="text-xs font-bold tracking-wide mb-2.5" style={{ color: "#9ca3af" }}>
                CATEGORIES
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: active ? "#160f29" : "#f9fafb",
                        color: active ? "#fbfbf2" : "#374151",
                        border: `1.5px solid ${active ? "#160f29" : "#e5e7eb"}`,
                      }}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interests */}
            <div className="mb-5">
              <p className="text-xs font-bold tracking-wide mb-2.5" style={{ color: "#9ca3af" }}>
                INTERESTS
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((int) => {
                  const active = selectedInterests.includes(int.id);
                  return (
                    <button
                      key={int.id}
                      onClick={() => toggleInterest(int.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: active ? "#183a37" : "#f9fafb",
                        color: active ? "#fbfbf2" : "#374151",
                        border: `1.5px solid ${active ? "#183a37" : "#e5e7eb"}`,
                      }}
                    >
                      <span>{int.emoji}</span>
                      <span>{int.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget + Radius */}
            <div className="flex flex-wrap items-end gap-8">
              {/* Budget */}
              <div>
                <p className="text-xs font-bold tracking-wide mb-2.5" style={{ color: "#9ca3af" }}>
                  BUDGET
                </p>
                <div className="flex gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBudget(b.id)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition"
                      style={{
                        background: budget === b.id ? "#183a37" : "#f9fafb",
                        color: budget === b.id ? "#fbfbf2" : "#374151",
                        border: `1.5px solid ${budget === b.id ? "#183a37" : "#e5e7eb"}`,
                      }}
                    >
                      {b.symbol} · {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius slider */}
              <div>
                <p className="text-xs font-bold tracking-wide mb-2.5" style={{ color: "#9ca3af" }}>
                  SEARCH RADIUS · {radius} km
                </p>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-44"
                  style={{ accentColor: "#183a37" }}
                />
              </div>
            </div>
          </div>

          {/* ── Toast / save message ─────────────────────────────────────────── */}
          {saveMsg && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: saveMsg.includes("Failed") ? "#fee2e2" : "#d1fae5",
                color: saveMsg.includes("Failed") ? "#dc2626" : "#065f46",
                border: `1px solid ${saveMsg.includes("Failed") ? "#fca5a5" : "#6ee7b7"}`,
              }}
            >
              {saveMsg}
            </div>
          )}

          {/* ── Error banner ─────────────────────────────────────────────────── */}
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
            >
              {error}
            </div>
          )}

          {/* ── Loading skeletons ────────────────────────────────────────────── */}
          {loading && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                  style={{ borderColor: "#160f29", borderTopColor: "transparent" }}
                />
                <p className="text-sm" style={{ color: "#5c6b73" }}>
                  Discovering amazing places in <strong style={{ color: "#160f29" }}>{destination}</strong>…
                </p>
              </div>
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
              >
                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </>
          )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {!loading && hasSearched && (
            <>
              {/* Resolved destination label */}
              {resolvedDest && (
                <p className="text-xs mb-4 font-medium" style={{ color: "#5c6b73" }}>
                  Showing results near{" "}
                  <span style={{ color: "#160f29", fontWeight: 700 }}>{resolvedDest}</span>
                </p>
              )}

              {/* Tabs */}
              <div
                className="flex items-center gap-0 mb-6 border-b"
                style={{ borderColor: "#e5e7eb" }}
              >
                {[
                  { id: "all",  label: "All Places",  count: results.length    },
                  { id: "gems", label: "Hidden Gems",  count: hiddenGems.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="px-5 py-2.5 text-sm font-semibold transition relative"
                    style={{
                      color: activeTab === tab.id ? "#160f29" : "#5c6b73",
                      borderBottom:
                        activeTab === tab.id
                          ? "2px solid #160f29"
                          : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                    <span
                      className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
                      style={{
                        background: activeTab === tab.id ? "#160f29" : "#f3f4f6",
                        color: activeTab === tab.id ? "#fbfbf2" : "#6b7280",
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Grid or empty state */}
              {displayList.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-20 rounded-2xl"
                  style={{ background: "#fff", border: "1px dashed #d1d5db" }}
                >
                  <span style={{ fontSize: 48, opacity: 0.5 }}>🔍</span>
                  <p className="mt-4 text-base font-semibold" style={{ color: "#160f29" }}>
                    No places found
                  </p>
                  <p className="mt-1 text-sm text-center max-w-xs" style={{ color: "#5c6b73" }}>
                    Try adjusting your filters, expanding the radius, or searching a different
                    destination.
                  </p>
                </div>
              ) : (
                <div
                  className="grid gap-5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {displayList.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      isSaved={savedIds.has(place.id)}
                      saving={savingId}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Initial empty state ─────────────────────────────────────────── */}
          {!loading && !hasSearched && (
            <div
              className="flex flex-col items-center justify-center py-24 rounded-2xl"
              style={{ background: "#fff", border: "1px dashed #d1d5db" }}
            >
              <span style={{ fontSize: 60 }}>✈️</span>
              <h2 className="mt-5 text-xl font-bold" style={{ color: "#160f29" }}>
                Start exploring
              </h2>
              <p
                className="mt-2 text-sm max-w-sm text-center leading-relaxed"
                style={{ color: "#5c6b73" }}
              >
                Enter a destination, pick your interests and budget, then hit{" "}
                <strong style={{ color: "#160f29" }}>Find Places</strong> to discover amazing spots
                around the world.
              </p>
              {/* Quick-start suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {["Tokyo", "Paris", "Bali", "New York", "Rome", "Bangkok"].map((city) => (
                  <button
                    key={city}
                    onClick={() => setDestination(city)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition"
                    style={{
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1.5px solid #e5e7eb",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#160f29";
                      e.currentTarget.style.color = "#fbfbf2";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
