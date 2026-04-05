<<<<<<< HEAD
const API_BASE_URL = "http://localhost:8000/polls";

export const pollService = {
  // Create a new poll
  async createPoll(tripId, pollData) {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}/polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
      },
      body: JSON.stringify(pollData)
    });
    
    if (!response.ok) throw new Error("Failed to create poll");
    return response.json();
  },

  // Cast a vote
  async castVote(voteData) {
    const response = await fetch(`${API_BASE_URL}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
      },
      body: JSON.stringify(voteData)
    });
    
    if (!response.ok) throw new Error("Failed to cast vote");
    return response.json();
  },

  // Get poll results
  async getPollResults(pollId) {
    const response = await fetch(`${API_BASE_URL}/polls/${pollId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
      }
    });
    
    if (!response.ok) throw new Error("Failed to fetch poll results");
    return response.json();
  }
};
=======
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
>>>>>>> ac19178fac1baf248ff86fcf4a4a2a2bcffab7cb
