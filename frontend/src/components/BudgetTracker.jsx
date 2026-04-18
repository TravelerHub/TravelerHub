/**
 * BudgetTracker — per-category budget bars with actual vs budgeted spend.
 * Also shows trip-level savings analysis (cashback earned vs missed).
 *
 * Props:
 *   tripId      — the active trip UUID
 *   onBudgetSet — optional callback when a budget is saved
 */

import { useState, useEffect, useCallback } from 'react';
import { getBudgetStatus, upsertBudget, getTripSavings } from '../services/cardService';

const CATEGORY_META = {
  Dining:         { emoji: '🍽️', color: '#be185d' },
  Accommodation:  { emoji: '🏨', color: '#1d4ed8' },
  Transportation: { emoji: '✈️', color: '#0f766e' },
  Activities:     { emoji: '🎡', color: '#7c3aed' },
  Shopping:       { emoji: '🛍️', color: '#b45309' },
  Expense:        { emoji: '💸', color: '#dc2626' },
  Other:          { emoji: '📋', color: '#374151' },
};

const STATUS_COLOR = {
  ok:      { bar: '#22c55e', bg: '#f0fdf4', text: '#166534' },
  warning: { bar: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  over:    { bar: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
};

export default function BudgetTracker({ tripId, onBudgetSet }) {
  const [status, setStatus] = useState(null);
  const [savings, setSavings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('budget'); // budget | savings

  const fetchAll = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const [s, sv] = await Promise.all([getBudgetStatus(tripId), getTripSavings(tripId)]);
      setStatus(s);
      setSavings(sv);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tripId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveBudget = async (category) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt < 0) return;
    setSaving(true);
    try {
      await upsertBudget(tripId, category, amt);
      await fetchAll();
      setEditingCat(null);
      setEditAmount('');
      onBudgetSet?.();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  if (!tripId) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <span className="text-2xl">📊</span>
        <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
          Select a trip to track your budget.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#f3f4f6' }}>
        {[
          { id: 'budget', label: '📊 Budget' },
          { id: 'savings', label: '💳 Card Savings' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition"
            style={{
              background: activeTab === t.id ? '#ffffff' : 'transparent',
              color: activeTab === t.id ? '#160f29' : '#6b7280',
              boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs py-4" style={{ color: '#9ca3af' }}>Loading…</p>}

      {/* ── BUDGET TAB ──────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'budget' && (
        <div className="space-y-3">
          {/* Overall summary */}
          {status && (
            <div className="rounded-xl p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6b7280' }}>
                  Trip Total
                </p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: status.overall_pct >= 100 ? '#fef2f2' : status.overall_pct >= 80 ? '#fffbeb' : '#f0fdf4',
                    color: status.overall_pct >= 100 ? '#991b1b' : status.overall_pct >= 80 ? '#92400e' : '#166534',
                  }}
                >
                  {status.overall_pct}% used
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: '#e5e7eb' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(status.overall_pct, 100)}%`,
                    background: status.overall_pct >= 100 ? '#ef4444' : status.overall_pct >= 80 ? '#f59e0b' : '#22c55e',
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Budgeted', value: `$${status.total_budgeted?.toFixed(0) || 0}`, color: '#374151' },
                  { label: 'Spent',    value: `$${status.total_spent?.toFixed(0) || 0}`,    color: '#dc2626' },
                  { label: 'Left',     value: `$${status.total_remaining?.toFixed(0) || 0}`, color: '#16a34a' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: '#9ca3af' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-category bars */}
          {(!status || status.categories.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="text-3xl">📋</span>
              <p className="text-xs font-medium" style={{ color: '#374151' }}>No budget set yet</p>
              <p className="text-xs text-center max-w-xs" style={{ color: '#9ca3af' }}>
                Click the ✏️ next to any category below to set a spending target.
              </p>
            </div>
          )}

          {(status?.categories || []).map((cat) => {
            const meta = CATEGORY_META[cat.category] || CATEGORY_META.Other;
            const sc = STATUS_COLOR[cat.status] || STATUS_COLOR.ok;
            const isEditing = editingCat === cat.category;

            return (
              <div key={cat.category} className="rounded-xl p-3" style={{ border: '1px solid #e5e7eb', background: sc.bg }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.emoji}</span>
                    <span className="text-xs font-semibold" style={{ color: '#160f29' }}>{cat.category}</span>
                    {cat.status === 'over' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#fef2f2', color: '#991b1b' }}>
                        Over budget!
                      </span>
                    )}
                    {cat.status === 'warning' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#fffbeb', color: '#92400e' }}>
                        Near limit
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setEditingCat(cat.category); setEditAmount(String(cat.budgeted || '')); }}
                    className="text-xs opacity-50 hover:opacity-100 transition"
                    title="Set budget"
                  >
                    ✏️
                  </button>
                </div>

                {isEditing ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Budget amount"
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                      style={{ border: '1px solid #d1d5db', background: '#fff', color: '#111827' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBudget(cat.category); if (e.key === 'Escape') setEditingCat(null); }}
                    />
                    <button
                      onClick={() => handleSaveBudget(cat.category)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: '#000', color: '#fff' }}
                    >
                      {saving ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingCat(null)} className="text-xs" style={{ color: '#9ca3af' }}>✕</button>
                  </div>
                ) : null}

                <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(0,0,0,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(cat.pct_used, 100)}%`,
                      background: sc.bar,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[10px]" style={{ color: sc.text }}>
                  <span>${cat.spent.toFixed(0)} spent</span>
                  {cat.budgeted > 0 ? (
                    <span>${cat.remaining.toFixed(0)} left of ${cat.budgeted.toFixed(0)}</span>
                  ) : (
                    <span className="opacity-60">No budget set</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add budget for untracked category */}
          <button
            onClick={() => setEditingCat('__new__')}
            className="w-full py-2.5 rounded-xl text-xs font-medium transition hover:bg-gray-100"
            style={{ border: '1px dashed #d1d5db', color: '#6b7280' }}
          >
            + Set budget for a category
          </button>

          {editingCat === '__new__' && (
            <div className="rounded-xl p-3 space-y-2" style={{ border: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <select
                onChange={(e) => setEditingCat(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}
                defaultValue=""
              >
                <option value="" disabled>Select category…</option>
                {Object.keys(CATEGORY_META).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── CARD SAVINGS TAB ────────────────────────────────────────────────── */}
      {!loading && activeTab === 'savings' && savings && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="rounded-xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>
                  ${savings.total_cashback_earned?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#166534' }}>Earned this trip</p>
              </div>
              {savings.total_missed_savings > 0 && (
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>
                    ${savings.total_missed_savings?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#991b1b' }}>Left on the table</p>
                </div>
              )}
            </div>
          </div>

          {/* Missed savings breakdown */}
          {savings.top_missed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#6b7280' }}>
                Where you missed savings
              </p>
              {savings.top_missed.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-3 rounded-xl mb-1.5"
                  style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
                >
                  <span className="text-lg shrink-0">
                    {CATEGORY_META[m.category]?.emoji || '💸'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
                      Used: {m.card_used}
                    </p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      Should have used: <span className="font-semibold text-green-700">{m.optimal_card}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                      ${m.amount.toFixed(2)} {m.category} — missed ${m.missed.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!savings.top_missed || savings.top_missed.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-semibold" style={{ color: '#374151' }}>Optimized spending!</p>
              <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
                No missed savings detected. Add more expenses to track savings across your trip.
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'savings' && !savings && (
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="text-2xl">💳</span>
          <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
            Add your cards in Card Wallet to see savings analysis.
          </p>
        </div>
      )}
    </div>
  );
}
