const BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

export const getFavorites = async (category = null) => {
  const token = getToken();
  let url = `${BASE_URL}/favorites/`;
  if (category) url += `?category=${category}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Failed to fetch favorites");
  return response.json();
};

export const addFavorite = async (place) => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/favorites/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      place_id: place.id,
      place_name: place.name,
      place_address: place.address || null,
      coordinates: place.coordinates,
      category: place.types?.[0] || place.category || null,
      photos: place.photos || null,
      rating: place.rating || null,
      user_notes: null,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to add favorite");
  }
  return response.json();
};

export const removeFavorite = async (placeId) => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/favorites/${placeId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Failed to remove favorite");
  return response.json();
};

export const checkFavorite = async (placeId) => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/favorites/check/${placeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return { is_favorite: false };
  return response.json();
};

export const updateFavoriteNotes = async (placeId, notes) => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/favorites/${placeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_notes: notes }),
  });

  if (!response.ok) throw new Error("Failed to update favorite");
  return response.json();
};