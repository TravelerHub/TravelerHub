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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Travel Preferences
      </h2>
      <p className="text-gray-500 text-sm mb-5">
        Personalize your place suggestions and search results
      </p>

      {/* Success / Error */}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Favorite Place Types */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-3">
            What places do you enjoy visiting?
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleItem("preferred_categories", cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition ${
                  preferences.preferred_categories.includes(cat.id)
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Price Preference */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-3">
            Price range preference
          </label>
          <div className="flex gap-2">
            {PRICE_OPTIONS.map((price) => (
              <button
                key={price.id}
                onClick={() =>
                  setPreferences((prev) => ({
                    ...prev,
                    price_preference: price.id,
                  }))
                }
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition text-center ${
                  preferences.price_preference === price.id
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="text-lg">{price.symbol}</div>
                <div className="text-xs mt-0.5">{price.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-3">
            Your travel interests
          </label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest.id}
                onClick={() => toggleItem("interests", interest.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition ${
                  preferences.interests.includes(interest.id)
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{interest.emoji}</span>
                <span>{interest.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dietary Restrictions */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-3">
            Dietary restrictions
          </label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((diet) => (
              <button
                key={diet.id}
                onClick={() => toggleItem("dietary_restrictions", diet.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition ${
                  preferences.dietary_restrictions.includes(diet.id)
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{diet.emoji}</span>
                <span>{diet.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-blue-400"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}