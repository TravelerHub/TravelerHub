/**
 * End-to-End Encryption utilities for frontend
 * Uses TweetNaCl.js for hybrid encryption.
 *
 * Architecture: ALL crypto happens here in the browser.
 * The server stores opaque ciphertext blobs and never sees plaintext or private keys.
 *
 * Key flow:
 *  1. generateKeypair()           → private key stays in localStorage, public key uploaded to server
 *  2. generateConversationKey()   → random 32-byte session key, encrypted per member via encryptKeyForUser()
 *  3. decryptKeyForUser()         → client decrypts their session key blob using their local private key
 *  4. encryptMessage() / decryptMessage() → symmetric encrypt/decrypt using the session key
 *
 * Session keys are cached in _sessionKeyCache (in-memory Map) so decryption never requires a server call.
 */

// In-memory session key cache — survives the page session, cleared on tab close.
// conversationId (string) → base64 session key (string)
const _sessionKeyCache = new Map();

export const encryptionUtils = {

  // ── Key generation ─────────────────────────────────────────────────────────

  /**
   * Generate a new X25519 keypair for the current user.
   * Call once on first login. Store result via storeKeypair().
   * @returns {{ public_key: string, private_key: string }} both as base64
   */
  generateKeypair: () => {
    const keyPair = nacl.box.keyPair();
    return {
      public_key: nacl.util.encodeBase64(keyPair.publicKey),
      private_key: nacl.util.encodeBase64(keyPair.secretKey),
    };
  },

  /**
   * Generate a random 256-bit symmetric session key for a conversation.
   * @returns {string} base64-encoded 32-byte key
   */
  generateConversationKey: () => {
    return nacl.util.encodeBase64(nacl.randomBytes(32));
  },

  // ── Key exchange ───────────────────────────────────────────────────────────

  /**
   * Encrypt a session key for a recipient using their public key.
   * Uses an ephemeral keypair so the sender is anonymous to the server.
   * Output format: nonce(24) + ephemeralPublicKey(32) + ciphertext
   *
   * @param {string} sessionKey        - base64 session key to encrypt
   * @param {string} recipientPublicKey - base64 recipient's public key
   * @returns {string} base64-encoded encrypted blob
   */
  encryptKeyForUser: (sessionKey, recipientPublicKey) => {
    const keyBytes       = nacl.util.decodeBase64(sessionKey);
    const publicKeyBytes = nacl.util.decodeBase64(recipientPublicKey);
    const ephemeral      = nacl.box.keyPair();
    const nonce          = nacl.randomBytes(nacl.box.nonceLength);
    const encrypted      = nacl.box(keyBytes, nonce, publicKeyBytes, ephemeral.secretKey);

    const result = new Uint8Array(nonce.length + ephemeral.publicKey.length + encrypted.length);
    result.set(nonce);
    result.set(ephemeral.publicKey, nonce.length);
    result.set(encrypted, nonce.length + ephemeral.publicKey.length);

    return nacl.util.encodeBase64(result);
  },

  /**
   * Decrypt a session key blob using the local private key.
   * Reverses encryptKeyForUser() — expects same blob format.
   * Input format: nonce(24) + ephemeralPublicKey(32) + ciphertext
   *
   * @param {string} encryptedKeyBase64  - base64 encrypted blob from server
   * @param {string} myPrivateKeyBase64  - base64 private key from localStorage
   * @returns {string} base64-decoded session key
   */
  decryptKeyForUser: (encryptedKeyBase64, myPrivateKeyBase64) => {
    const bytes         = nacl.util.decodeBase64(encryptedKeyBase64);
    const nonce         = bytes.slice(0, nacl.box.nonceLength);
    const ephemeralPub  = bytes.slice(nacl.box.nonceLength, nacl.box.nonceLength + 32);
    const ciphertext    = bytes.slice(nacl.box.nonceLength + 32);
    const myPrivateKey  = nacl.util.decodeBase64(myPrivateKeyBase64);

    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPub, myPrivateKey);
    if (!decrypted) {
      throw new Error("Failed to decrypt session key — wrong private key or corrupted blob");
    }
    return nacl.util.encodeBase64(decrypted);
  },

  // ── Message encryption ─────────────────────────────────────────────────────

  /**
   * Encrypt a plaintext message with a symmetric session key.
   * Output format: nonce(24) + ciphertext
   *
   * @param {string} message    - plaintext string
   * @param {string} sessionKey - base64 32-byte key
   * @returns {string} base64-encoded encrypted message
   */
  encryptMessage: (message, sessionKey) => {
    const keyBytes = nacl.util.decodeBase64(sessionKey);
    if (keyBytes.length !== 32) {
      throw new Error(`Bad key size: expected 32, got ${keyBytes.length}`);
    }

    const nonce        = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = nacl.util.decodeUTF8(message);
    const encrypted    = nacl.secretbox(messageBytes, nonce, keyBytes);

    if (!encrypted) throw new Error("Encryption returned null");

    const result = new Uint8Array(nonce.length + encrypted.length);
    result.set(nonce);
    result.set(encrypted, nonce.length);

    return nacl.util.encodeBase64(result);
  },

  /**
   * Decrypt a ciphertext message with a symmetric session key.
   *
   * @param {string} encryptedMessage - base64-encoded nonce + ciphertext
   * @param {string} sessionKey       - base64 32-byte key
   * @returns {string} plaintext string
   */
  decryptMessage: (encryptedMessage, sessionKey) => {
    const keyBytes       = nacl.util.decodeBase64(sessionKey);
    if (keyBytes.length !== 32) {
      throw new Error(`Bad key size: expected 32, got ${keyBytes.length}`);
    }

    const encryptedBytes = nacl.util.decodeBase64(encryptedMessage);
    const nonce          = encryptedBytes.slice(0, nacl.secretbox.nonceLength);
    const ciphertext     = encryptedBytes.slice(nacl.secretbox.nonceLength);
    const decrypted      = nacl.secretbox.open(ciphertext, nonce, keyBytes);

    if (!decrypted) throw new Error("Decryption failed: wrong key or corrupted message");

    return nacl.util.encodeUTF8(decrypted);
  },

  // ── Session key cache ──────────────────────────────────────────────────────

  /**
   * Store a session key in both the in-memory cache and localStorage.
   * Call this after decrypting a session key blob from the server.
   */
  cacheSessionKey: (conversationId, sessionKey) => {
    _sessionKeyCache.set(conversationId, sessionKey);
    encryptionUtils.storeConversationKey(conversationId, sessionKey);
  },

  /**
   * Get a session key from cache (memory first, then localStorage).
   * Returns null if not found — caller must fetch from server.
   */
  getCachedSessionKey: (conversationId) => {
    return _sessionKeyCache.get(conversationId) || encryptionUtils.getConversationKey(conversationId) || null;
  },

  // ── localStorage persistence ───────────────────────────────────────────────

  /** Persist the user's keypair in localStorage. Only call once per device. */
  storeKeypair: (keypair) => {
    localStorage.setItem("user_keypair", JSON.stringify(keypair));
  },

  /** Retrieve the keypair from localStorage. Returns null if not set up yet. */
  getKeypair: () => {
    const stored = localStorage.getItem("user_keypair");
    return stored ? JSON.parse(stored) : null;
  },

  /** Persist a session key for a conversation in localStorage (versioned). */
  storeConversationKey: (conversationId, sessionKey) => {
    const keys = JSON.parse(localStorage.getItem("conversation_keys") || "{}");
    keys[conversationId] = { value: sessionKey, version: 2 };
    localStorage.setItem("conversation_keys", JSON.stringify(keys));
  },

  /** Retrieve a session key from localStorage. Returns null if missing or stale. */
  getConversationKey: (conversationId) => {
    const keys  = JSON.parse(localStorage.getItem("conversation_keys") || "{}");
    const entry = keys[conversationId];
    if (!entry || entry.version !== 2 || typeof entry.value !== "string") return null;
    return entry.value;
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Heuristic to detect whether a message string looks like ciphertext.
   * Used to gracefully handle legacy plaintext messages.
   */
  isLikelyEncryptedMessage: (content) => {
    if (typeof content !== "string" || content.length < 40) return false;
    return /^[A-Za-z0-9+/=]+$/.test(content);
  },
};
