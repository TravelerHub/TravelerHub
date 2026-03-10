import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function MessageBubble({ msg, isMine, conversationId }) {
  const [decryptedContent, setDecryptedContent] = useState(msg.content || "");
  const [decryptError, setDecryptError] = useState(false);

  useEffect(() => {
    const decryptMessage = async () => {
      try {
        const shouldAttemptDecrypt =
          msg.is_encrypted === true ||
          (msg.is_encrypted === undefined && encryptionUtils.isLikelyEncryptedMessage(msg.content));

        if (!shouldAttemptDecrypt) {
          setDecryptedContent(msg.content);
          setDecryptError(false);
          return;
        }

        let backendKey = null;

        try {
          const response = await fetch(`http://127.0.0.1:8000/api/conversations/${encodeURIComponent(conversationId)}/session-key`, {
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
            }
          });

          if (response.ok) {
            const keyData = await response.json();
            backendKey = keyData?.session_key || null;
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch backend session key during decrypt:", fetchErr.message);
        }

        const candidateKeys = encryptionUtils.getDecryptionKeys(conversationId, [backendKey]);

        for (const candidateKey of candidateKeys) {
          try {
            const content = encryptionUtils.decryptMessage(msg.content, candidateKey);
            encryptionUtils.storeConversationKey(conversationId, candidateKey);
            setDecryptedContent(content);
            setDecryptError(false);
            return;
          } catch (decryptErr) {
            console.warn("Decryption attempt failed:", decryptErr.message);
          }
        }

        setDecryptError(true);
        setDecryptedContent(msg.content || "[Encrypted message]");
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
            <span className="text-red-500 italic">Legacy encrypted message cannot be decrypted</span>
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