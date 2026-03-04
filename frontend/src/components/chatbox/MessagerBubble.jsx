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
        if (msg.is_encrypted) {
          const sessionKey = encryptionUtils.getConversationKey(conversationId);
          if (!sessionKey) {
            setDecryptError(true);
            return;
          }
          const plaintext = encryptionUtils.decryptMessage(msg.content, sessionKey);
          setDecryptedContent(plaintext);
        } else {
          setDecryptedContent(msg.content);
        }
      } catch (err) {
        console.error("Decryption failed:", err);
        setDecryptError(true);
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
            decryptedContent
          )}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {formatTime(msg.sent_datetime)}
        </div>
      </div>
    </div>
  );
}
