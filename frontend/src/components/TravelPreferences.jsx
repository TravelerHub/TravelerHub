import { useState, useEffect } from "react";
import {
  getPreferences,
  updatePreferences,
  CATEGORY_OPTIONS,
  PRICE_OPTIONS,
  INTEREST_OPTIONS,
  DIETARY_OPTIONS,
} from "../services/preferencesservice.js";

export default function TravelPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [preferences, setPreferences] = useState({
    preferred_categories: [],
    price_preference: "moderate",
    dietary_restrictions: [],
    interests: [],
    avoid_types: [],
  });

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await getPreferences();
      setPreferences({
        preferred_categories: data.preferred_categories || [],
        price_preference: data.price_preference || "moderate",
        dietary_restrictions: data.dietary_restrictions || [],
        interests: data.interests || [],
        avoid_types: data.avoid_types || [],
      });
    } catch (err) {
      console.error("Error loading preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (field, itemId) => {
    setPreferences((prev) => {
      const current = prev[field];
      const updated = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      return { ...prev, [field]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updatePreferences(preferences);
      setSuccess("Preferences saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-2">
        <div className="h-4 rounded-full w-40" style={{ background: "#f3f4f6" }} />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 rounded-full" style={{ background: "#f3f4f6" }} />
          ))}
        </div>
        <div className="h-4 rounded-full w-32 mt-2" style={{ background: "#f3f4f6" }} />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 flex-1 rounded-xl" style={{ background: "#f3f4f6" }} />
          ))}
        </div>
      </div>
    );
  }

  const sectionLabel = (text) => (
    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9ca3af" }}>
      {text}
    </p>
  );

  const pill = (isActive, onClick, emoji, label) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition"
      style={
        isActive
          ? { background: "#160f29", color: "#fbfbf2" }
          : { background: "#f3f4f6", color: "#374151" }
      }
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#e5e7eb"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "#f3f4f6"; }}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">

      {/* Success / Error */}
      {success && (
        <div className="text-sm px-4 py-2.5 rounded-xl" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
          {success}
        </div>
      )}
      {error && (
        <div className="text-sm px-4 py-2.5 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {/* Favorite Place Types */}
      <div>
        {sectionLabel("What places do you enjoy visiting?")}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((cat) =>
            pill(
              preferences.preferred_categories.includes(cat.id),
              () => toggleItem("preferred_categories", cat.id),
              cat.emoji,
              cat.label
            )
          )}
        </div>
      </div>

      {/* Price Preference */}
      <div>
        {sectionLabel("Price range preference")}
        <div className="flex gap-2">
          {PRICE_OPTIONS.map((price) => {
            const isActive = preferences.price_preference === price.id;
            return (
              <button
                key={price.id}
                onClick={() => setPreferences((prev) => ({ ...prev, price_preference: price.id }))}
                className="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition text-center"
                style={
                  isActive
                    ? { background: "#183a37", color: "#fbfbf2", border: "1px solid #183a37" }
                    : { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#e5e7eb"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "#f3f4f6"; }}
              >
                <div className="text-base font-bold">{price.symbol}</div>
                <div className="text-xs mt-0.5 opacity-80">{price.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interests */}
      <div>
        {sectionLabel("Your travel interests")}
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) =>
            pill(
              preferences.interests.includes(interest.id),
              () => toggleItem("interests", interest.id),
              interest.emoji,
              interest.label
            )
          )}
        </div>
      </div>

      {/* Dietary Restrictions */}
      <div>
        {sectionLabel("Dietary restrictions")}
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((diet) =>
            pill(
              preferences.dietary_restrictions.includes(diet.id),
              () => toggleItem("dietary_restrictions", diet.id),
              diet.emoji,
              diet.label
            )
          )}
        </div>
      </div>

      {/* Navigation Settings */}
      <div>
        {sectionLabel("Navigation intelligence")}
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
            style={{ background: preferences.park_and_walk_auto ? '#dcfce7' : '#f3f4f6' }}>
            <div>
              <span className="text-sm font-medium" style={{ color: '#160f29' }}>Auto Park & Walk</span>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Suggest parking + walking in congested areas</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.park_and_walk_auto || false}
              onChange={() => setPreferences(p => ({ ...p, park_and_walk_auto: !p.park_and_walk_auto }))}
              className="rounded text-green-600 focus:ring-green-500 w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
            style={{ background: preferences.silent_mode ? '#dbeafe' : '#f3f4f6' }}>
            <div>
              <span className="text-sm font-medium" style={{ color: '#160f29' }}>Silent Mode</span>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Only high-priority alerts (hazards). Group ETA stays visual.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.silent_mode || false}
              onChange={() => setPreferences(p => ({ ...p, silent_mode: !p.silent_mode }))}
              className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
        style={
          saving
            ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" }
            : { background: "#160f29", color: "#fbfbf2" }
        }
      >
        {saving ? "Saving…" : "Save Preferences"}
      </button>
    </div>
  );
}