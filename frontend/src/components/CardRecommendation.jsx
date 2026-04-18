/**
 * CardRecommendation — shown inline when a user selects a category + amount
 * in the expense form. Fetches the best card from the optimizer API and shows:
 *   - "Use [Card] for 4% back = $X"
 *   - Comparison with runner-up
 *
 * Props:
 *   category   — expense category string (e.g. "Dining")
 *   amount     — numeric amount
 *   compact    — show just the badge, not the full card (default false)
 */

import { useEffect, useState } from 'react';
import { recommendCard } from '../services/cardService';

const NETWORK_BADGE = {
  visa:       { bg: '#1a1f71', text: '#fff', label: 'VISA' },
  mastercard: { bg: '#eb001b', text: '#fff', label: 'MC' },
  amex:       { bg: '#016fd0', text: '#fff', label: 'AMEX' },
  discover:   { bg: '#f76f20', text: '#fff', label: 'DISC' },
};

export default function CardRecommendation({ category, amount, compact = false }) {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category || !amount || amount <= 0) { setRec(null); return; }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await recommendCard(category, amount);
        setRec(data);
      } catch { setRec(null); }
      finally { setLoading(false); }
    }, 400); // debounce

    return () => clearTimeout(t);
  }, [category, amount]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#9ca3af' }}>
        <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Checking best card…
      </div>
    );
  }

  if (!rec?.recommendation) return null;

  const best = rec.recommendation;
  const badge = NETWORK_BADGE[best.card_network] || { bg: '#374151', text: '#fff', label: '💳' };

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
      >
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-black"
          style={{ background: badge.bg, color: badge.text }}
        >
          {badge.label}
        </span>
        <span className="font-semibold" style={{ color: '#166534' }}>
          Use {best.card_name}
        </span>
        <span style={{ color: '#16a34a' }}>
          → {best.rate_pct}% back = ${best.estimated_cashback}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Card color swatch */}
          <div
            className="w-10 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black text-white"
            style={{ background: best.color || '#183a37' }}
          >
            {badge.label}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: '#166534' }}>
              Best card for {category.toLowerCase()}
            </p>
            <p className="text-sm font-bold mt-0.5" style={{ color: '#160f29' }}>
              Use {best.card_name}
              {best.last_four && <span className="font-normal text-xs ml-1" style={{ color: '#6b7280' }}>••{best.last_four}</span>}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-lg font-bold leading-none" style={{ color: '#16a34a' }}>
              {best.rate_pct}%
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              = ${best.estimated_cashback} back
            </p>
          </div>
        </div>

        {/* Runner-up comparison */}
        {rec.runner_up && rec.runner_up.estimated_cashback < best.estimated_cashback && (
          <div className="mt-2.5 pt-2.5 border-t flex items-center justify-between" style={{ borderColor: '#bbf7d0' }}>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              vs {rec.runner_up.card_name}: {rec.runner_up.rate_pct}% = ${rec.runner_up.estimated_cashback}
            </p>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#dcfce7', color: '#166534' }}
            >
              +${(best.estimated_cashback - rec.runner_up.estimated_cashback).toFixed(2)} more
            </span>
          </div>
        )}

        {/* Only one card — prompt to add more */}
        {rec.all_cards?.length === 1 && (
          <p className="text-[10px] mt-2" style={{ color: '#9ca3af' }}>
            Add more cards in Card Wallet to compare.
          </p>
        )}
      </div>

      {/* Tip bar */}
      {rec.tip && (
        <div className="px-4 py-2" style={{ background: '#dcfce7' }}>
          <p className="text-[10px]" style={{ color: '#166534' }}>💡 {rec.tip}</p>
        </div>
      )}
    </div>
  );
}
