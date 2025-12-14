// src/api.js

const BASE_URL = "http://127.0.0.1:8000";

// ======== HELPER FUNCTIONS ===============

function getToken() {
  return localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");
}
  
function setToken(token) {
  localStorage.setItem("accessToken", token);
}

async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const token = auth ? getToken() : null;
  
  // Detect if we are sending a file (FormData) or JSON
  const isFormData = body instanceof FormData;

  const defaultHeaders = {
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  // Only add JSON content-type if it's NOT a file upload
  if (!isFormData && body) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: defaultHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return true;

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  if (!res.ok) {
    const detail = (data && data.detail) ? data.detail : data;
    // Fixed typo here: removed 'VX' from stringify
    throw new Error(`${method} ${path} ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return data;
}

// ========= AUTH =========
export async function login(email, password) {
  const data = await request("/login", {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });
  if (data?.access_token) setToken(data.access_token);
  return data;
}

export async function registerUser({ email, username, password }) {
  return request("/users", { method: "POST", body: { email, username, password } });
}

// ========= IMAGES (NEW) =========
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file); 

  return request("/images/upload", {
    method: "POST",
    body: formData, 
  });
}