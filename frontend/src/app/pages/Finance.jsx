import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getExchangeRates, convertAmount, CURRENCY_SYMBOLS } from "../../services/currencyService";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  getFinanceTransactions,
  splitExpense,
  getTripBalances,
  recordSettlement,
  getSettlementSummary,
} from "../../services/financeService";
import { chargeSavedCard, getSavedCards } from "../../services/billingService";
import { ensureActiveGroupId, getActiveGroupId, getMyGroups, setActiveGroupId } from "../../services/groupService";
import CardRecommendation from "../../components/CardRecommendation.jsx";
import BudgetTracker from "../../components/BudgetTracker.jsx";
import CardWallet from "../../components/CardWallet.jsx";
import EmptyState from "../../components/EmptyState.jsx";

// ── Color palette (matches Dashboard / Booking / Expenses)
// #160f29  deep dark   (sidebar, headings)
// #fbfbf2  off-white
// #5c6b73  slate-gray  (secondary text)
// #183a37  dark teal   (accent / income)
// #f3f4f6  light gray  (page bg)

const CATEGORIES = ["Expense", "Income", "Accommodation", "Transportation", "Dining", "Activities", "Shopping", "Other"];

const CATEGORY_META = {
  Expense:       { icon: "💸", color: "#dc2626" },
  Income:        { icon: "💵", color: "#16a34a" },
  Accommodation: { icon: "🏨", color: "#1e3a5f" },
  Transportation: { icon: "✈️", color: "#160f29" },
  Dining:         { icon: "🍽️", color: "#183a37" },
  Activities:     { icon: "🎡", color: "#2d1b4e" },
  Shopping:       { icon: "🛍️", color: "#3b2f00" },
  Other:          { icon: "📋", color: "#374151" },
};

const DEFAULT_FORM = { description: "", amount: "", category: "Expense", date: "", type: "expense" };

function fmtDate(v) {
  if (!v) return "—";
  return new Date(v + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function normalizeTransaction(raw) {
  const amount = Number.parseFloat(raw?.amount ?? raw?.total ?? 0);
  const category = CATEGORIES.includes(raw?.category) ? raw.category : "Other";
  const type = raw?.type === "income" ? "income" : "expense";
  const fallbackDate = raw?.created_at ? String(raw.created_at).slice(0, 10) : "";

  return {
    id: raw?.id ?? `${Date.now()}-${Math.random()}`,
    description: raw?.description || raw?.merchant_name || raw?.place_name || "Untitled transaction",
    amount: Number.isFinite(amount) ? amount : 0,
    category,
    date: raw?.date || fallbackDate,
    type,
  };
}

// ── Payment handle helpers ───────────────────────────────────────────────────

function getPaymentHandles(userId) {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(`payment_handles_${userId}`) || "{}");
  } catch {
    return {};
  }
}

function savePaymentHandles(userId, handles) {
  if (!userId) return;
  localStorage.setItem(`payment_handles_${userId}`, JSON.stringify(handles));
}

// Build deep-link URLs for the three apps
function buildVenmoUrl(handle, amount, note = "TravelerHub") {
  if (handle) {
    return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handle)}&amount=${amount}&note=${encodeURIComponent(note)}`;
  }
  return `venmo://paycharge?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
}

function buildPaypalUrl(handle, amount) {
  if (handle) return `https://paypal.me/${encodeURIComponent(handle)}/${amount}`;
  return "https://www.paypal.com/myaccount/transfer/homepage/pay";
}

function buildCashAppUrl(handle, amount) {
  if (handle) return `https://cash.app/$${encodeURIComponent(handle)}/${amount}`;
  return "https://cash.app/";
}

