import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeDecryptedPayload(plaintext) {
  if (typeof plaintext !== "string") {
    return { type: "text", text: "" };
  }

  try {
    const parsed = JSON.parse(plaintext);
    if (parsed?.type === "image" && typeof parsed.image_url === "string") {
      return {
        type: "image",
        image_url: parsed.image_url,
        caption: typeof parsed.caption === "string" ? parsed.caption : "",
        file_name: typeof parsed.file_name === "string" ? parsed.file_name : "",
      };
    }

    if (parsed?.type === "audio" && typeof parsed.audio_url === "string") {
      return {
        type: "audio",
        audio_url: parsed.audio_url,
        caption: typeof parsed.caption === "string" ? parsed.caption : "",
        duration_sec: Number(parsed.duration_sec || 0),
        file_name: typeof parsed.file_name === "string" ? parsed.file_name : "",
      };
    }

    if (parsed?.type === "text" && typeof parsed.text === "string") {
      return { type: "text", text: parsed.text };
    }
  } catch {
    // Legacy messages are plain strings after decryption.
  }

  return { type: "text", text: plaintext };
}

// ── Read receipt avatar dots ─────────────────────────────────────────────────
function ReadReceipts({ readers, members }) {
  if (!readers || readers.length === 0) return null;

  const MAX_SHOWN = 3;
  const shown = readers.slice(0, MAX_SHOWN);
  const extra = readers.length - MAX_SHOWN;

  const getInitials = (userId) => {
    const member = members?.find((m) => m.id === userId);
    const name = member?.username || member?.email || userId || "?";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center gap-0.5 justify-end mt-0.5 pr-1">
      {shown.map((uid) => (
        <span
          key={uid}
          title={members?.find((m) => m.id === uid)?.username || uid}
          className="flex items-center justify-center rounded-full font-bold shrink-0"
          style={{
            width: "16px",
            height: "16px",
            background: "#183a37",
            color: "#ffffff",
            fontSize: "7px",
          }}
        >
          {getInitials(uid)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: "16px",
            height: "16px",
            background: "#e5e7eb",
            color: "#6b7280",
            fontSize: "7px",
            fontWeight: 700,
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function MessageBubble({ msg, isMine, conversationId, members, readers }) {
  const [decryptedPayload, setDecryptedPayload] = useState(
    normalizeDecryptedPayload(msg.content || "")
  );
  const [decryptError,     setDecryptError]     = useState(false);

  useEffect(() => {
    // Not encrypted — show as-is
    if (!msg.is_encrypted && !encryptionUtils.isLikelyEncryptedMessage(msg.content)) {
      setDecryptedPayload(normalizeDecryptedPayload(msg.content || ""));
      setDecryptError(false);
      return;
    }

    // Session key is already in memory — no server call needed
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      setDecryptError(true);
      setDecryptedPayload(null);
      return;
    }

    try {
      const plaintext = encryptionUtils.decryptMessage(msg.content, sessionKey);
      setDecryptedPayload(normalizeDecryptedPayload(plaintext));
      setDecryptError(false);
    } catch {
      setDecryptError(true);
      setDecryptedPayload(null);
    }
  }, [msg.content, msg.is_encrypted, conversationId]);

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm"
        style={
          isMine
            ? { background: "#000000", color: "#f9fafb" }
            : { background: "#ffffff", color: "#160f29", border: "1px solid #ebebeb" }
        }
      >
        {decryptError ? (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            <span style={{ color: isMine ? "#9ca3af" : "#d1d5db", fontStyle: "italic" }}>
              🔒 Encrypted with a previous key
            </span>
          </p>
        ) : decryptedPayload?.type === "image" ? (
          <div className="space-y-2">
            <a
              href={decryptedPayload.image_url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <img
                src={decryptedPayload.image_url}
                alt={decryptedPayload.file_name || "Chat image"}
                className="rounded-xl max-h-72 w-auto max-w-full object-cover"
                loading="lazy"
              />
            </a>

            {decryptedPayload.caption && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {decryptedPayload.caption}
              </p>
            )}
          </div>
        ) : decryptedPayload?.type === "audio" ? (
          <div className="space-y-2">
            <audio
              controls
              preload="metadata"
              src={decryptedPayload.audio_url}
              className="w-full max-w-[260px] h-9"
            />

            {decryptedPayload.duration_sec > 0 && (
              <p
                className="text-[10px]"
                style={{ color: isMine ? "rgba(255,255,255,0.55)" : "#6b7280" }}
              >
                Voicemail • {formatDuration(decryptedPayload.duration_sec)}
              </p>
            )}

            {decryptedPayload.caption && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {decryptedPayload.caption}
              </p>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {decryptedPayload?.text || "[Empty message]"}
          </p>
        )}

        <p
          className="mt-1 text-[10px] text-right"
          style={{ color: isMine ? "rgba(255,255,255,0.45)" : "#9ca3af" }}
        >
          {formatTime(msg.sent_datetime)}
        </p>
      </div>

      {/* Read receipts — only shown on current user's messages */}
      {isMine && (
        <ReadReceipts readers={readers} members={members} />
      )}
    </div>
  );
}
