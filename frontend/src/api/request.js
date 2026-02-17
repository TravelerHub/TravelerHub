// src/api/request.js

const API_BASE = "http://127.0.0.1:8000"; // change if needed

export async function request(url, options = {}) {
  const { method = "GET", body, headers = {} } = options;

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${url}`, config);

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const err = await response.json();
      errorMessage = err.detail || JSON.stringify(err);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  // If DELETE returns no body
  if (response.status === 204) return null;

  return response.json();
}
