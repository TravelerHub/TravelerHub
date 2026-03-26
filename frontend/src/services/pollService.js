import { API_BASE } from "../config";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const handleResponse = async (res) => {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.detail || JSON.stringify(err);
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
};

export const pollService = {
  listByTrip: (tripId) =>
    fetch(`${API_BASE}/polls/trip/${tripId}`, { headers: authHeaders() })
      .then(handleResponse),

  getPoll: (pollId) =>
    fetch(`${API_BASE}/polls/${pollId}`, { headers: authHeaders() })
      .then(handleResponse),

  createPoll: (body) =>
    fetch(`${API_BASE}/polls/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  addOption: (pollId, body) =>
    fetch(`${API_BASE}/polls/${pollId}/options`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  removeOption: (pollId, optionId) =>
    fetch(`${API_BASE}/polls/${pollId}/options/${optionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(handleResponse),

  vote: (pollId, optionId) =>
    fetch(`${API_BASE}/polls/${pollId}/vote`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ option_id: optionId }),
    }).then(handleResponse),

  removeVote: (pollId) =>
    fetch(`${API_BASE}/polls/${pollId}/vote`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(handleResponse),

  closePoll: (pollId) =>
    fetch(`${API_BASE}/polls/${pollId}/close`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handleResponse),

  reopenPoll: (pollId) =>
    fetch(`${API_BASE}/polls/${pollId}/reopen`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handleResponse),

  getSuggestions: (pollId) =>
    fetch(`${API_BASE}/polls/${pollId}/suggestions`, { headers: authHeaders() })
      .then(handleResponse),
};
