// chatApi.js - centralized API calls

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const chatApi = {
  // Conversations current user participates in
  getConversations: ({ userId }) =>
    request(`/api/conversations?userId=${encodeURIComponent(userId)}`),

  // Members from group_member join users
  getMembers: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/members`),

  // Messages for conversation
  getMessages: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),
};
