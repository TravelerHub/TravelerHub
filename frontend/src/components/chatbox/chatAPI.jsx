// chatAPI.jsx — centralized API calls with client-side E2E encryption
import { request } from "../../api/request";
import { encryptionUtils } from "../../lib/encryption";
import { API_BASE } from "../../config.js";

function normalizeMessageEnvelope(payload) {
  if (typeof payload === "string") {
    return { type: "text", text: payload };
  }

  if (payload && typeof payload === "object") {
    if (payload.type === "image") {
      return {
        type: "image",
        image_url: payload.image_url,
        caption: payload.caption || "",
        file_name: payload.file_name || "",
        mime_type: payload.mime_type || "",
      };
    }

    if (payload.type === "audio") {
      return {
        type: "audio",
        audio_url: payload.audio_url,
        caption: payload.caption || "",
        duration_sec: Number(payload.duration_sec || 0),
        file_name: payload.file_name || "",
        mime_type: payload.mime_type || "",
      };
    }

    if (payload.type === "video") {
      return {
        type: "video",
        video_url: payload.video_url,
        caption: payload.caption || "",
        file_name: payload.file_name || "",
        mime_type: payload.mime_type || "",
      };
    }

    return {
      type: "text",
      text: String(payload.text || ""),
    };
  }

  return { type: "text", text: "" };
}

export const chatApi = {

  // ── Conversations ──────────────────────────────────────────────────────────

  getConversations: (tripId = null) => {
    const query = tripId ? `?trip_id=${encodeURIComponent(tripId)}` : "";
    return request(`/api/conversations${query}`);
  },

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
   * Encrypt a structured message envelope client-side and POST the ciphertext.
   * Session key is read from cache — no server call for encryption.
   */
  sendMessage: (conversationId, payload) => {
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      throw new Error("No session key found for this conversation. Re-open the chat and try again.");
    }

    const envelope = normalizeMessageEnvelope(payload);
    if (envelope.type === "image" && !envelope.image_url) {
      throw new Error("Image message is missing an image URL");
    }

    if (envelope.type === "audio" && !envelope.audio_url) {
      throw new Error("Voice message is missing an audio URL");
    }

    if (envelope.type === "video" && !envelope.video_url) {
      throw new Error("Video message is missing a video URL");
    }

    if (envelope.type === "text" && !envelope.text.trim()) {
      throw new Error("Message is empty");
    }

    const encryptedContent = encryptionUtils.encryptMessage(JSON.stringify(envelope), sessionKey);

    return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: {
        content: encryptedContent,
        sent_datetime: new Date().toISOString(),
        is_encrypted: true,
      },
    });
  },

  editMessage: (conversationId, messageId, payload) => {
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      throw new Error("No session key found for this conversation. Re-open the chat and try again.");
    }

    const envelope = normalizeMessageEnvelope(payload);
    if (envelope.type === "image" && !envelope.image_url) {
      throw new Error("Image message is missing an image URL");
    }

    if (envelope.type === "audio" && !envelope.audio_url) {
      throw new Error("Voice message is missing an audio URL");
    }

    if (envelope.type === "video" && !envelope.video_url) {
      throw new Error("Video message is missing a video URL");
    }

    if (envelope.type === "text" && !envelope.text.trim()) {
      throw new Error("Message is empty");
    }

    const encryptedContent = encryptionUtils.encryptMessage(JSON.stringify(envelope), sessionKey);

    return request(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        body: {
          content: encryptedContent,
          is_encrypted: true,
        },
      }
    );
  },

  deleteMessage: (conversationId, messageId) =>
    request(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { method: "DELETE" }
    ),

  uploadConversationImage: async (conversationId, file) => {
    if (!file) throw new Error("No image selected");

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}/images`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to upload image";
      try {
        const err = await response.json();
        errorMessage = err.detail || JSON.stringify(err);
      } catch {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const publicUrl =
      data?.public_url ||
      data?.publicUrl ||
      data?.public_url?.publicUrl ||
      data?.public_url?.publicURL;

    if (!publicUrl || typeof publicUrl !== "string") {
      throw new Error("Upload completed but image URL is invalid");
    }

    return {
      ...data,
      public_url: publicUrl,
    };
  },

  uploadConversationVoicemail: async (conversationId, file) => {
    if (!file) throw new Error("No voice message selected");

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}/voicemails`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to upload voicemail";
      try {
        const err = await response.json();
        errorMessage = err.detail || JSON.stringify(err);
      } catch {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const publicUrl =
      data?.public_url ||
      data?.publicUrl ||
      data?.public_url?.publicUrl ||
      data?.public_url?.publicURL;

    if (!publicUrl || typeof publicUrl !== "string") {
      throw new Error("Voicemail upload completed but audio URL is invalid");
    }

    return {
      ...data,
      public_url: publicUrl,
    };
  },

  uploadConversationVideo: async (conversationId, file) => {
    if (!file) throw new Error("No video selected");

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}/videos`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    if (!response.ok) {
      let errorMessage = "Failed to upload video";
      try {
        const err = await response.json();
        errorMessage = err.detail || JSON.stringify(err);
      } catch {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const publicUrl =
      data?.public_url ||
      data?.publicUrl ||
      data?.public_url?.publicUrl ||
      data?.public_url?.publicURL;

    if (!publicUrl || typeof publicUrl !== "string") {
      throw new Error("Video upload completed but video URL is invalid");
    }

    return {
      ...data,
      public_url: publicUrl,
    };
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
    // Prefer the deterministic derivation from the user's symmetric_key so
    // that "rotation" produces the same keypair every device for this user
    // arrives at — otherwise rotating on the laptop just generates yet
    // another random key the phone can't match. Falls back to the legacy
    // random rotation if the symmetric_key isn't available locally for any
    // reason (e.g. an older session that predates this change).
    const symmetricKey = localStorage.getItem("card_symmetric_key");
    let keypair;
    if (symmetricKey) {
      try {
        keypair = encryptionUtils.generateKeypairFromSeed(symmetricKey);
      } catch (err) {
        console.warn("[rotateKeypair] deterministic derivation failed, falling back to random:", err);
      }
    }
    if (!keypair) keypair = encryptionUtils.generateKeypair();
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
