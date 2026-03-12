import { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getExpenseMarkers } from '../services/discoveryService';

// Category → color mapping for expense markers
const CATEGORY_COLORS = {
  Accommodation: '#3B82F6',
  Transportation: '#8B5CF6',
  Dining: '#EF4444',
  Activities: '#F59E0B',
  Shopping: '#EC4899',
  Other: '#6B7280',
};

/**
 * ExpenseMarkers — fetches geo-tagged expenses and formats them for the Map.
 * The actual rendering on the map is handled by the Map component via the
 * `expenseMarkers` prop. This component provides the control panel.
 *
 * Props:
 *   tripId          — filter by trip
 *   onMarkersLoad   — callback(markers) formatted for map display
 *   visible         — whether the panel is visible
 *   onClose         — callback to hide
 */
export default function ExpenseMarkers({ tripId, onMarkersLoad, visible, onClose }) {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);

  useEffect(() => {
    if (visible) loadMarkers();
  }, [visible, tripId]);

  useEffect(() => {
    // Send filtered markers to parent
    const filtered = categoryFilter
      ? markers.filter(m => m.category === categoryFilter)
      : markers;

    onMarkersLoad?.(
      filtered.map(m => ({
        coordinates: m.coordinates,
        name: m.merchant_name,
        amount: m.total,
        currency: m.currency,
        category: m.category,
        color: CATEGORY_COLORS[m.category] || CATEGORY_COLORS.Other,
        // Size based on amount: small ($0-20), medium ($20-50), large ($50+)
        size: m.total < 20 ? 'small' : m.total < 50 ? 'medium' : 'large',
      }))
    );
  }, [markers, categoryFilter]);

  async function loadMarkers() {
    setLoading(true);
    try {
      const data = await getExpenseMarkers(tripId);
      setMarkers(data.markers || []);
    } catch (err) {
      console.error('Failed to load expense markers:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  // Category summary
  const categories = {};
  markers.forEach(m => {
    const cat = m.category || 'Other';
    if (!categories[cat]) categories[cat] = { count: 0, total: 0 };
    categories[cat].count++;
    categories[cat].total += m.total;
  });

  const totalSpent = markers.reduce((sum, m) => sum + m.total, 0);

  return (
    <div className="absolute bottom-24 right-4 z-20 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
        <div className="flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5" />
          <span className="font-semibold text-sm">Expense Map</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Total */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-2xl font-bold text-gray-800">
          ${totalSpent.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">{markers.length} expenses on map</p>
      </div>

      {/* Category filters */}
      <div className="px-4 py-3 space-y-1.5">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
            !categoryFilter ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
          }`}
        >
          <span className="text-gray-700">All Categories</span>
          <span className="text-gray-400">{markers.length}</span>
        </button>
        {Object.entries(categories)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([cat, stats]) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                categoryFilter === cat ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other }}
                />
                <span className="text-gray-700">{cat}</span>
              </div>
              <span className="text-gray-400">
                ${stats.total.toFixed(0)} ({stats.count})
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
