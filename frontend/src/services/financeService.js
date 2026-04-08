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

// ── Expense Splitting ────────────────────────────────────────────────────────

export async function splitExpense(expenseId, { splitRule = 'equal', memberIds = null, shares = null } = {}) {
  const body = { split_rule: splitRule };
  if (memberIds) body.member_ids = memberIds;
  if (shares) body.shares = shares;

  const response = await fetch(`${API_BASE}/finance/split/${expenseId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to split expense');
  }

  return response.json();
}

export async function getTripBalances(tripId) {
  const response = await fetch(`${API_BASE}/finance/balances/${tripId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load trip balances');
  }

  return response.json();
}

export async function recordSettlement({ tripId, toUserId, amount, currency = 'USD', method = 'manual', note = '' }) {
  const response = await fetch(`${API_BASE}/finance/settle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trip_id: tripId,
      to_user_id: toUserId,
      amount,
      currency,
      method,
      note,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to record settlement');
  }

  return response.json();
}

export async function getTripSettlements(tripId) {
  const response = await fetch(`${API_BASE}/finance/settlements/${tripId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load settlements');
  }

  const payload = await response.json();
  return payload.settlements || [];
}
