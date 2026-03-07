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