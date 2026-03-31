import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  getFinanceTransactions,
} from "../../services/financeService";

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

function Finance() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const rows = await getFinanceTransactions();
      setTransactions(rows.map(normalizeTransaction));
    } catch (error) {
      setLoadError(error?.message || "Failed to load transactions");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              style={{ background: "#160f29", color: "#fbfbf2" }}
            >
              + Add Transaction
            </button>
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
                ${totalExpenses.toFixed(2)}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                {transactions.filter((t) => t.type === "expense").length} transactions
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
                ${totalIncome.toFixed(2)}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                {transactions.filter((t) => t.type === "income").length} transactions
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
                {balance >= 0 ? "+" : ""}${balance.toFixed(2)}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: balance >= 0 ? "rgba(251,251,242,0.4)" : "#9ca3af" }}
              >
                {balance >= 0 ? "On budget" : "Over budget"}
              </p>
            </div>
          </div>

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
                      <span className="text-xs w-16 text-right shrink-0" style={{ color: "#5c6b73" }}>
                        ${categoryTotals[cat].toFixed(0)} · {pct}%
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
              <div className="py-16 text-center">
                <p className="text-3xl mb-3">💳</p>
                <p className="text-sm font-medium" style={{ color: "#374151" }}>No transactions</p>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>Add your first transaction to get started</p>
              </div>
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
                        {t.type === "expense" ? "−" : "+"}${t.amount.toFixed(2)}
                      </span>
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
                    </div>

                    {/* Delete */}
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
                );
              })
            )}
          </div>
        </main>
      </div>

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
    </div>
  );
}

export default Finance;
