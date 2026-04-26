import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

    if (parsed?.type === "video" && typeof parsed.video_url === "string") {
      return {
        type: "video",
        video_url: parsed.video_url,
        caption: typeof parsed.caption === "string" ? parsed.caption : "",
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

export default function MessageBubble({ msg, isMine, conversationId, members, readers, onEditMessage, onDeleteMessage }) {
  const [decryptedPayload, setDecryptedPayload] = useState(
    normalizeDecryptedPayload(msg.content || "")
  );
  const [decryptError,     setDecryptError]     = useState(false);
  const [isEditing,        setIsEditing]        = useState(false);
  const [editDraft,        setEditDraft]        = useState("");
  const [editError,        setEditError]        = useState("");
  const [savingEdit,       setSavingEdit]       = useState(false);
  const [deleteError,      setDeleteError]      = useState("");
  const [deleting,         setDeleting]         = useState(false);

  const getEditableText = (payload) => {
    if (!payload) return "";
    if (payload.type === "text") return payload.text || "";
    if (payload.type === "image" || payload.type === "audio" || payload.type === "video") {
      return payload.caption || "";
    }
    return "";
  };

  const buildEditedPayload = (payload, draft) => {
    if (!payload) return null;
    if (payload.type === "text") {
      return { type: "text", text: draft };
    }
    if (payload.type === "image") {
      return { ...payload, caption: draft };
    }
    if (payload.type === "audio") {
      return { ...payload, caption: draft };
    }
    if (payload.type === "video") {
      return { ...payload, caption: draft };
    }
    return null;
  };

  const canEditByTime = (() => {
    const sent = new Date(msg.sent_datetime);
    if (Number.isNaN(sent.getTime())) return false;
    return Date.now() - sent.getTime() <= EDIT_WINDOW_MS;
  })();

  const canEdit =
    isMine &&
    !decryptError &&
    Boolean(decryptedPayload) &&
    canEditByTime &&
    typeof onEditMessage === "function";

  const canDeleteByTime = (() => {
    const sent = new Date(msg.sent_datetime);
    if (Number.isNaN(sent.getTime())) return false;
    return Date.now() - sent.getTime() <= DELETE_WINDOW_MS;
  })();

  const canDelete =
    isMine &&
    canDeleteByTime &&
    typeof onDeleteMessage === "function";

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

  useEffect(() => {
    if (!isEditing) {
      setEditDraft(getEditableText(decryptedPayload));
      setEditError("");
    }
  }, [decryptedPayload, isEditing]);

  const handleStartEdit = () => {
    setEditDraft(getEditableText(decryptedPayload));
    setEditError("");
    setDeleteError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!onEditMessage || !decryptedPayload) return;

    const nextPayload = buildEditedPayload(decryptedPayload, editDraft);
    if (!nextPayload) {
      setEditError("This message type cannot be edited");
      return;
    }

    if (nextPayload.type === "text" && !nextPayload.text.trim()) {
      setEditError("Message cannot be empty");
      return;
    }

    setSavingEdit(true);
    try {
      await onEditMessage(msg.message_id, nextPayload);
      setIsEditing(false);
      setEditError("");
    } catch (err) {
      setEditError(err.message || "Failed to edit message");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteMessage) return;

    const confirmed = window.confirm("Delete this message for everyone?");
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteMessage(msg.message_id);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete message");
    } finally {
      setDeleting(false);
    }
  };

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
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: isMine ? "rgba(255,255,255,0.15)" : "#f3f4f6",
                border: isMine ? "1px solid rgba(255,255,255,0.25)" : "1px solid #e5e7eb",
                color: isMine ? "#f9fafb" : "#111827",
              }}
            />

            {editError && (
              <p className="text-[11px]" style={{ color: isMine ? "#fecaca" : "#dc2626" }}>
                {editError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] px-2.5 py-1 rounded-md"
                style={{
                  background: isMine ? "rgba(255,255,255,0.15)" : "#f3f4f6",
                  color: isMine ? "#f9fafb" : "#374151",
                }}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="text-[11px] px-2.5 py-1 rounded-md"
                style={{
                  background: isMine ? "#f9fafb" : "#111827",
                  color: isMine ? "#111827" : "#f9fafb",
                }}
                disabled={savingEdit}
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : decryptError ? (
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
        ) : decryptedPayload?.type === "video" ? (
          <div className="space-y-2">
            <video
              controls
              preload="metadata"
              src={decryptedPayload.video_url}
              className="rounded-xl max-h-80 w-full max-w-[320px] bg-black"
            />

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

        {!isEditing && (canEdit || canDelete) && (
          <div className="mt-1 flex justify-end gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-[10px] underline"
                style={{ color: isMine ? "rgba(255,255,255,0.75)" : "#6b7280" }}
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-[10px] underline"
                style={{ color: isMine ? "#fca5a5" : "#dc2626" }}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        )}

        {deleteError && (
          <p className="mt-1 text-[11px]" style={{ color: isMine ? "#fecaca" : "#dc2626" }}>
            {deleteError}
          </p>
        )}
      </div>

      {/* Read receipts — only shown on current user's messages */}
      {isMine && (
        <ReadReceipts readers={readers} members={members} />
      )}
    </div>
  );
}
