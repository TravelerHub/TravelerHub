/**
 * CardWallet — lets users manage their credit/debit cards and see
 * per-category cashback rates. Cards are used by the recommendation engine
 * to suggest the best card for each purchase category.
 *
 * Props: none (reads/writes to server directly)
 */

import { useState, useEffect, useCallback } from 'react';
import { getCards, getCardPresets, addCard, updateCard, deleteCard } from '../services/cardService';

const CATEGORIES = [
  { key: 'dining',        label: 'Dining',        emoji: '🍽️' },
  { key: 'groceries',     label: 'Groceries',      emoji: '🛒' },
  { key: 'travel',        label: 'Travel',         emoji: '✈️' },
  { key: 'hotels',        label: 'Hotels',         emoji: '🏨' },
  { key: 'flights',       label: 'Flights',        emoji: '🛫' },
  { key: 'gas',           label: 'Gas',            emoji: '⛽' },
  { key: 'transit',       label: 'Transit',        emoji: '🚌' },
  { key: 'entertainment', label: 'Entertainment',  emoji: '🎡' },
  { key: 'shopping',      label: 'Shopping',       emoji: '🛍️' },
  { key: 'other',         label: 'Everything else',emoji: '💳' },
];

const CARD_COLORS = [
  '#183a37', '#160f29', '#1e3a5f', '#2d1b4e',
  '#3b1f1f', '#374151', '#1a3320', '#4a2500',
];

const NETWORKS = ['visa', 'mastercard', 'amex', 'discover', 'other'];

const NETWORK_ICON = {
  visa:       'VISA',
  mastercard: 'MC',
  amex:       'AMEX',
  discover:   'DISC',
  other:      '💳',
};

const EMPTY_RATES = Object.fromEntries(CATEGORIES.map((c) => [c.key, '']));

