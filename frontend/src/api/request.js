// src/api/request.js

const API_BASE = "http://127.0.0.1:8000"; // change if needed

export async function request(url, options = {}) {
  const { method = "GET", body, headers = {} } = options;

  const authHeaders = {};
  const token = localStorage.getItem("token"); // Assumes token is stored here
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${url}`, config);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
    let errorMessage = "Request failed";
    try {
      const err = await response.json();
      errorMessage = err.detail || JSON.stringify(err);
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  // If DELETE or some POST returns no body
  if (response.status === 204) return null;

  return response.json();
}
