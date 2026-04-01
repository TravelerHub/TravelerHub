import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem('token');
}

function authJsonHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractError(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data?.detail || data?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function createCardSetupSession() {
  const res = await fetch(`${API_BASE}/billing/create-setup-session`, {
    method: 'POST',
    headers: authJsonHeaders(),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to start card setup'));
  }
  return res.json();
}

export async function finalizeCardSetup(sessionId) {
  const res = await fetch(`${API_BASE}/billing/finalize-setup`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to finalize card setup'));
  }
  return res.json();
}

export async function getSavedCards() {
  const res = await fetch(`${API_BASE}/billing/payment-methods`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to load saved cards'));
  }
  const data = await res.json();
  return data.cards || [];
}

export async function encryptCardPayload(cardPayload) {
  const fromLocalStorage =
    localStorage.getItem('card_symmetric_key') ||
    localStorage.getItem('symmetric_key') ||
    localStorage.getItem('session_key');

  const sharedKey = fromLocalStorage;
  if (!sharedKey) {
    throw new Error('Missing symmetric key in localStorage (card_symmetric_key/symmetric_key/session_key)');
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(sharedKey));
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt']);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(cardPayload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const cipherBytes = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return bytesToBase64(combined);
}

export async function addEncryptedCard({ encryptedPayload, brand, last4 }) {
  const res = await fetch(`${API_BASE}/billing/payment-methods/encrypted`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ encrypted_payload: encryptedPayload, brand, last4 }),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to save encrypted card'));
  }

  return res.json();
}

export async function addManualCard({ brand, last4 }) {
  const res = await fetch(`${API_BASE}/billing/payment-methods/manual`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ brand, last4 }),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to save manual card'));
  }

  return res.json();
}

export async function chargeSavedCard(payload) {
  const res = await fetch(`${API_BASE}/billing/charge`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to charge saved card'));
  }
  return res.json();
}

export async function removeSavedCard(fundingSourceId) {
  const res = await fetch(`${API_BASE}/billing/payment-methods/${fundingSourceId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!res.ok) {
    throw new Error(await extractError(res, 'Failed to remove saved card'));
  }

  return res.json();
}
