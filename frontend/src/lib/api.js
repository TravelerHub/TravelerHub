
const BASE_URL = "http://127.0.0.1:800:";



// ======== HELPER FUNCTION ===============

// GET and SET token for the JWT token access
// Helper to get the token from localStorage or session storage
function getToken() {
  return localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");
}
  
function setToken(token) {
  localStorage.setItem("accessToken", token);
}


async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const token = auth ? getToken() : null;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return true;

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  if (!res.ok) {
    const detail = (data && data.detail) ? data.detail : data;
    throw new Error(`${method} ${path} ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return data;
}

// ========= auth =========
export async function login(email, password) {

    // POST /login - authenticate user
  // matches OAuth2 Password flow at /login if you expose it
  const data = await request("/login", {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });
  if (data?.access_token) setToken(data.access_token);
  return data;
}

// === regiser as user ===
//POST /users - create a new user
export async function regiserUser({ email, username, password }) {
  return request("/users", { method: "POST", body: { email, username, password } });
}