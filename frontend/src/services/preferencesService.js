const BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

export const getPreferences = async () => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/preferences/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Failed to fetch preferences");
  return response.json();
};

export const updatePreferences = async (prefs) => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/preferences/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) throw new Error("Failed to update preferences");
  return response.json();
};

// Available options for the UI
export const CATEGORY_OPTIONS = [
  { id: "restaurant", label: "Restaurants", emoji: "🍽️" },
  { id: "cafe", label: "Cafes", emoji: "☕" },
  { id: "lodging", label: "Hotels", emoji: "🏨" },
  { id: "tourist_attraction", label: "Attractions", emoji: "🎭" },
  { id: "museum", label: "Museums", emoji: "🏛️" },
  { id: "park", label: "Parks", emoji: "🌳" },
  { id: "shopping_mall", label: "Shopping", emoji: "🛍️" },
  { id: "night_club", label: "Nightlife", emoji: "🌙" },
  { id: "spa", label: "Spa & Wellness", emoji: "💆" },
  { id: "gym", label: "Fitness", emoji: "💪" },
];

export const PRICE_OPTIONS = [
  { id: "budget", label: "Budget", symbol: "$" },
  { id: "moderate", label: "Moderate", symbol: "$$" },
  { id: "expensive", label: "Expensive", symbol: "$$$" },
  { id: "any", label: "Any Price", symbol: "All" },
];

export const INTEREST_OPTIONS = [
  { id: "history", label: "History", emoji: "📜" },
  { id: "nature", label: "Nature", emoji: "🏔️" },
  { id: "food", label: "Food & Drink", emoji: "🍕" },
  { id: "art", label: "Art & Culture", emoji: "🎨" },
  { id: "adventure", label: "Adventure", emoji: "🧗" },
  { id: "beach", label: "Beach", emoji: "🏖️" },
  { id: "nightlife", label: "Nightlife", emoji: "🎶" },
  { id: "shopping", label: "Shopping", emoji: "🛒" },
  { id: "photography", label: "Photography", emoji: "📸" },
  { id: "architecture", label: "Architecture", emoji: "🏗️" },
];

export const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian", emoji: "🥬" },
  { id: "vegan", label: "Vegan", emoji: "🌱" },
  { id: "halal", label: "Halal", emoji: "🍖" },
  { id: "kosher", label: "Kosher", emoji: "✡️" },
  { id: "gluten_free", label: "Gluten-Free", emoji: "🌾" },
  { id: "none", label: "No Restrictions", emoji: "✅" },
];