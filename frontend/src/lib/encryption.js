/**
 * End-to-End Encryption utilities for frontend
 * Uses TweetNaCl.js for hybrid encryption
 */

// TweetNaCl utility functions for E2E encryption
export const encryptionUtils = {
  /**
   * Generate a keypair for the current user
   * @returns {Object} {public_key, private_key} both as base64 strings
   */
  generateKeypair: () => {
    const keyPair = nacl.box.keyPair();
    return {
      public_key: nacl.util.encodeBase64(keyPair.publicKey),
      private_key: nacl.util.encodeBase64(keyPair.secretKey),
    };
  },

  /**
   * Encrypt a session key with a recipient's public key
   * @param {string} sessionKey - base64-encoded session key
   * @param {string} recipientPublicKey - base64-encoded public key
   * @returns {string} base64-encoded encrypted key
   */
  encryptKeyForUser: (sessionKey, recipientPublicKey) => {
    const keyBytes = nacl.util.decodeBase64(sessionKey);
    const publicKeyBytes = nacl.util.decodeBase64(recipientPublicKey);

    const ephemeral = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const encrypted = nacl.box(keyBytes, nonce, publicKeyBytes, ephemeral.secretKey);

    // Return nonce + ephemeral public key + encrypted data
    const result = new Uint8Array(nonce.length + ephemeral.publicKey.length + encrypted.length);
    result.set(nonce);
    result.set(ephemeral.publicKey, nonce.length);
    result.set(encrypted, nonce.length + ephemeral.publicKey.length);

    return nacl.util.encodeBase64(result);
  },

  /**
   * Generate a random symmetric key for conversations
   * @returns {string} base64-encoded key
   */
  generateConversationKey: () => {
    const key = nacl.randomBytes(32); // 256-bit key
    return nacl.util.encodeBase64(key);
  },

  /**
   * Encrypt a message with a symmetric session key
   * @param {string} message - plaintext message
   * @param {string} sessionKey - base64-encoded symmetric key
   * @returns {string} base64-encoded encrypted message
   */
  encryptMessage: (message, sessionKey) => {
    const keyBytes = nacl.util.decodeBase64(sessionKey);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = nacl.util.encodeUTF8(message);

    const encrypted = nacl.secretbox(messageBytes, nonce, keyBytes);

    // Return nonce + ciphertext
    const result = new Uint8Array(nonce.length + encrypted.length);
    result.set(nonce);
    result.set(encrypted, nonce.length);

    return nacl.util.encodeBase64(result);
  },

  /**
   * Decrypt a message with a symmetric session key
   * @param {string} encryptedMessage - base64-encoded encrypted message
   * @param {string} sessionKey - base64-encoded symmetric key
   * @returns {string} plaintext message
   */
  decryptMessage: (encryptedMessage, sessionKey) => {
    const encryptedBytes = nacl.util.decodeBase64(encryptedMessage);
    const keyBytes = nacl.util.decodeBase64(sessionKey);

    const nonce = encryptedBytes.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = encryptedBytes.slice(nacl.secretbox.nonceLength);

    const decrypted = nacl.secretbox.open(ciphertext, nonce, keyBytes);
    if (!decrypted) {
      throw new Error("Decryption failed: message corrupted or wrong key");
    }

    return nacl.util.encodeUTF8(decrypted);
  },

  /**
   * Store keypair in localStorage
   */
  storeKeypair: (keypair) => {
    localStorage.setItem("user_keypair", JSON.stringify(keypair));
  },

  /**
   * Retrieve keypair from localStorage
   */
  getKeypair: () => {
    const stored = localStorage.getItem("user_keypair");
    return stored ? JSON.parse(stored) : null;
  },

  /**
   * Store session key for a conversation
   */
  storeConversationKey: (conversationId, sessionKey) => {
    const keys = JSON.parse(localStorage.getItem("conversation_keys") || "{}");
    keys[conversationId] = sessionKey;
    localStorage.setItem("conversation_keys", JSON.stringify(keys));
  },

  /**
   * Retrieve session key for a conversation
   */
  getConversationKey: (conversationId) => {
    const keys = JSON.parse(localStorage.getItem("conversation_keys") || "{}");
    return keys[conversationId] || null;
  },
};
