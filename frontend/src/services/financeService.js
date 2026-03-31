import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token');
}

export async function getFinanceTransactions(tripId = null) {
  const params = new URLSearchParams();
  if (tripId) params.append('trip_id', tripId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/finance/transactions${query}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load finance transactions');
  }

  const payload = await response.json();
  return payload.transactions || [];
}

export async function createFinanceTransaction(data) {
  const response = await fetch(`${API_BASE}/finance/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create finance transaction');
  }

  const payload = await response.json();
  return payload.transaction;
}

export async function deleteFinanceTransaction(transactionId) {
  const response = await fetch(`${API_BASE}/finance/transactions/${transactionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete finance transaction');
  }
}
