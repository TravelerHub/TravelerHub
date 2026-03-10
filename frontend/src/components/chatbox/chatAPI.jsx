// chatApi.jsx - centralized API calls with E2E encryption
import { request } from "../../api/request";
import { encryptionUtils } from "../../lib/encryption";

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

  // Send a message (encrypted)
  sendMessage: (conversationId, content) => {
    try {
      // Get the session key for this conversation
      let sessionKey = encryptionUtils.getConversationKey(conversationId);
      
      if (!sessionKey) {
        // Generate fallback key as last resort
        sessionKey = encryptionUtils.generateFallbackKey(conversationId);
        encryptionUtils.storeConversationKey(conversationId, sessionKey);
      }

      // Normalize key to ensure it's exactly 32 bytes
      sessionKey = encryptionUtils.normalizeKey(sessionKey);

      // Validate session key before use
      if (typeof sessionKey !== "string") {
        throw new Error(`Session key is not a string: ${typeof sessionKey}`);
      }
      if (sessionKey.length === 0) {
        throw new Error("Session key is empty");
      }

      console.log("Encrypting message with key length:", sessionKey.length, "content length:", content.length);

      // Encrypt the message content
      const encryptedContent = encryptionUtils.encryptMessage(content, sessionKey);

      return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        body: { 
          content: encryptedContent, 
          sent_datetime: new Date().toISOString(),
          is_encrypted: true
        }
      });
    } catch (err) {
      console.error("Message encryption error:", err);
      throw err;
    }
  },

  // Get conversation session key (encrypted for user)
  getConversationKey: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/session-key`),

  // Fetch all users to start new chats
  getUsers: () =>
    request(`/users/`)
};
