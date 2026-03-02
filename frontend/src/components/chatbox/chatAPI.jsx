// chatApi.jsx - centralized API calls
import { request } from "../../api/request";

export const chatApi = {
  // Conversations current user participates in
  getConversations: () =>
    request(`/api/conversations`),

  // Create a new conversation (group or 1-on-1)
  createConversation: (payload) =>
    request(`/api/conversations`, { method: "POST", body: payload }),

  // Add member to conversation
  addMember: (conversationId, userId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/members?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),

  // Members from group_member join users
  getMembers: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/members`),

  // Messages for conversation
  getMessages: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),

  // Send a message
  sendMessage: (conversationId, content) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: { content, sent_datetime: new Date().toISOString() }
    }),

  // Fetch all users to start new chats
  getUsers: () =>
    request(`/api/users/`)
};
