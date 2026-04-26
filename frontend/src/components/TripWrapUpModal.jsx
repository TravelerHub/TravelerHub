import { useState, useEffect } from "react";
import { API_BASE, authHeaders } from "../services/api";

// ── tiny stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value }) {
  return (
    <div
      className="rounded-2xl py-4 px-3 flex flex-col items-center gap-1"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <span className="text-2xl font-bold text-white">{value ?? "—"}</span>
      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

// ── step indicator dots ────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:      i + 1 <= current ? 20 : 8,
            height:     8,
            background: i + 1 <= current ? "#2dd4bf" : "rgba(255,255,255,0.2)",
          }}
        />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
/**
 * TripWrapUpModal
 * @param {object}   trip        — trip object (needs .id and .name)
 * @param {function} onClose     — called when the modal is dismissed without completing
 * @param {function} onComplete  — called after step 4 "Done" is clicked
 */
export default function TripWrapUpModal({ trip, onClose, onComplete }) {
  const [step,           setStep]           = useState(1);
  const [wrapupData,     setWrapupData]     = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [highlightPhoto, setHighlightPhoto] = useState(null);
  const [storyLink,      setStoryLink]      = useState(null);
  const [copying,        setCopying]        = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [completing,     setCompleting]     = useState(false);

  // Fetch wrap-up data on mount
  useEffect(() => {
    if (!trip?.id) return;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/trips/${trip.id}/wrapup-data`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setWrapupData(data);
        if (data.highlight_photo_url) setHighlightPhoto(data.highlight_photo_url);
      })
      .catch((e) => {
        console.error("[TripWrapUpModal] fetch failed:", e);
        setError("Could not load wrap-up data.");
      })
      .finally(() => setLoading(false));
  }, [trip?.id]);

  // ── copy story link ──────────────────────────────────────────────────────────
  const handleCopyStoryLink = async () => {
    setCopying(true);
    try {
      let link = storyLink;
      if (!link) {
        const res = await fetch(`${API_BASE}/trips/${trip.id}/story/share`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        link = data.public_url;
        setStoryLink(link);
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("[TripWrapUpModal] copy story link failed:", e);
    } finally {
      setCopying(false);
    }
  };

  // ── complete trip ────────────────────────────────────────────────────────────
  const handleComplete = async () => {
    setCompleting(true);
    try {
      await fetch(`${API_BASE}/trips/${trip.id}/complete`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ highlight_photo_url: highlightPhoto }),
      });
    } catch (e) {
      console.error("[TripWrapUpModal] mark complete failed:", e);
    } finally {
      setCompleting(false);
      onComplete?.();
    }
  };

  // ── backdrop click closes modal ───────────────────────────────────────────────
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  // ── loading / error states ────────────────────────────────────────────────────
  const inner = (() => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#2dd4bf", borderTopColor: "transparent" }}
          />
          <p style={{ color: "rgba(255,255,255,0.5)" }} className="text-sm">Loading your trip stats…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <span className="text-4xl">😕</span>
          <p className="text-white/60 text-sm text-center">{error}</p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-80"
            style={{ background: "#183a37" }}
          >
            Close
          </button>
        </div>
      );
    }

    // ── STEP 1 — Celebration ────────────────────────────────────────────────────
    if (step === 1) {
      return (
        <div className="text-center py-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-1">{trip.name} is a wrap!</h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>What a trip. Let's close it out the right way.</p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatCard
              label="Days"
              value={
                wrapupData?.total_days != null
                  ? wrapupData.total_days
                  : wrapupData?.start_date
                    ? "–"
                    : "–"
              }
            />
            <StatCard label="Spent" value={wrapupData?.total_spent != null ? `$${wrapupData.total_spent.toFixed(2)}` : "$0"} />
            <StatCard label="Photos" value={wrapupData?.total_photos ?? 0} />
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #2dd4bf, #183a37)" }}
          >
            Let's wrap up →
          </button>
        </div>
      );
    }

    // ── STEP 2 — Settle Up ──────────────────────────────────────────────────────
    if (step === 2) {
      const transfers = wrapupData?.suggested_transfers || [];
      return (
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Settle Up</h2>
          <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
            {transfers.length === 0
              ? "You're all square — no outstanding balances."
              : `${transfers.length} payment${transfers.length > 1 ? "s" : ""} needed to settle up.`}
          </p>

          {transfers.length > 0 && (
            <div className="space-y-2 mb-5 max-h-52 overflow-y-auto pr-1">
              {transfers.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-white truncate">{t.from_username}</span>
                    <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>owes</span>
                    <span className="text-sm font-medium text-white truncate">{t.to_username}</span>
                  </div>
                  <span
                    className="ml-3 shrink-0 text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: "rgba(45,212,191,0.15)", color: "#2dd4bf" }}
                  >
                    ${t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {transfers.length > 0 && (
              <a
                href="/finance"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-center transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                Go to Finance ↗
              </a>
            )}
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #2dd4bf, #183a37)" }}
            >
              {transfers.length === 0 ? "Next →" : "All settled ✓"}
            </button>
          </div>
        </div>
      );
    }

    // ── STEP 3 — Photo Highlight ─────────────────────────────────────────────────
    if (step === 3) {
      const photos = wrapupData?.photos || [];
      return (
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Pick a Highlight</h2>
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Choose one photo as the cover for this trip.
          </p>

          {photos.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-10 mb-4 gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)" }}
            >
              <span className="text-3xl">📷</span>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No photos on this trip yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4 max-h-64 overflow-y-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setHighlightPhoto(photo.public_url)}
                  className="relative aspect-square rounded-xl overflow-hidden focus:outline-none transition hover:scale-[1.03] active:scale-95"
                  style={{ border: highlightPhoto === photo.public_url ? "2px solid #2dd4bf" : "2px solid transparent" }}
                  title={photo.caption || ""}
                >
                  <img
                    src={photo.public_url}
                    alt={photo.caption || "trip photo"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {highlightPhoto === photo.public_url && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(45,212,191,0.3)" }}
                    >
                      <span className="text-white text-2xl font-bold drop-shadow">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setHighlightPhoto(null); setStep(4); }}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Skip
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition hover:opacity-90 active:scale-95"
              style={{
                background: highlightPhoto
                  ? "linear-gradient(135deg, #2dd4bf, #183a37)"
                  : "rgba(255,255,255,0.1)",
                opacity: highlightPhoto ? 1 : 0.6,
              }}
            >
              {highlightPhoto ? "Set as Cover →" : "Next →"}
            </button>
          </div>
        </div>
      );
    }

    // ── STEP 4 — Share Story ─────────────────────────────────────────────────────
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="text-xl font-bold text-white mb-2">Your story is ready to share</h2>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
          Anyone with the link can view your trip timeline — photos, expenses, and all the highlights.
        </p>

        {/* Preview card */}
        <div
          className="rounded-2xl px-5 py-4 mb-6 text-left"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center gap-3">
            {highlightPhoto ? (
              <img src={highlightPhoto} alt="highlight" loading="lazy" decoding="async" className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: "rgba(45,212,191,0.15)" }}
              >
                🌍
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{trip.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                {wrapupData?.total_days != null && `${wrapupData.total_days} days · `}
                {wrapupData?.total_photos ?? 0} photos · ${wrapupData?.total_spent?.toFixed(2) ?? "0.00"} total
              </p>
            </div>
          </div>
        </div>

        {storyLink && (
          <p
            className="text-xs break-all mb-4 px-3 py-2 rounded-xl font-mono select-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {storyLink}
          </p>
        )}

        <button
          onClick={handleCopyStoryLink}
          disabled={copying}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white transition hover:opacity-90 active:scale-95 mb-3 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #2dd4bf, #183a37)" }}
        >
          {copying ? "Generating link…" : copied ? "Copied! 🎉" : "📋 Copy public link"}
        </button>

        <button
          onClick={handleComplete}
          disabled={completing}
          className="w-full py-3 rounded-xl font-semibold text-sm transition hover:opacity-80 disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {completing ? "Saving…" : "Done"}
        </button>
      </div>
    );
  })();

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdrop}
    >
      {/* Modal card */}
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "linear-gradient(160deg, #160f29 0%, #183a37 100%)", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            Trip Wrap-Up
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step dots */}
        {!loading && !error && <StepDots current={step} total={4} />}

        {/* Body */}
        <div className="px-6 pb-8">
          {inner}
        </div>
      </div>
    </div>
  );
}
