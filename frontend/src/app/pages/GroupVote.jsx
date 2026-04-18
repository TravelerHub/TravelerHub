import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { HandRaisedIcon } from "@heroicons/react/24/outline";
import { API_BASE } from "../../config";
import { pollService } from "../../services/pollService";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import { logActivity } from "../../components/ActivityFeed.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_TYPES = [
  {
    key: "length_of_stay",
    label: "Length of Stay",
    icon: "📅",
    desc: "How many days should the trip be?",
  },
  {
    key: "location",
    label: "Location / Hotel",
    icon: "🏨",
    desc: "Where should the group stay?",
  },
  {
    key: "activity",
    label: "Activity / Excursion",
    icon: "🎡",
    desc: "What should the group do?",
  },
  {
    key: "other",
    label: "Other",
    icon: "❓",
    desc: "Any other question for the group?",
  }
];

const TYPE_META = Object.fromEntries(POLL_TYPES.map((t) => [t.key, t]));

const STATUS_COLORS = {
  open:   { bg: "#dcfce7", text: "#166534" },
  closed: { bg: "#f3f4f6", text: "#6b7280" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (votes, total) =>
  total === 0 ? 0 : Math.round((votes / total) * 100);

// ── Sub-components ────────────────────────────────────────────────────────────

function PollTypeBadge({ type }) {
  const meta = TYPE_META[type] || { icon: "📋", label: type };
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "#f3f4f6", color: "#374151" }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function VoteBar({ votes, total, isWinner }) {
  const p = pct(votes, total);
  return (
    <div className="mt-1.5 w-full rounded-full overflow-hidden h-1.5"
      style={{ background: "#f3f4f6" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${p}%`,
          background: isWinner ? "#000000" : "#9ca3af",
        }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GroupVote() {
  const navigate = useNavigate();
  const user = (() => {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  })();

  // ── State: trips ───────────────────────────────────────────────────────────
  const [trips, setTrips]               = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // ── State: polls ──────────────────────────────────────────────────────────
  const [polls, setPolls]                   = useState([]);
  const [pollsLoading, setPollsLoading]     = useState(false);
  const [activePoll, setActivePoll]         = useState(null);   // full poll object
  const [pollLoading, setPollLoading]       = useState(false);

  // ── State: create poll modal ───────────────────────────────────────────────
  const [showCreate, setShowCreate]         = useState(false);
  const [newPollType, setNewPollType]       = useState("length_of_stay");
  const [newPollTitle, setNewPollTitle]     = useState("");
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState("");

  // ── State: add option panel ────────────────────────────────────────────────
  const [optionLabel, setOptionLabel]       = useState("");
  const [addingOption, setAddingOption]     = useState(false);
  const [optionError, setOptionError]       = useState("");

  // ── State: AI suggestions ──────────────────────────────────────────────────
  const [suggestions, setSuggestions]       = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // ── State: confirm finish modal ────────────────────────────────────────────
  const [showConfirm, setShowConfirm]       = useState(false);
  const [closing, setClosing]               = useState(false);

  // ── State: result view ─────────────────────────────────────────────────────
  const [showResult, setShowResult]         = useState(false);

  // ── State: misc ────────────────────────────────────────────────────────────
  const [actionError, setActionError]       = useState("");

  // ── Fetch trips ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/groups/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTrips(list);
        if (list.length > 0) setSelectedTrip(list[0]);
      })
      .catch(() => {});
  }, []);

  // ── Fetch polls when trip changes ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedTrip) return;
    setPollsLoading(true);
    setActivePoll(null);
    setShowResult(false);
    pollService
      .listByTrip(selectedTrip.id || selectedTrip.group_id)
      .then(setPolls)
      .catch(() => setPolls([]))
      .finally(() => setPollsLoading(false));
  }, [selectedTrip]);

  // ── Open a poll ─────────────────────────────────────────────────────────────
  const openPoll = useCallback(async (pollId) => {
    setPollLoading(true);
    setActionError("");
    setShowResult(false);
    setSuggestions([]);
    try {
      const data = await pollService.getPoll(pollId);
      setActivePoll(data);
      if (data.status === "closed") setShowResult(true);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setPollLoading(false);
    }
  }, []);

  // ── Refresh active poll ────────────────────────────────────────────────────
  const refreshPoll = useCallback(async () => {
    if (!activePoll) return;
    try {
      const data = await pollService.getPoll(activePoll.id);
      setActivePoll(data);
    } catch (_) {}
  }, [activePoll]);

  // ── Create poll ────────────────────────────────────────────────────────────
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!newPollTitle.trim()) { setCreateError("Title is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const tripId = selectedTrip.id || selectedTrip.group_id;
      const poll = await pollService.createPoll({
        trip_id: tripId,
        poll_type: newPollType,
        title: newPollTitle.trim(),
      });
      setPolls((prev) => [{ ...poll, option_count: 0, total_votes: 0 }, ...prev]);
      setShowCreate(false);
      setNewPollTitle("");
      openPoll(poll.id);
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Add option ─────────────────────────────────────────────────────────────
  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!optionLabel.trim()) { setOptionError("Label is required."); return; }
    setAddingOption(true);
    setOptionError("");
    try {
      await pollService.addOption(activePoll.id, { label: optionLabel.trim() });
      setOptionLabel("");
      await refreshPoll();
    } catch (e) {
      setOptionError(e.message);
    } finally {
      setAddingOption(false);
    }
  };

  // ── Add AI suggestion as option ────────────────────────────────────────────
  const handleAddSuggestion = async (suggestion) => {
    try {
      await pollService.addOption(activePoll.id, {
        label: suggestion.label,
        value: suggestion.value,
        ai_suggested: true,
      });
      setSuggestions((prev) => prev.filter((s) => s.label !== suggestion.label));
      await refreshPoll();
    } catch (e) {
      setActionError(e.message);
    }
  };

  // ── Load AI suggestions ────────────────────────────────────────────────────
  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await pollService.getSuggestions(activePoll.id);
      // Filter out suggestions already in the poll
      const existingLabels = new Set(activePoll.options.map((o) => o.label));
      setSuggestions((data.suggestions || []).filter((s) => !existingLabels.has(s.label)));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // ── Vote ───────────────────────────────────────────────────────────────────
  const handleVote = async (optionId) => {
    if (!activePoll || activePoll.status !== "open") return;
    try {
      if (activePoll.my_vote === optionId) {
        await pollService.removeVote(activePoll.id);
      } else {
        await pollService.vote(activePoll.id, optionId);
        const optionLabel = activePoll.options?.find((o) => o.id === optionId)?.text;
        const tripId = localStorage.getItem("active_group_id") || localStorage.getItem("activeGroupId");
        logActivity(tripId, "voted", optionLabel || activePoll.question);
      }
      await refreshPoll();
    } catch (e) {
      setActionError(e.message);
    }
  };

  // ── Finish poll ────────────────────────────────────────────────────────────
  const handleFinishPoll = async () => {
    setClosing(true);
    try {
      const data = await pollService.closePoll(activePoll.id);
      setActivePoll(data);
      setShowConfirm(false);
      setShowResult(true);
      // Update summary list
      setPolls((prev) =>
        prev.map((p) => (p.id === data.id ? { ...p, status: "closed" } : p))
      );
    } catch (e) {
      setActionError(e.message);
    } finally {
      setClosing(false);
    }
  };

  // ── Retry (reopen) ─────────────────────────────────────────────────────────
  const handleRetry = async () => {
    try {
      await pollService.reopenPoll(activePoll.id);
      setShowResult(false);
      await refreshPoll();
      setPolls((prev) =>
        prev.map((p) => (p.id === activePoll.id ? { ...p, status: "open" } : p))
      );
    } catch (e) {
      setActionError(e.message);
    }
  };

  // ── Derived: winner option ─────────────────────────────────────────────────
  const winnerOption = activePoll?.options?.find(
    (o) => o.id === activePoll.winner_option_id
  );

  // ── Guard: not logged in ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fbfbf2" }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: "#5c6b73" }}>You are not logged in.</p>
          <button onClick={() => navigate("/login")}
            className="px-6 py-3 rounded-xl font-semibold text-white"
            style={{ background: "#160f29" }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const displayName = user?.username || user?.name || "Traveler";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>Hi,</p>
          <p className="font-bold text-lg leading-tight truncate" style={{ color: "#f9fafb" }}>{displayName}</p>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => (
            <button key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition hover:bg-white/10"
              style={{ background: "transparent", color: "#9ca3af" }}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Group Vote label at bottom of sidebar */}
        <div className="px-3 pb-6">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
            style={{ background: "#3b1f1f" }}>
            <HandRaisedIcon className="w-4 h-4 shrink-0" style={{ color: "#fbfbf2" }} />
            <span className="text-sm font-semibold" style={{ color: "#fbfbf2" }}>
              Group Vote
            </span>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-hidden flex gap-0">

          {/* ── LEFT PANEL: trip selector + poll list ─── */}
          <div className="w-72 shrink-0 flex flex-col border-r overflow-hidden"
            style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>

            {/* Trip selector */}
            <div className="px-4 pt-4 pb-3 border-b shrink-0" style={{ borderColor: "#e5e7eb" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#6b7280" }}>
                Trip
              </p>
              {trips.length === 0 ? (
                <p className="text-sm" style={{ color: "#9ca3af" }}>No trips found.</p>
              ) : (
                <select
                  value={selectedTrip?.id || selectedTrip?.group_id || ""}
                  onChange={(e) => {
                    const t = trips.find((t) => (t.id || t.group_id) === e.target.value);
                    setSelectedTrip(t);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "#f3f4f6", border: "1px solid #d1d5db", color: "#111827" }}>
                  {trips.map((t) => (
                    <option key={t.id || t.group_id} value={t.id || t.group_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Poll list header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
                Polls
              </p>
              {selectedTrip && (
                <button
                  onClick={() => { setShowCreate(true); setCreateError(""); setNewPollTitle(""); }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition hover:opacity-80"
                  style={{ background: "#000000", color: "#f9fafb" }}>
                  + New
                </button>
              )}
            </div>

            {/* Poll list */}
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {pollsLoading ? (
                <p className="text-sm text-center py-8" style={{ color: "#9ca3af" }}>Loading…</p>
              ) : polls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <span className="text-3xl">🗳️</span>
                  <p className="text-sm text-center" style={{ color: "#9ca3af" }}>
                    No polls yet.<br />Create one to get started.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {polls.map((poll) => {
                    const isActive = activePoll?.id === poll.id;
                    const sc = STATUS_COLORS[poll.status] || STATUS_COLORS.open;
                    return (
                      <button
                        key={poll.id}
                        onClick={() => openPoll(poll.id)}
                        className="w-full text-left px-3 py-3 rounded-xl transition"
                        style={{
                          background: isActive ? "#000000" : "#f9fafb",
                          border: `1px solid ${isActive ? "#000000" : "#e5e7eb"}`,
                        }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight truncate"
                            style={{ color: isActive ? "#f9fafb" : "#111827" }}>
                            {TYPE_META[poll.poll_type]?.icon || "📋"} {poll.title}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                            style={{ background: sc.bg, color: sc.text }}>
                            {poll.status}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: isActive ? "#9ca3af" : "#6b7280" }}>
                          {poll.option_count} option{poll.option_count !== 1 ? "s" : ""} · {poll.total_votes} vote{poll.total_votes !== 1 ? "s" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: poll detail ─── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!activePoll ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4"
                style={{ color: "#9ca3af" }}>
                <span className="text-5xl">👥</span>
                <p className="text-lg font-medium" style={{ color: "#6b7280" }}>Group Vote</p>
                <p className="text-sm text-center max-w-xs">
                  {selectedTrip
                    ? "Select a poll from the left, or create a new one."
                    : "Select a trip to see its polls."}
                </p>
              </div>
            ) : pollLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: "#9ca3af" }}>Loading poll…</p>
              </div>
            ) : showResult ? (
              /* ── RESULT VIEW ── */
              <ResultView
                poll={activePoll}
                winnerOption={winnerOption}
                onRetry={handleRetry}
                onBook={() => navigate("/booking")}
                onBack={() => setShowResult(false)}
              />
            ) : (
              /* ── VOTING VIEW ── */
              <div className="flex-1 overflow-y-auto p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <PollTypeBadge type={activePoll.poll_type} />
                    <h2 className="text-xl font-bold mt-1.5" style={{ color: "#111827" }}>
                      {activePoll.title}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                      {activePoll.total_votes} vote{activePoll.total_votes !== 1 ? "s" : ""} cast
                      {activePoll.my_vote && " · Your vote is recorded"}
                    </p>
                  </div>
                  {activePoll.is_leader && activePoll.status === "open" && (
                    <button
                      onClick={() => { setShowConfirm(true); setActionError(""); }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-80"
                      style={{ background: "#000000", color: "#f9fafb" }}>
                      Finish Poll ✓
                    </button>
                  )}
                </div>

                {actionError && (
                  <p className="text-sm text-red-500 mb-4">{actionError}</p>
                )}

                {/* Options */}
                <div className="flex flex-col gap-3 mb-5">
                  {activePoll.options.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: "#9ca3af" }}>
                      No options yet — add one below.
                    </p>
                  ) : (
                    activePoll.options.map((opt) => {
                      const isMyVote   = activePoll.my_vote === opt.id;
                      const isWinner   = opt.id === activePoll.winner_option_id;
                      const canVote    = activePoll.status === "open";
                      const p          = pct(opt.vote_count, activePoll.total_votes);

                      return (
                        <div
                          key={opt.id}
                          className="group px-4 py-3 rounded-xl transition"
                          style={{
                            background: isMyVote ? "#000000" : "#f9fafb",
                            border: `1px solid ${isMyVote ? "#000000" : "#e5e7eb"}`,
                          }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {opt.ai_suggested && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: "#ede9fe", color: "#7c3aed" }}>
                                  AI ✦
                                </span>
                              )}
                              <p className="text-sm font-medium truncate"
                                style={{ color: isMyVote ? "#f9fafb" : "#111827" }}>
                                {opt.label}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <span className="text-xs font-semibold"
                                style={{ color: isMyVote ? "#d1d5db" : "#374151" }}>
                                {opt.vote_count} ({p}%)
                              </span>
                              {canVote && (
                                <button
                                  onClick={() => handleVote(opt.id)}
                                  className="text-xs px-2.5 py-1 rounded-lg font-semibold transition hover:opacity-80"
                                  style={isMyVote
                                    ? { background: "#374151", color: "#f9fafb" }
                                    : { background: "#000000", color: "#f9fafb" }}>
                                  {isMyVote ? "Unvote" : "Vote"}
                                </button>
                              )}
                              {activePoll.is_leader && activePoll.status === "open" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await pollService.removeOption(activePoll.id, opt.id);
                                      await refreshPoll();
                                    } catch (e) {
                                      setActionError(e.message);
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded-lg font-medium transition opacity-0 group-hover:opacity-100"
                                  style={{ background: "#fee2e2", color: "#dc2626" }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          <VoteBar votes={opt.vote_count} total={activePoll.total_votes} isWinner={isWinner} />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add option section */}
                {activePoll.status === "open" && (
                  <div className="rounded-2xl p-4" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold" style={{ color: "#111827" }}>Add Option</p>
                      <button
                        onClick={() => {
                          loadSuggestions();
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition hover:opacity-80"
                        style={{ background: "#ede9fe", color: "#7c3aed" }}>
                        {loadingSuggestions ? "Loading…" : "✦ AI Suggestions"}
                      </button>
                    </div>

                    {/* Manual add */}
                    <form onSubmit={handleAddOption} className="flex gap-2">
                      <input
                        type="text"
                        value={optionLabel}
                        onChange={(e) => setOptionLabel(e.target.value)}
                        placeholder="Type an option…"
                        className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ background: "#f3f4f6", border: "1px solid #d1d5db", color: "#111827" }}
                      />
                      <button
                        type="submit"
                        disabled={addingOption}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
                        style={{ background: "#000000", color: "#f9fafb" }}>
                        {addingOption ? "…" : "+"}
                      </button>
                    </form>
                    {optionError && <p className="text-xs text-red-500 mt-1.5">{optionError}</p>}

                    {/* AI suggestions list */}
                    {suggestions.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        <p className="text-xs font-medium" style={{ color: "#7c3aed" }}>
                          ✦ System Suggestions — click to add
                        </p>
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleAddSuggestion(s)}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition hover:opacity-80"
                            style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#4c1d95" }}>
                            <span className="font-medium">{s.label}</span>
                            {s.value?.address && (
                              <span className="block text-xs mt-0.5 text-purple-400 truncate">{s.value.address}</span>
                            )}
                            {s.value?.days && (
                              <span className="ml-2 text-xs text-purple-400">{s.value.days} days</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ══ CREATE POLL MODAL ═════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ background: "#fbfbf2" }}>
            <h3 className="text-xl font-bold mb-1" style={{ color: "#000000" }}>Create a Poll</h3>
            <p className="text-sm mb-5" style={{ color: "#6b7280" }}>
              Let the group decide together on {selectedTrip?.name}.
            </p>

            <form onSubmit={handleCreatePoll} className="space-y-4">
              {/* Poll type */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: "#000000" }}>Poll Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {POLL_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setNewPollType(t.key)}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center text-xs font-medium transition"
                      style={{
                        background: newPollType === t.key ? "#000000" : "#f3f4f6",
                        color:      newPollType === t.key ? "#f9fafb"  : "#374151",
                        border: `1px solid ${newPollType === t.key ? "#000000" : "#e5e7eb"}`,
                      }}>
                      <span className="text-xl">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-1.5" style={{ color: "#6b7280" }}>
                  {TYPE_META[newPollType]?.desc}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#000000" }}>
                  Poll Question <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPollTitle}
                  onChange={(e) => setNewPollTitle(e.target.value)}
                  placeholder={
                    newPollType === "length_of_stay"
                      ? "e.g. How long should we stay?"
                      : newPollType === "location"
                      ? "e.g. Where should we stay in Tokyo?"
                      : "e.g. What should we do on Day 2?"
                  }
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl outline-none text-sm"
                  style={{ background: "#f3f4f6", color: "#000000", border: "1px solid #374151" }}
                />
              </div>

              {createError && <p className="text-sm text-red-500">{createError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-80 transition"
                  style={{ background: "#000000", color: "#f9fafb" }}>
                  {creating ? "Creating…" : "Create Poll"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #374151" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ FINISH POLL CONFIRM MODAL ════════════════════════════════════════ */}
      {showConfirm && activePoll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl max-w-sm w-full p-6" style={{ background: "#fbfbf2" }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: "#000000" }}>Finish this poll?</h3>
            <p className="text-sm mb-4" style={{ color: "#6b7280" }}>
              The poll will close and the option with the most votes will be declared the winner. This action can be retried.
            </p>

            {activePoll.total_votes === 0 && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg"
                style={{ background: "#fef3c7", color: "#92400e" }}>
                ⚠️ No votes have been cast yet.
              </p>
            )}

            {actionError && <p className="text-sm text-red-500 mb-3">{actionError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleFinishPoll}
                disabled={closing}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-80 transition"
                style={{ background: "#000000", color: "#f9fafb" }}>
                {closing ? "Closing…" : "Yes, Finish Poll"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #374151" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Result View ───────────────────────────────────────────────────────────────

function ResultView({ poll, winnerOption, onRetry, onBook, onBack }) {
  const pollTypeMeta = TYPE_META[poll.poll_type] || { icon: "📋", label: poll.poll_type };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      {/* Trophy */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ background: "#f0fdf4", border: "2px solid #86efac" }}>
        🏆
      </div>

      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>
          Poll Closed · {pollTypeMeta.icon} {pollTypeMeta.label}
        </p>
        <h2 className="text-2xl font-bold mb-1" style={{ color: "#111827" }}>{poll.title}</h2>
        {winnerOption ? (
          <>
            <p className="text-sm mb-1" style={{ color: "#6b7280" }}>The group has decided:</p>
            <p className="text-xl font-semibold mt-2 px-6 py-3 rounded-2xl inline-block"
              style={{ background: "#000000", color: "#f9fafb" }}>
              {winnerOption.label}
            </p>
            <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>
              {winnerOption.vote_count} vote{winnerOption.vote_count !== 1 ? "s" : ""} · {poll.total_votes} total
            </p>
          </>
        ) : (
          <p className="text-sm mt-2" style={{ color: "#9ca3af" }}>No votes were cast.</p>
        )}
      </div>

      {/* Final standings */}
      {poll.options.length > 0 && (
        <div className="w-full max-w-md rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>
            Final Standings
          </p>
          {[...poll.options]
            .sort((a, b) => b.vote_count - a.vote_count)
            .map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-3">
                <span className="text-sm font-bold w-5 shrink-0" style={{ color: "#9ca3af" }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>{opt.label}</p>
                    <span className="text-xs shrink-0 ml-2" style={{ color: "#6b7280" }}>
                      {opt.vote_count} ({pct(opt.vote_count, poll.total_votes)}%)
                    </span>
                  </div>
                  <VoteBar votes={opt.vote_count} total={poll.total_votes} isWinner={opt.id === poll.winner_option_id} />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onBook}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80"
          style={{ background: "#000000", color: "#f9fafb" }}>
          Book Items →
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition hover:bg-gray-200"
          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" }}>
          Retry Poll
        </button>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition hover:bg-gray-100"
          style={{ background: "#ffffff", color: "#6b7280", border: "1px solid #e5e7eb" }}>
          Back to Vote
        </button>
      </div>
    </div>
  );
}