function CardVisual({ card }) {
  const net = NETWORK_ICON[card.card_network] || '💳';
  return (
    <div
      className="relative rounded-2xl p-4 text-white overflow-hidden select-none"
      style={{
        background: `linear-gradient(135deg, ${card.color || '#183a37'} 0%, #000 100%)`,
        minHeight: 130,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-medium opacity-60 mb-0.5 uppercase tracking-widest">
            {card.card_network || 'Card'}
          </p>
          <p className="font-bold text-base leading-tight">{card.card_name}</p>
        </div>
        <span className="text-xs font-black opacity-70 tracking-wider">{net}</span>
      </div>
      {card.last_four && (
        <p className="absolute bottom-4 left-4 text-sm font-mono opacity-60">
          •••• {card.last_four}
        </p>
      )}
      {card.is_default && (
        <span className="absolute bottom-4 right-4 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
          Default
        </span>
      )}
    </div>
  );
}

export default function CardWallet() {
  const [cards, setCards] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    card_name: '', card_network: 'visa', last_four: '',
    color: CARD_COLORS[0], is_default: false, category_rates: { ...EMPTY_RATES },
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const [c, p] = await Promise.all([getCards(), getCardPresets()]);
      setCards(c);
      setPresets(p);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const resetForm = () => {
    setForm({
      card_name: '', card_network: 'visa', last_four: '',
      color: CARD_COLORS[0], is_default: false,
      category_rates: { ...EMPTY_RATES },
    });
    setEditing(null);
    setShowAdd(false);
  };

  const openEdit = (card) => {
    const rates = { ...EMPTY_RATES };
    Object.entries(card.category_rates || {}).forEach(([k, v]) => { rates[k] = String(v); });
    setForm({
      card_name: card.card_name,
      card_network: card.card_network || 'visa',
      last_four: card.last_four || '',
      color: card.color || CARD_COLORS[0],
      is_default: card.is_default,
      category_rates: rates,
    });
    setEditing(card.id);
    setShowAdd(true);
  };

  const loadPreset = (preset) => {
    const rates = { ...EMPTY_RATES };
    Object.entries(preset.category_rates || {}).forEach(([k, v]) => { rates[k] = String(v); });
    setForm((prev) => ({
      ...prev,
      card_name: preset.card_name,
      card_network: preset.card_network || 'visa',
      category_rates: rates,
    }));
    setShowPresets(false);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.card_name.trim()) return;
    setSaving(true);
    try {
      const cleanRates = {};
      Object.entries(form.category_rates).forEach(([k, v]) => {
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) cleanRates[k] = n;
      });
      const payload = {
        card_name: form.card_name.trim(),
        card_network: form.card_network,
        last_four: form.last_four.trim() || null,
        color: form.color,
        is_default: form.is_default,
        category_rates: cleanRates,
      };
      if (editing) {
        const updated = await updateCard(editing, payload);
        setCards((prev) => prev.map((c) => (c.id === editing ? updated : c)));
      } else {
        const created = await addCard(payload);
        setCards((prev) => [...prev, created]);
      }
      resetForm();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await deleteCard(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#160f29' }}>Card Wallet</h3>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
            Add your cards to get cashback recommendations on every purchase.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresets(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-gray-100"
            style={{ border: '1px solid #e5e7eb', color: '#374151' }}
          >
            Browse Presets
          </button>
          <button
            onClick={() => { setShowAdd(true); setEditing(null); setForm({ card_name: '', card_network: 'visa', last_four: '', color: CARD_COLORS[0], is_default: false, category_rates: { ...EMPTY_RATES } }); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{ background: '#000', color: '#fff' }}
          >
            + Add Card
          </button>
        </div>
      </div>

      {/* Card grid */}
      {loading && <p className="text-xs py-4" style={{ color: '#9ca3af' }}>Loading…</p>}

      {!loading && cards.length === 0 && !showAdd && (
        <div
          className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          style={{ border: '2px dashed #e5e7eb' }}
        >
          <span className="text-4xl">💳</span>
          <p className="font-medium text-sm" style={{ color: '#374151' }}>No cards yet</p>
          <p className="text-xs max-w-xs" style={{ color: '#9ca3af' }}>
            Add your credit cards to see which one earns the most cashback for each expense category on your trip.
          </p>
          <button
            onClick={() => setShowPresets(true)}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: '#183a37', color: '#fff' }}
          >
            Browse Popular Cards →
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.id} className="space-y-2">
            <CardVisual card={card} />
            <div className="flex gap-1.5">
              <button
                onClick={() => openEdit(card)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition hover:bg-gray-100"
                style={{ border: '1px solid #e5e7eb', color: '#374151' }}
              >
                Edit rates
              </button>
              <button
                onClick={() => setDeleteConfirm(card.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-red-50"
                style={{ border: '1px solid #fecaca', color: '#ef4444' }}
              >
                Remove
              </button>
            </div>

            {/* Mini cashback table */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f3f4f6' }}>
              {CATEGORIES.filter((c) => (card.category_rates || {})[c.key]).slice(0, 4).map((cat) => {
                const rate = (card.category_rates || {})[cat.key];
                return (
                  <div key={cat.key} className="flex items-center justify-between px-3 py-1.5 text-xs border-b last:border-0" style={{ borderColor: '#f9fafb' }}>
                    <span style={{ color: '#6b7280' }}>{cat.emoji} {cat.label}</span>
                    <span className="font-semibold" style={{ color: '#183a37' }}>{rate}%</span>
                  </div>
                );
              })}
              {Object.keys(card.category_rates || {}).length === 0 && (
                <p className="text-xs px-3 py-2" style={{ color: '#9ca3af' }}>No rates set</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 max-w-xs w-full mx-4 shadow-xl" style={{ background: '#fff' }}>
            <p className="font-semibold text-sm mb-2" style={{ color: '#160f29' }}>Remove card?</p>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>This won't affect your past expense recommendations.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ border: '1px solid #e5e7eb', color: '#374151' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-500 text-white">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showAdd && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm" style={{ color: '#160f29' }}>
              {editing ? 'Edit Card' : 'Add Card'}
            </p>
            <button onClick={resetForm} className="text-xs" style={{ color: '#9ca3af' }}>Cancel</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Card Name *</label>
              <input
                value={form.card_name}
                onChange={(e) => setForm((p) => ({ ...p, card_name: e.target.value }))}
                placeholder="e.g. Chase Sapphire Preferred"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Network</label>
              <select
                value={form.card_network}
                onChange={(e) => setForm((p) => ({ ...p, card_network: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}
              >
                {NETWORKS.map((n) => <option key={n} value={n}>{n.toUpperCase()}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Last 4 digits (optional)</label>
              <input
                value={form.last_four}
                onChange={(e) => setForm((p) => ({ ...p, last_four: e.target.value.slice(0, 4) }))}
                placeholder="1234"
                maxLength={4}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#374151' }}>Card Color</label>
            <div className="flex gap-2">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className="w-7 h-7 rounded-full transition"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    boxShadow: form.color === c ? '0 0 0 2px #fff' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <CardVisual card={{ ...form, category_rates: {} }} />

          {/* Cashback rates */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#374151' }}>Cashback / Rewards Rates (%)</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-center gap-2">
                  <span className="text-base w-5">{cat.emoji}</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    placeholder="0"
                    value={form.category_rates[cat.key]}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      category_rates: { ...p.category_rates, [cat.key]: e.target.value },
                    }))}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#111827' }}
                  />
                  <span className="text-xs w-3" style={{ color: '#9ca3af' }}>%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="default-card"
              checked={form.is_default}
              onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="default-card" className="text-xs" style={{ color: '#374151' }}>
              Set as default card
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.card_name.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            style={{ background: '#000', color: '#fff' }}
          >
            {saving ? 'Saving…' : editing ? 'Update Card' : 'Add Card'}
          </button>
        </div>
      )}

      {/* Presets modal */}
      {showPresets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" style={{ background: '#fff' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f3f4f6' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#160f29' }}>Popular Cards</p>
                <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>Select a card to pre-fill its rates</p>
              </div>
              <button onClick={() => setShowPresets(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPreset(p)}
                  className="w-full text-left px-4 py-3 rounded-xl transition hover:bg-gray-50"
                  style={{ border: '1px solid #e5e7eb' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#160f29' }}>{p.card_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        {p.issuer} · {p.card_network?.toUpperCase()} · {p.annual_fee ? `$${p.annual_fee}/yr` : 'No annual fee'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[140px] justify-end">
                      {Object.entries(p.category_rates || {}).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                          {v}% {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  {p.travel_perks?.length > 0 && (
                    <p className="text-[10px] mt-1.5" style={{ color: '#6b7280' }}>
                      ✓ {p.travel_perks.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