// Small icon buttons row shown beneath each settlement step
function PaymentButtons({ toUserId, amount }) {
  const handles = getPaymentHandles(toUserId);
  const amtStr = Number(amount).toFixed(2);

  const buttons = [
    {
      label: "Venmo",
      color: "#3D95CE",
      bg: "#e8f4fb",
      href: buildVenmoUrl(handles.venmo, amtStr),
      // Venmo SVG mark (simplified)
      icon: (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <path d="M20.8 1.8c.7 1.1 1 2.3 1 3.9 0 4.8-4.1 11.1-7.5 15.5H6.4L3 2.3l6.4-.6 1.8 13.5c1.7-2.8 3.8-7.2 3.8-10.2 0-1.6-.3-2.8-.8-3.8l6.6-.4z" fill="#3D95CE"/>
        </svg>
      ),
    },
    {
      label: "PayPal",
      color: "#003087",
      bg: "#e8eef6",
      href: buildPaypalUrl(handles.paypal, amtStr),
      icon: (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <path d="M19.5 7.5C19.5 11.09 16.59 14 13 14H9.5l-1.5 8H4L7 2h8c2.49 0 4.5 2.01 4.5 5.5z" fill="#009cde"/>
          <path d="M21.5 9C21.5 12.59 18.59 15.5 15 15.5h-3.5l-1 6H7l2.5-13H17c2.49 0 4.5 2.01 4.5 5z" fill="#003087" opacity=".6"/>
        </svg>
      ),
    },
    {
      label: "Cash App",
      color: "#00C244",
      bg: "#e6faea",
      href: buildCashAppUrl(handles.cashapp, amtStr),
      icon: (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="5" fill="#00C244"/>
          <path d="M13.4 8.2c1.1.2 2.1.7 2.8 1.5l-1.5 1.5c-.4-.5-1-.8-1.7-.9-.5-.1-1 0-1.4.3-.3.2-.4.5-.3.8.1.3.4.5 1 .7l1 .3c.9.3 1.6.7 2 1.3.4.6.5 1.3.3 2-.2.8-.8 1.4-1.6 1.8-.5.2-1.1.4-1.7.4v1.4h-1.4v-1.4c-1.2-.2-2.3-.8-3-1.8l1.6-1.4c.5.7 1.2 1.1 2 1.2.5.1 1 0 1.4-.2.3-.2.5-.5.4-.9-.1-.3-.4-.5-1.1-.8l-1-.3c-.9-.3-1.5-.7-1.9-1.2-.4-.6-.5-1.3-.3-2 .2-.7.7-1.3 1.5-1.7.5-.2 1-.4 1.6-.4V6.9h1.4l-.1 1.3z" fill="#fff"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {buttons.map((btn) => (
        <a
          key={btn.label}
          href={btn.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Pay with ${btn.label}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 6,
            background: btn.bg,
            color: btn.color,
            fontSize: 11,
            fontWeight: 600,
            textDecoration: "none",
            border: `1px solid ${btn.color}30`,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {btn.icon}
          {btn.label}
        </a>
      ))}
    </div>
  );
}

// Modal to set payment handles for the current user
function PaymentHandlesModal({ userId, onClose }) {
  const [handles, setHandles] = useState(() => getPaymentHandles(userId));

  const handleSave = () => {
    savePaymentHandles(userId, handles);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{ maxWidth: 420, background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#160f29" }}>Payment Handles</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
              Used for Venmo, PayPal & Cash App deep-links
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
            style={{ color: "#5c6b73" }}
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            { key: "venmo", label: "Venmo username", placeholder: "@username" },
            { key: "paypal", label: "PayPal.me handle", placeholder: "yourname" },
            { key: "cashapp", label: "Cash App $cashtag", placeholder: "$cashtag" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                {label}
              </label>
              <input
                type="text"
                value={handles[key] || ""}
                onChange={(e) => setHandles((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{ border: "1px solid #d1d5db" }}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#f3f4f6", color: "#5c6b73" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#160f29", color: "#fbfbf2" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Finance() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [savedCards, setSavedCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [chargeForm, setChargeForm] = useState({ payment_method_id: "", amount: "", description: "" });
  const [chargeError, setChargeError] = useState("");
  const [chargeSuccess, setChargeSuccess] = useState("");
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupIdState] = useState("");
  const [activeTab, setActiveTab] = useState("transactions"); // transactions | balances
  const [balances, setBalances] = useState(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [splitModalExpense, setSplitModalExpense] = useState(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [settledSteps, setSettledSteps] = useState(new Set());
  const [stepSettling, setStepSettling] = useState(null);
  const [showHandlesModal, setShowHandlesModal] = useState(false);

  // Currency conversion state
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [rates, setRates] = useState(null);

  // Current logged-in user id (for localStorage keying)
  const currentUserId = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      const u = stored ? JSON.parse(stored) : null;
      return u?.id || u?.user_id || "";
    } catch {
      return "";
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const allGroups = await getMyGroups();
      setGroups(allGroups);

      let groupId = getActiveGroupId();
      const hasSelected = allGroups.some((g) => String(g.group_id || g.id) === String(groupId));
      if (!hasSelected) {
        groupId = await ensureActiveGroupId();
      }
      setActiveGroupIdState(groupId || "");
    } catch {
      setGroups([]);
      setActiveGroupIdState("");
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const rows = await getFinanceTransactions(activeGroupId || null);
      setTransactions(rows.map(normalizeTransaction));
    } catch (error) {
      setLoadError(error?.message || "Failed to load transactions");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeGroupId]);

  const loadBalances = useCallback(async () => {
    if (!activeGroupId) return;
    setBalancesLoading(true);
    try {
      const data = await getTripBalances(activeGroupId);
      setBalances(data);
    } catch {
      setBalances(null);
    } finally {
      setBalancesLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const loadSummary = useCallback(async () => {
    if (!activeGroupId) return;
    setSummaryLoading(true);
    try {
      const data = await getSettlementSummary(activeGroupId);
      setSummary(data);
      setSettledSteps(new Set());
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    if (activeTab === "balances") loadBalances();
  }, [activeTab, loadBalances]);

  useEffect(() => {
    if (activeTab === "settlement") loadSummary();
  }, [activeTab, loadSummary]);

  useEffect(() => {
    getExchangeRates('USD').then(setRates).catch(() => {});
  }, []);

  const handleSplitExpense = async (expenseId) => {
    setSplitLoading(true);
    try {
      await splitExpense(expenseId);
      setSplitModalExpense(null);
      if (activeTab === "balances") loadBalances();
    } catch (error) {
      setLoadError(error?.message || "Failed to split expense");
    } finally {
      setSplitLoading(false);
    }
  };

  const handleSettle = async (transfer) => {
    setSettleLoading(transfer.from_user_id + transfer.to_user_id);
    try {
      await recordSettlement({
        tripId: activeGroupId,
        toUserId: transfer.to_user_id,
        amount: transfer.amount,
      });
      await loadBalances();
    } catch (error) {
      setLoadError(error?.message || "Failed to record settlement");
    } finally {
      setSettleLoading(null);
    }
  };

  const handleSettleStep = async (step, idx) => {
    setStepSettling(idx);
    try {
      await recordSettlement({
        tripId: activeGroupId,
        toUserId: step.to_user_id,
        amount: step.amount,
      });
      setSettledSteps((prev) => new Set([...prev, idx]));
    } catch (error) {
      setLoadError(error?.message || "Failed to record settlement");
    } finally {
      setStepSettling(null);
    }
  };

  const openChargeModal = async () => {
    setChargeError("");
    setChargeSuccess("");
    setCardsLoading(true);
    try {
      const cards = await getSavedCards();
      setSavedCards(cards);
      setChargeForm((prev) => ({
        ...prev,
        payment_method_id: cards[0]?.payment_method_id || "",
      }));
      setShowChargeModal(true);
    } catch (error) {
      setChargeError(error?.message || "Failed to load saved cards");
      setShowChargeModal(true);
    } finally {
      setCardsLoading(false);
    }
  };

  const handleChargeCard = async (e) => {
    e.preventDefault();
    setChargeError("");
    setChargeSuccess("");

    const amountNumber = Number.parseFloat(chargeForm.amount);
    if (!chargeForm.payment_method_id) {
      setChargeError("Please select a saved card.");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setChargeError("Please enter a valid charge amount.");
      return;
    }

    try {
      await chargeSavedCard({
        payment_method_id: chargeForm.payment_method_id,
        amount_minor: Math.round(amountNumber * 100),
        currency: "usd",
        description: chargeForm.description || "TravelerHub charge",
      });

      setChargeSuccess("Charge submitted successfully.");
      setChargeForm({ payment_method_id: chargeForm.payment_method_id, amount: "", description: "" });
    } catch (error) {
      setChargeError(error?.message || "Failed to charge card");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (formData.description && formData.amount && formData.date) {
      try {
        const created = await createFinanceTransaction({
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category,
          date: formData.date,
          type: formData.type,
          currency: "USD",
          trip_id: activeGroupId || null,
        });

        setTransactions((prev) => [normalizeTransaction(created), ...prev]);
          setFormData(DEFAULT_FORM);
        setShowModal(false);
      } catch (error) {
        setLoadError(error?.message || "Failed to save transaction");
      }
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteFinanceTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      setLoadError(error?.message || "Failed to delete transaction");
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalExpenses = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const balance = totalIncome - totalExpenses;

  // Per-category totals for the spending bar
  const categoryTotals = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  // Currency formatting helper — converts and formats an amount
  const fmt = useCallback((amount, originalCurrency = 'USD') => {
    const sym = CURRENCY_SYMBOLS[originalCurrency] || '';
    const dispSym = CURRENCY_SYMBOLS[displayCurrency] || '';
    if (!rates || displayCurrency === originalCurrency) {
      return `${sym}${Number(amount).toFixed(2)}`;
    }
    const converted = convertAmount(amount, originalCurrency, displayCurrency, rates);
    return `${dispSym}${converted.toFixed(2)}`;
  }, [rates, displayCurrency]);

  // Returns true when the displayed amount differs from the stored currency
  const isConverted = useCallback((originalCurrency = 'USD') => {
    return rates && displayCurrency !== (originalCurrency || 'USD');
  }, [rates, displayCurrency]);

  const sortedTransactions = useMemo(() => {
    const list = [...transactions];

    list.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "description") {
        comparison = (a.description || "").localeCompare(b.description || "", undefined, { sensitivity: "base" });
      } else if (sortBy === "category") {
        comparison = (a.category || "").localeCompare(b.category || "", undefined, { sensitivity: "base" });
      } else if (sortBy === "amount") {
        comparison = (a.amount || 0) - (b.amount || 0);
      } else {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        comparison = aDate - bDate;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return list;
  }, [transactions, sortBy, sortDir]);

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

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.path === "/finance";
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
                  if (item.path && !isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Add Transaction shortcut */}
        <div className="px-3 pb-6">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition"
            style={{ background: "#183a37", color: "#fbfbf2" }}
          >
            + Add Transaction
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-6">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#160f29" }}>Finance</h1>
              <p className="text-sm mt-0.5" style={{ color: "#5c6b73" }}>
                Track travel expenses, income, and your overall trip balance.
              </p>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "#6b7280" }}>Group</span>
                <select
                  value={activeGroupId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveGroupId(value);
                    setActiveGroupIdState(value);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ border: "1px solid #d1d5db", background: "#fff", color: "#111827" }}
                >
                  {groups.length === 0 ? (
                    <option value="">No groups</option>
                  ) : (
                    groups.map((group) => {
                      const gid = group.group_id || group.id;
                      return (
                        <option key={gid} value={gid}>
                          {group.name || "Untitled Group"}
                        </option>
                      );
                    })
                  )}
                </select>

                {/* Currency selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: "#6b7280" }}>Display in</span>
                  <select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: "1px solid #d1d5db", background: "#fff", color: "#111827" }}
                    title="Choose display currency"
                  >
                    {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD', 'THB', 'MXN'].map((c) => (
                      <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || ''} {c}</option>
                    ))}
                  </select>
                  {displayCurrency !== 'USD' && rates && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}
                    >
                      live rates
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openChargeModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ background: "#183a37", color: "#fbfbf2" }}
              >
                Charge Card
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ background: "#160f29", color: "#fbfbf2" }}
              >
                + Add Transaction
              </button>
            </div>
          </div>

          {/* ── Tab switcher ─────────────────────────────────────────────── */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl flex-wrap" style={{ background: "#e5e7eb", width: "fit-content" }}>
            {[
              { id: "transactions", label: "Transactions", icon: "💳" },
              { id: "balances",     label: "Balances & Splits", icon: "⚖️" },
              { id: "settlement",   label: "Settlement", icon: "🤝" },
              { id: "budget",       label: "Budget", icon: "📊" },
              { id: "cards",        label: "Card Wallet", icon: "🪪" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition"
                style={
                  activeTab === tab.id
                    ? { background: "#fff", color: "#160f29", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { background: "transparent", color: "#6b7280" }
                }
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── Summary cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Expenses */}
            <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: "#fef2f2" }}
                >
                  💸
                </div>
                <p className="text-xs font-medium" style={{ color: "#5c6b73" }}>Total Expenses</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#dc2626" }}>
                {fmt(totalExpenses, 'USD')}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                {transactions.filter((t) => t.type === "expense").length} transactions
                {isConverted('USD') && <span style={{ color: "#2563eb" }}> ≈ converted</span>}
              </p>
            </div>

            {/* Income */}
            <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: "#f0fdf4" }}
                >
                  💵
                </div>
                <p className="text-xs font-medium" style={{ color: "#5c6b73" }}>Total Income</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>
                {fmt(totalIncome, 'USD')}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                {transactions.filter((t) => t.type === "income").length} transactions
                {isConverted('USD') && <span style={{ color: "#2563eb" }}> ≈ converted</span>}
              </p>
            </div>

            {/* Balance */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: balance >= 0 ? "#160f29" : "#fff",
                border: balance >= 0 ? "none" : "1px solid #e5e7eb",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: balance >= 0 ? "rgba(255,255,255,0.1)" : "#fef3c7" }}
                >
                  {balance >= 0 ? "✅" : "⚠️"}
                </div>
                <p
                  className="text-xs font-medium"
                  style={{ color: balance >= 0 ? "rgba(251,251,242,0.6)" : "#5c6b73" }}
                >
                  Balance
                </p>
              </div>
              <p
                className="text-2xl font-bold"
                style={{ color: balance >= 0 ? "#fbfbf2" : "#d97706" }}
              >
                {balance >= 0 ? "+" : "-"}{fmt(Math.abs(balance), 'USD')}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: balance >= 0 ? "rgba(251,251,242,0.4)" : "#9ca3af" }}
              >
                {balance >= 0 ? "On budget" : "Over budget"}
                {isConverted('USD') && <span style={{ color: balance >= 0 ? "#93c5fd" : "#2563eb" }}> ≈ converted</span>}
              </p>
            </div>
          </div>

          {activeTab === "transactions" && (
          <>
          {/* ── Spending breakdown bar ─────────────────────────────────────── */}
          {totalExpenses > 0 && (
            <div
              className="rounded-2xl p-5 mb-6"
              style={{ background: "#fff", border: "1px solid #e5e7eb" }}
            >
              <p className="text-sm font-semibold mb-4" style={{ color: "#160f29" }}>
                Spending by Category
              </p>
              <div className="space-y-2.5">
                {CATEGORIES.filter((c) => categoryTotals[c]).map((cat) => {
                  const pct = Math.round((categoryTotals[cat] / totalExpenses) * 100);
                  const meta = CATEGORY_META[cat];
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-sm w-28 shrink-0" style={{ color: "#374151" }}>
                        {meta.icon} {cat}
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: "#f3f4f6" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: meta.color }}
                        />
                      </div>
                      <span className="text-xs w-20 text-right shrink-0" style={{ color: "#5c6b73" }}>
                        {fmt(categoryTotals[cat], 'USD')} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Filter row ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "#fff", color: "#5c6b73", border: "1px solid #e5e7eb" }}
              >
                <option value="description">Sort: Description</option>
                <option value="category">Sort: Category</option>
                <option value="date">Sort: Date</option>
                <option value="amount">Sort: Amount</option>
              </select>
              <button
                onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                style={{ background: "#160f29", color: "#fbfbf2" }}
              >
                {sortDir === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
          </div>

          {/* ── Transaction list ───────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
            {/* Table header */}
            <div
              className="hidden md:grid px-5 py-3 text-xs font-semibold uppercase tracking-wide"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                borderBottom: "1px solid #f3f4f6",
                color: "#9ca3af",
              }}
            >
              <span>Description</span>
              <span>Category</span>
              <span>Date</span>
              <span>Amount</span>
              <span />
            </div>

            {isLoading ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium" style={{ color: "#374151" }}>Loading transactions...</p>
              </div>
            ) : loadError ? (
              <div className="py-16 text-center px-6">
                <p className="text-sm font-medium" style={{ color: "#b91c1c" }}>Could not load transactions</p>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{loadError}</p>
                <button
                  onClick={loadTransactions}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "#160f29", color: "#fbfbf2" }}
                >
                  Retry
                </button>
              </div>
            ) : sortedTransactions.length === 0 ? (
              <EmptyState
                icon="💸"
                title="No expenses yet"
                subtitle="Add your first expense to start tracking the group budget."
              />
            ) : (
              sortedTransactions.map((t, idx) => {
                const meta = CATEGORY_META[t.category] || CATEGORY_META.Other;
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap md:grid items-center gap-3 px-5 py-4 transition"
                    style={{
                      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                      borderTop: idx > 0 ? "1px solid #f9fafb" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Description */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                        style={{ background: `${meta.color}18` }}
                      >
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#160f29" }}>
                          {t.description}
                        </p>
                        {/* Show category on mobile */}
                        <p className="text-xs md:hidden" style={{ color: "#5c6b73" }}>{t.category}</p>
                      </div>
                    </div>

                    {/* Category */}
                    <p className="hidden md:block text-sm" style={{ color: "#5c6b73" }}>{t.category}</p>

                    {/* Date */}
                    <p className="hidden md:block text-sm" style={{ color: "#5c6b73" }}>{fmtDate(t.date)}</p>

                    {/* Amount + type */}
                    <div className="flex flex-col gap-1 md:gap-0">
                      <span
                        className="text-sm font-bold"
                        style={{ color: t.type === "expense" ? "#dc2626" : "#16a34a" }}
                      >
                        {t.type === "expense" ? "−" : "+"}{fmt(t.amount, t.currency || 'USD')}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium capitalize w-fit"
                          style={
                            t.type === "expense"
                              ? { background: "#fef2f2", color: "#dc2626" }
                              : { background: "#f0fdf4", color: "#16a34a" }
                          }
                        >
                          {t.type}
                        </span>
                        {isConverted(t.currency || 'USD') && (
                          <span className="text-xs" style={{ color: "#2563eb" }}>≈</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {activeGroupId && t.type === "expense" && (
                        <button
                          onClick={() => setSplitModalExpense(t)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition shrink-0"
                          style={{ color: "#9ca3af" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#9ca3af";
                          }}
                          title="Split with group"
                        >
                          ✂️
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition shrink-0"
                        style={{ color: "#9ca3af" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fef2f2";
                          e.currentTarget.style.color = "#dc2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#9ca3af";
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </>
          )}

          {/* ── Balances & Splits tab ─────────────────────────────────────── */}
          {activeTab === "balances" && (
            <div className="space-y-6">
              {!activeGroupId ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-3xl mb-3">👥</p>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>Select a group to view balances</p>
                </div>
              ) : balancesLoading ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>Loading balances...</p>
                </div>
              ) : !balances ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>No balance data available</p>
                  <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>Split some expenses first using the Transactions tab</p>
                </div>
              ) : (
                <>
                  {/* All settled banner */}
                  {balances.all_settled && (
                    <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#15803d" }}>All settled up!</p>
                        <p className="text-xs" style={{ color: "#16a34a" }}>No outstanding debts in this group.</p>
                      </div>
                    </div>
                  )}

                  {/* Member balances */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    <div className="px-5 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <p className="text-sm font-bold" style={{ color: "#160f29" }}>Member Balances</p>
                    </div>
                    {(balances.member_balances || []).map((m) => (
                      <div key={m.user_id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f9fafb" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#f3f4f6", color: "#374151" }}>
                            {(m.username || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium" style={{ color: "#160f29" }}>{m.username}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className="text-sm font-bold"
                            style={{ color: m.status === "owed" ? "#16a34a" : m.status === "owes" ? "#dc2626" : "#6b7280" }}
                          >
                            {m.status === "owed" ? "+" : m.status === "owes" ? "-" : ""}${Math.abs(m.net_balance).toFixed(2)}
                          </span>
                          <p className="text-xs capitalize" style={{ color: "#9ca3af" }}>{m.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Suggested transfers */}
                  {balances.suggested_transfers?.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                      <div className="px-5 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <p className="text-sm font-bold" style={{ color: "#160f29" }}>Settle Up</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>Minimum transfers to settle all debts</p>
                      </div>
                      {balances.suggested_transfers.map((t, i) => {
                        const isSettling = settleLoading === t.from_user_id + t.to_user_id;
                        return (
                          <div key={i} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f9fafb" }}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold" style={{ color: "#dc2626" }}>{t.from_username}</span>
                                <span style={{ color: "#9ca3af" }}>pays</span>
                                <span className="font-semibold" style={{ color: "#16a34a" }}>{t.to_username}</span>
                                <span className="font-bold" style={{ color: "#160f29" }}>${t.amount.toFixed(2)}</span>
                              </div>
                              <PaymentButtons toUserId={t.to_user_id} amount={t.amount} />
                            </div>
                            <button
                              onClick={() => handleSettle(t)}
                              disabled={isSettling}
                              className="px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ml-3"
                              style={{ background: isSettling ? "#d1d5db" : "#183a37", color: "#fbfbf2" }}
                            >
                              {isSettling ? "Settling..." : "Mark Settled"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Settlement tab ───────────────────────────────────────────── */}
          {activeTab === "settlement" && (
            <div className="space-y-6">
              {!activeGroupId ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-3xl mb-3">🤝</p>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>Select a group to view settlement</p>
                </div>
              ) : summaryLoading ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>Loading settlement summary...</p>
                </div>
              ) : !summary ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>No data available</p>
                  <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>Add group expenses first</p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  {(() => {
                    const unsettled = (summary.settlements || []).filter((_, i) => !settledSteps.has(i)).length;
                    return (
                      <div
                        className="rounded-2xl px-6 py-4 flex flex-wrap items-center gap-4"
                        style={{ background: "#160f29", color: "#fbfbf2" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: "rgba(251,251,242,0.6)" }}>Total spent</span>
                          <span className="text-sm font-bold">${summary.total_spent.toFixed(2)}</span>
                        </div>
                        <span style={{ color: "rgba(251,251,242,0.3)" }}>·</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: "rgba(251,251,242,0.6)" }}>Per person</span>
                          <span className="text-sm font-bold">${summary.per_person_share.toFixed(2)}</span>
                        </div>
                        <span style={{ color: "rgba(251,251,242,0.3)" }}>·</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-bold"
                            style={{ color: unsettled === 0 ? "#4ade80" : "#fbbf24" }}
                          >
                            {unsettled === 0 ? "All settled up!" : `${unsettled} unsettled payment${unsettled !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Balance cards row */}
                  <div>
                    <p className="text-sm font-semibold mb-3" style={{ color: "#160f29" }}>Member Balances</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {(summary.balances || []).map((m) => {
                        const isOwed = m.net_balance > 0.005;
                        const isOwes = m.net_balance < -0.005;
                        return (
                          <div
                            key={m.user_id}
                            className="rounded-2xl p-4 flex flex-col items-center text-center"
                            style={{
                              background: "#fff",
                              border: `2px solid ${isOwed ? "#bbf7d0" : isOwes ? "#fecaca" : "#e5e7eb"}`,
                            }}
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2"
                              style={{
                                background: isOwed ? "#f0fdf4" : isOwes ? "#fef2f2" : "#f3f4f6",
                                color: isOwed ? "#15803d" : isOwes ? "#b91c1c" : "#6b7280",
                              }}
                            >
                              {(m.username || "?")[0].toUpperCase()}
                            </div>
                            <p className="text-xs font-semibold mb-1 truncate w-full" style={{ color: "#160f29" }}>
                              {m.username}
                            </p>
                            <p
                              className="text-base font-bold"
                              style={{ color: isOwed ? "#16a34a" : isOwes ? "#dc2626" : "#6b7280" }}
                            >
                              {isOwed ? "+" : isOwes ? "-" : ""}${Math.abs(m.net_balance).toFixed(2)}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                              {isOwed ? "gets back" : isOwes ? "owes" : "settled"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* How to settle up */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#160f29" }}>How to settle up</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                          Minimum transfers to balance everyone out
                        </p>
                      </div>
                      <button
                        onClick={() => setShowHandlesModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                        style={{ background: "#f3f4f6", color: "#5c6b73", border: "1px solid #e5e7eb" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#e8e8e0")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                        title="Set your Venmo / PayPal / Cash App handles"
                      >
                        💳 My handles
                      </button>
                    </div>

                    {(summary.settlements || []).length === 0 ? (
                      <div className="py-10 text-center px-6">
                        <p className="text-2xl mb-2">✅</p>
                        <p className="text-sm font-semibold" style={{ color: "#15803d" }}>All settled up!</p>
                        <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>No payments needed.</p>
                      </div>
                    ) : (
                      (summary.settlements || []).map((step, idx) => {
                        const isDone = settledSteps.has(idx);
                        const isSettlingThis = stepSettling === idx;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-5 py-4"
                            style={{
                              borderBottom: idx < summary.settlements.length - 1 ? "1px solid #f9fafb" : "none",
                              opacity: isDone ? 0.55 : 1,
                            }}
                          >
                            <div className="flex flex-col min-w-0 flex-1 mr-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span
                                className="font-semibold shrink-0"
                                style={{
                                  color: isDone ? "#9ca3af" : "#dc2626",
                                  textDecoration: isDone ? "line-through" : "none",
                                }}
                              >
                                {step.from_user}
                              </span>
                              <span style={{ color: "#9ca3af" }} className="shrink-0">pays</span>
                              <span
                                className="font-semibold shrink-0"
                                style={{
                                  color: isDone ? "#9ca3af" : "#16a34a",
                                  textDecoration: isDone ? "line-through" : "none",
                                }}
                              >
                                {step.to_user}
                              </span>
                              <span
                                className="font-bold shrink-0"
                                style={{
                                  color: isDone ? "#9ca3af" : "#160f29",
                                  textDecoration: isDone ? "line-through" : "none",
                                }}
                              >
                                ${step.amount.toFixed(2)}
                              </span>
                            </div>
                            {!isDone && (
                              <PaymentButtons
                                toUserId={step.to_user_id}
                                amount={step.amount}
                              />
                            )}
                            </div>
                            {isDone ? (
                              <div
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
                                style={{ background: "#f0fdf4", color: "#15803d" }}
                              >
                                <span>✓</span> Settled
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSettleStep(step, idx)}
                                disabled={isSettlingThis}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0"
                                style={{
                                  background: isSettlingThis ? "#d1d5db" : "#183a37",
                                  color: "#fbfbf2",
                                }}
                              >
                                {isSettlingThis ? "..." : "✓ Mark settled"}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Budget tab ───────────────────────────────────────────────── */}
          {activeTab === "budget" && (
            <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #e5e7eb", maxWidth: 640 }}>
              <BudgetTracker tripId={activeGroupId} />
            </div>
          )}

          {/* ── Card Wallet tab ──────────────────────────────────────────── */}
          {activeTab === "cards" && (
            <div className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #e5e7eb", maxWidth: 720 }}>
              <CardWallet />
            </div>
          )}

        </main>
      </div>

      {/* ── Split Expense Modal ───────────────────────────────────────────── */}
      {splitModalExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSplitModalExpense(null)}
        >
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{ maxWidth: 420, background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <h2 className="text-base font-bold" style={{ color: "#160f29" }}>Split Expense</h2>
              <button
                onClick={() => setSplitModalExpense(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
                style={{ color: "#5c6b73" }}
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-4" style={{ background: "#f9fafb" }}>
                <p className="text-sm font-semibold" style={{ color: "#160f29" }}>{splitModalExpense.description}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: "#dc2626" }}>${splitModalExpense.amount.toFixed(2)}</p>
              </div>
              <p className="text-xs" style={{ color: "#6b7280" }}>
                This will split the expense equally among all group members. The person who paid will be credited.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSplitModalExpense(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "#f3f4f6", color: "#5c6b73" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSplitExpense(splitModalExpense.id)}
                  disabled={splitLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: splitLoading ? "#d1d5db" : "#160f29", color: "#fbfbf2" }}
                >
                  {splitLoading ? "Splitting..." : "Split Equally"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Transaction Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{
              maxWidth: 520,
              background: "#fff",
              boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #f3f4f6" }}
            >
              <h2 className="text-base font-bold" style={{ color: "#160f29" }}>
                Add Transaction
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition"
                style={{ color: "#5c6b73" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                ✕
              </button>
            </div>

            {/* Type selector */}
            <div className="px-6 pt-5 pb-0 flex gap-2">
              {["expense", "income"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      type: t,
                      category: t === "expense" ? "Expense" : "Income",
                    }))
                  }
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition"
                  style={
                    formData.type === t
                      ? t === "expense"
                        ? { background: "#fef2f2", color: "#dc2626", border: "2px solid #fecaca" }
                        : { background: "#f0fdf4", color: "#16a34a", border: "2px solid #bbf7d0" }
                      : { background: "#f9fafb", color: "#9ca3af", border: "2px solid transparent" }
                  }
                >
                  {t === "expense" ? "💸 Expense" : "💵 Income"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleAddTransaction} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g., Hotel stay in Tokyo"
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #d1d5db" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ border: "1px solid #d1d5db" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                  Category (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        category: prev.type === "expense" ? "Expense" : "Income",
                      }))
                    }
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                    style={
                      formData.category === (formData.type === "expense" ? "Expense" : "Income")
                        ? { background: "#160f29", color: "#fbfbf2" }
                        : { background: "#f3f4f6", color: "#374151" }
                    }
                  >
                    {formData.type === "expense" ? "💸 Expense (Default)" : "💵 Income (Default)"}
                  </button>
                  {CATEGORIES.filter((cat) => cat !== "Expense" && cat !== "Income").map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, category: cat }))}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                      style={
                        formData.category === cat
                          ? { background: "#160f29", color: "#fbfbf2" }
                          : { background: "#f3f4f6", color: "#374151" }
                      }
                    >
                      {CATEGORY_META[cat].icon} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card recommendation — shown when amount > 0 */}
              {formData.type === "expense" && parseFloat(formData.amount) > 0 && (
                <CardRecommendation
                  category={formData.category}
                  amount={parseFloat(formData.amount)}
                />
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: "#f3f4f6", color: "#5c6b73" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: "#160f29", color: "#fbfbf2" }}
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment Handles Modal ────────────────────────────────────────────── */}
      {showHandlesModal && (
        <PaymentHandlesModal
          userId={currentUserId}
          onClose={() => setShowHandlesModal(false)}
        />
      )}

      {/* ── Charge Card Modal ─────────────────────────────────────────────── */}
      {showChargeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowChargeModal(false)}
        >
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{ maxWidth: 520, background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <h2 className="text-base font-bold" style={{ color: "#160f29" }}>Charge Saved Card</h2>
              <button
                onClick={() => setShowChargeModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition"
                style={{ color: "#5c6b73" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChargeCard} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                  Saved Card
                </label>
                <select
                  value={chargeForm.payment_method_id}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, payment_method_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #d1d5db" }}
                  disabled={cardsLoading || savedCards.length === 0}
                  required
                >
                  {savedCards.length === 0 ? (
                    <option value="">No saved cards available</option>
                  ) : (
                    savedCards.map((card) => (
                      <option key={card.id || card.payment_method_id} value={card.payment_method_id}>
                        {(card.brand || "CARD").toUpperCase()} •••• {card.last4 || "----"}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #d1d5db" }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5c6b73" }}>
                  Description
                </label>
                <input
                  type="text"
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional charge description"
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #d1d5db" }}
                />
              </div>

              {chargeError && (
                <p className="text-xs" style={{ color: "#b91c1c" }}>{chargeError}</p>
              )}
              {chargeSuccess && (
                <p className="text-xs" style={{ color: "#15803d" }}>{chargeSuccess}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: "#f3f4f6", color: "#5c6b73" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: "#183a37", color: "#fbfbf2" }}
                  disabled={savedCards.length === 0}
                >
                  Charge Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Finance;
