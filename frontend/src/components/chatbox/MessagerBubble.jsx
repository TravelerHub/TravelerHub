import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function MessageBubble({ msg, isMine, conversationId }) {
  const [decryptedContent, setDecryptedContent] = useState("");
  const [decryptError, setDecryptError] = useState(false);

  useEffect(() => {
    const decryptMessage = async () => {
      try {
        let content = msg.content;
        
        // Check if message needs decryption
        if (msg.is_encrypted || msg.is_encrypted === undefined) {
          // Try to decrypt
          let sessionKey = encryptionUtils.getConversationKey(conversationId);
          
          if (!sessionKey) {
            // Try to generate fallback key
            console.warn("No session key found, checking if fallback is needed");
            sessionKey = encryptionUtils.generateFallbackKey(conversationId);
            encryptionUtils.storeConversationKey(conversationId, sessionKey);
          }
          
          if (!sessionKey) {
            console.error("Cannot decrypt: no session key available");
            setDecryptError(true);
            setDecryptedContent(msg.content);
            return;
          }
          
          try {
            // Normalize the key before decryption
            const normalizedKey = encryptionUtils.normalizeKey(sessionKey);
            content = encryptionUtils.decryptMessage(msg.content, normalizedKey);
            setDecryptedContent(content);
            setDecryptError(false);
          } catch (decryptErr) {
            // If decryption fails, might be unencrypted message
            console.warn("Decryption failed, treating as plaintext:", decryptErr.message);
            setDecryptedContent(msg.content);
            setDecryptError(false);
          }
        } else {
          setDecryptedContent(msg.content);
          setDecryptError(false);
        }
      } catch (err) {
        console.error("Message processing error:", err);
        setDecryptError(true);
        setDecryptedContent(msg.content || "[Error processing message]");
      }
    };

    decryptMessage();
  }, [msg, conversationId]);

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm border text-sm",
          isMine
            ? "bg-white border-gray-200"
            : "bg-gray-100 border-gray-200",
          decryptError ? "border-red-300" : ""
        ].join(" ")}
      >
        <div className="text-gray-800 whitespace-pre-wrap break-words">
          {decryptError ? (
            <span className="text-red-500 italic">Failed to decrypt message</span>
          ) : (
            decryptedContent || "[Empty message]"
          )}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {formatTime(msg.sent_datetime)}
        </div>
      </div>
    </div>
  );
}
