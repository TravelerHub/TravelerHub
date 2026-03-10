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
    try {
      // Ensure key is properly decoded to Uint8Array
      let keyBytes = nacl.util.decodeBase64(sessionKey);
      if (!(keyBytes instanceof Uint8Array)) {
        keyBytes = new Uint8Array(keyBytes);
      }
      
      // CRITICAL: Validate key size is exactly 32 bytes
      if (keyBytes.length !== 32) {
        console.error(`Key size error: expected 32 bytes, got ${keyBytes.length}`);
        throw new Error(`bad key size: expected 32, got ${keyBytes.length}`);
      }
      
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      // Encode message to UTF-8 bytes and ensure it's a Uint8Array
      let messageBytes = nacl.util.encodeUTF8(message);
      if (!(messageBytes instanceof Uint8Array)) {
        // If it's not a Uint8Array, convert it
        messageBytes = new Uint8Array(messageBytes);
      }

      // Validate all inputs are Uint8Array
      if (!(messageBytes instanceof Uint8Array)) {
        throw new Error("Message bytes not Uint8Array after conversion");
      }
      if (!(nonce instanceof Uint8Array)) {
        throw new Error("Nonce not Uint8Array");
      }
      if (!(keyBytes instanceof Uint8Array)) {
        throw new Error("Key bytes not Uint8Array after conversion");
      }

      const encrypted = nacl.secretbox(messageBytes, nonce, keyBytes);
      
      if (!encrypted) {
        throw new Error("Encryption failed - returned null");
      }
      if (!(encrypted instanceof Uint8Array)) {
        throw new Error("Encrypted result not Uint8Array");
      }

      // Return nonce + ciphertext
      const result = new Uint8Array(nonce.length + encrypted.length);
      result.set(new Uint8Array(nonce));
      result.set(new Uint8Array(encrypted), nonce.length);

      return nacl.util.encodeBase64(result);
    } catch (err) {
      console.error("Encryption error details:", {
        error: err.message,
        sessionKeyType: typeof sessionKey,
        sessionKeyLength: sessionKey?.length,
        messageType: typeof message,
        messageLength: message?.length
      });
      throw new Error(`Message encryption failed: ${err.message}`);
    }
  },

  /**
   * Decrypt a message with a symmetric session key
   * @param {string} encryptedMessage - base64-encoded encrypted message
   * @param {string} sessionKey - base64-encoded symmetric key
   * @returns {string} plaintext message
   */
  decryptMessage: (encryptedMessage, sessionKey) => {
    try {
      let encryptedBytes = nacl.util.decodeBase64(encryptedMessage);
      if (!(encryptedBytes instanceof Uint8Array)) {
        encryptedBytes = new Uint8Array(encryptedBytes);
      }
      
      let keyBytes = nacl.util.decodeBase64(sessionKey);
      
      // Ensure keyBytes is Uint8Array
      if (!(keyBytes instanceof Uint8Array)) {
        keyBytes = new Uint8Array(keyBytes);
      }

      // CRITICAL: Validate key size is exactly 32 bytes
      if (keyBytes.length !== 32) {
        console.error(`Key size error in decrypt: expected 32 bytes, got ${keyBytes.length}`);
        throw new Error(`bad key size: expected 32, got ${keyBytes.length}`);
      }

      const nonce = new Uint8Array(encryptedBytes.slice(0, nacl.secretbox.nonceLength));
      const ciphertext = new Uint8Array(encryptedBytes.slice(nacl.secretbox.nonceLength));

      const decrypted = nacl.secretbox.open(ciphertext, nonce, keyBytes);
      if (!decrypted) {
        throw new Error("Decryption failed: message corrupted or wrong key");
      }

      // Decode the decrypted bytes to UTF-8 string
      const decoded = nacl.util.decodeUTF8(decrypted);
      return decoded;
    } catch (err) {
      console.error("Decryption error:", err);
      throw new Error(`Message decryption failed: ${err.message}`);
    }
  },

  /**
   * Normalize a session key to ensure it's exactly 32 bytes when decoded
   * @param {string} base64Key - base64-encoded key
   * @returns {string} normalized base64-encoded 32-byte key
   */
  normalizeKey: (base64Key) => {
    try {
      let keyBytes = nacl.util.decodeBase64(base64Key);
      if (!(keyBytes instanceof Uint8Array)) {
        keyBytes = new Uint8Array(keyBytes);
      }
      
      // If key is wrong size, we need to fix it
      if (keyBytes.length === 32) {
        return base64Key; // Already correct
      }
      
      console.warn(`Normalizing key from ${keyBytes.length} bytes to 32 bytes`);
      
      const normalized = new Uint8Array(32);
      
      if (keyBytes.length < 32) {
        // Pad with repeated bytes
        for (let i = 0; i < 32; i++) {
          normalized[i] = keyBytes[i % keyBytes.length];
        }
      } else {
        // Truncate
        for (let i = 0; i < 32; i++) {
          normalized[i] = keyBytes[i];
        }
      }
      
      return nacl.util.encodeBase64(normalized);
    } catch (err) {
      console.error("Error normalizing key:", err);
      throw err;
    }
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

  /**
   * Generate a deterministic fallback key based on conversation ID
   * Used when proper encryption keys aren't available
   */
  generateFallbackKey: (conversationId) => {
    try {
      // Create a deterministic 32-byte key
      const hash = new Uint8Array(32);
      
      // Use conversation ID bytes to seed the hash
      const encoder = new TextEncoder();
      const idBytes = encoder.encode(conversationId + "_key");
      
      for (let i = 0; i < 32; i++) {
        // Mix in bytes from the ID multiple times
        const idByte = idBytes[i % idBytes.length];
        hash[i] = ((idByte * 7 + i * 13) ^ (i * 23)) & 0xFF;
      }
      
      // Convert to base64 string
      const base64Key = nacl.util.encodeBase64(hash);
      
      // Verify it can be decoded back
      const verify = nacl.util.decodeBase64(base64Key);
      if (!(verify instanceof Uint8Array) || verify.length !== 32) {
        throw new Error("Fallback key generation failed verification");
      }
      
      return base64Key;
    } catch (err) {
      console.error("Error generating fallback key:", err);
      // Emergency fallback - create a simple but valid base64 key
      const emergencyKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        emergencyKey[i] = (conversationId.charCodeAt(i % conversationId.length) + i) & 0xFF;
      }
      return nacl.util.encodeBase64(emergencyKey);
    }
  },
};
