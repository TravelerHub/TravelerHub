import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({ msg, isMine, conversationId }) {
  const [decryptedContent, setDecryptedContent] = useState(msg.content || "");
  const [decryptError,     setDecryptError]     = useState(false);

  useEffect(() => {
    // Not encrypted — show as-is
    if (!msg.is_encrypted && !encryptionUtils.isLikelyEncryptedMessage(msg.content)) {
      setDecryptedContent(msg.content);
      setDecryptError(false);
      return;
    }

    // Session key is already in memory — no server call needed
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      setDecryptError(true);
      setDecryptedContent(null);
      return;
    }

    try {
      const plaintext = encryptionUtils.decryptMessage(msg.content, sessionKey);
      setDecryptedContent(plaintext);
      setDecryptError(false);
    } catch {
      setDecryptError(true);
      setDecryptedContent(null);
    }
  }, [msg.content, msg.is_encrypted, conversationId]);

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm"
        style={
          isMine
            ? { background: "#000000", color: "#f9fafb" }
            : { background: "#ffffff", color: "#160f29", border: "1px solid #ebebeb" }
        }
      >
        <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">
          {decryptError ? (
            <span style={{ color: isMine ? "#9ca3af" : "#d1d5db", fontStyle: "italic" }}>
              🔒 Encrypted with a previous key
            </span>
          ) : (
            decryptedContent || "[Empty message]"
          )}
        </p>

        <p
          className="mt-1 text-[10px] text-right"
          style={{ color: isMine ? "rgba(255,255,255,0.45)" : "#9ca3af" }}
        >
          {formatTime(msg.sent_datetime)}
        </p>
      </div>
    </div>
  );
}
