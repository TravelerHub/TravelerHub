import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

export async function getCards() {
  const res = await fetch(`${API_BASE}/cards/`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
}

export async function getCardPresets() {
  const res = await fetch(`${API_BASE}/cards/presets`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch presets');
  return res.json();
}

export async function addCard(data) {
  const res = await fetch(`${API_BASE}/cards/`, {
    method: 'POST', headers: headers(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add card');
  return res.json();
}

export async function updateCard(cardId, data) {
  const res = await fetch(`${API_BASE}/cards/${cardId}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update card');
  return res.json();
}

export async function deleteCard(cardId) {
  await fetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE', headers: headers() });
}

export async function recommendCard(category, amount, merchantName = null) {
  const res = await fetch(`${API_BASE}/cards/recommend`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ category, amount, merchant_name: merchantName }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getTripSavings(tripId) {
  const res = await fetch(`${API_BASE}/cards/savings/${tripId}`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

export async function getBudgets(tripId) {
  const res = await fetch(`${API_BASE}/finance/budget/${tripId}`, { headers: headers() });
  if (!res.ok) return [];
  return res.json();
}

export async function upsertBudget(tripId, category, amount, currency = 'USD') {
  const res = await fetch(`${API_BASE}/finance/budget/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ trip_id: tripId, category, amount, currency }),
  });
  if (!res.ok) throw new Error('Failed to save budget');
  return res.json();
}

export async function getBudgetStatus(tripId) {
  const res = await fetch(`${API_BASE}/finance/budget/${tripId}/status`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}
