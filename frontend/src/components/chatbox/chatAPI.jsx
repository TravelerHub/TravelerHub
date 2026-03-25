// chatAPI.jsx — centralized API calls with client-side E2E encryption
import { request } from "../../api/request";
import { encryptionUtils } from "../../lib/encryption";

export const chatApi = {

  // ── Conversations ──────────────────────────────────────────────────────────

  getConversations: () =>
    request("/api/conversations"),

  createConversation: (payload) =>
    request("/api/conversations", { method: "POST", body: payload }),

  addMember: (conversationId, userId) =>
    request(
      `/api/conversations/${encodeURIComponent(conversationId)}/members?user_id=${encodeURIComponent(userId)}`,
      { method: "POST" }
    ),

  getMembers: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/members`),

  getMessages: (conversationId) =>
    request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`),

  // ── Messages ───────────────────────────────────────────────────────────────

  /**
   * Encrypt a message client-side and POST the ciphertext.
   * Session key is read from cache — no server call for encryption.
   */
  sendMessage: (conversationId, content) => {
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      throw new Error("No session key found for this conversation. Re-open the chat and try again.");
    }

    const encryptedContent = encryptionUtils.encryptMessage(content, sessionKey);

    return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: {
        content: encryptedContent,
        sent_datetime: new Date().toISOString(),
        is_encrypted: true,
      },
    });
  },

  // ── Keypair / public key ───────────────────────────────────────────────────

  /**
   * Upload the current user's public key to the server.
   * Private key stays in localStorage — never sent.
   */
  uploadPublicKey: (publicKey) =>
    request("/api/users/keypair", {
      method: "POST",
      body: { public_key: publicKey },
    }),

  /**
   * Fetch another user's public key so we can encrypt the session key for them.
   */
  getMemberPublicKey: (userId) =>
    request(`/api/users/${encodeURIComponent(userId)}/public-key`),

  // ── Session key distribution ───────────────────────────────────────────────

  /**
   * Get the current user's encrypted session key blob from the server,
   * then decrypt it client-side using the local private key.
   * Returns the plaintext base64 session key, or null if not found.
   */
  fetchAndDecryptSessionKey: async (conversationId) => {
    const keypair = encryptionUtils.getKeypair();
    if (!keypair) return null;

    let data;
    try {
      data = await request(`/api/conversations/${encodeURIComponent(conversationId)}/session-key`);
    } catch (err) {
      if (err.message?.includes("404") || err.message?.includes("No session key")) return null;
      throw err;
    }

    const sessionKey = encryptionUtils.decryptKeyForUser(data.encrypted_key, keypair.private_key);
    return sessionKey;
  },

  /**
   * Generate a session key client-side, encrypt it for every member who has a
   * public key, then POST the blobs to the server.
   * Members without a public key yet are skipped — they'll be added later by
   * distributeToMissingMembers() once they log in and upload their public key.
   *
   * @param {string}   conversationId
   * @param {string[]} memberIds       - all member user IDs including the creator
   * @returns {string} the plaintext session key (already cached locally)
   */
  setupConversationEncryption: async (conversationId, memberIds) => {
    const sessionKey = encryptionUtils.generateConversationKey();

    // Use allSettled so a single missing public key doesn't abort the whole setup
    const results = await Promise.allSettled(
      memberIds.map(async (userId) => {
        const res = await chatApi.getMemberPublicKey(userId);
        const encryptedKey = encryptionUtils.encryptKeyForUser(sessionKey, res.public_key);
        return { user_id: userId, encrypted_key: encryptedKey };
      })
    );

    const keys = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    if (keys.length > 0) {
      await request(`/api/conversations/${encodeURIComponent(conversationId)}/session-key`, {
        method: "POST",
        body: { keys },
      });
    }

    // Cache locally so this conversation is immediately usable
    encryptionUtils.cacheSessionKey(conversationId, sessionKey);

    return sessionKey;
  },

  /**
   * Called after the current user successfully loads their session key.
   * Finds members who don't have an encrypted key yet (e.g. joined after creation
   * or hadn't uploaded their public key when the conversation was created),
   * and distributes the known session key to them.
   *
   * @param {string}   conversationId
   * @param {string}   sessionKey     - the plaintext base64 session key
   * @param {string[]} memberIds      - current member IDs
   */
  distributeToMissingMembers: async (conversationId, sessionKey, memberIds) => {
    if (!memberIds.length) return;

    // Check which members are missing a key by trying to fetch their public key
    // and cross-referencing. Simpler: try to encrypt for everyone and let the
    // backend skip users who already have a key (upsert-style via partial insert).
    const results = await Promise.allSettled(
      memberIds.map(async (userId) => {
        const res = await chatApi.getMemberPublicKey(userId);
        const encryptedKey = encryptionUtils.encryptKeyForUser(sessionKey, res.public_key);
        return { user_id: userId, encrypted_key: encryptedKey };
      })
    );

    const keys = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    if (keys.length > 0) {
      await request(`/api/conversations/${encodeURIComponent(conversationId)}/session-key`, {
        method: "POST",
        body: { keys },
      });
    }
  },

  /**
   * Called when decryption fails (private key no longer matches stored blob).
   *
   * Rotates ONLY the keypair — does NOT generate a new session key.
   * By deleting our server entry and uploading a new public key, we appear as
   * "missing" to other members. The next time any member opens this conversation,
   * their distributeToMissingMembers() re-encrypts the SAME session key with our
   * new public key. Old messages remain decryptable because the session key is
   * unchanged — only the wrapping keypair changed.
   *
   * Returns null. Caller should retry fetchAndDecryptSessionKey until another
   * member redistributes the key.
   */
  rotateKeypair: async (conversationId) => {
    const keypair = encryptionUtils.generateKeypair();
    encryptionUtils.storeKeypair(keypair);
    await chatApi.uploadPublicKey(keypair.public_key);

    try {
      await request(`/api/conversations/${encodeURIComponent(conversationId)}/session-key`, {
        method: "DELETE",
      });
    } catch {
      // Entry may not exist — that's fine
    }

    return null;
  },

  // ── Users ──────────────────────────────────────────────────────────────────

  getUsers: () => request("/users/"),
};
