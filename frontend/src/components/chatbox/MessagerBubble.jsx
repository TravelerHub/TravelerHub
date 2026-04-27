import { useState, useEffect } from "react";
import { encryptionUtils } from "../../lib/encryption";
import { Avatar, avatarColorFor, formatTimeShort } from "./ui";

// Cluster position determines the bubble corner shape (the "tail" lives on the
// last bubble in a run from the same sender, like Telegram).
//
// position:
//   "only"   — single bubble (full pill-rounded, with tail)
//   "first"  — top of a run     (round top, slightly squared bottom-corner toward sender)
//   "middle" — middle of a run  (squared corners on sender side, round on other side)
//   "last"   — bottom of a run  (squared top-corner toward sender, round bottom — has the tail)
function bubbleRadius(position, isMine) {
  // Tailwind-esque inline values: 16px round, 6px squared.
  const R = "16px";
  const r = "6px";
  // Defaults: all 16px
  let tl = R, tr = R, br = R, bl = R;
  if (isMine) {
    // Sender side is the right edge; squashing happens on bottom-right / top-right
    if (position === "first")  { br = r; }
    else if (position === "middle") { tr = r; br = r; }
    else if (position === "last") { tr = r; }
    // "only" → all rounded
  } else {
    // Sender side is the left edge; squashing on bottom-left / top-left
    if (position === "first")  { bl = r; }
    else if (position === "middle") { tl = r; bl = r; }
    else if (position === "last") { tl = r; }
  }
  return `${tl} ${tr} ${br} ${bl}`;
}

// ── Status icon (single check / double check / read) ─────────────────────────
function StatusIcon({ readers }) {
  // We don't have explicit "delivered" state in the data model right now, so:
  //   readers.length === 0 → single check (sent)
  //   readers.length  >  0 → double check teal (read)
  // The "delivered" state can be wired up later when the backend exposes it.
  const isRead = (readers?.length ?? 0) > 0;
  const tint = isRead ? "#fbfbf2" : "rgba(255,255,255,0.55)";
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 16 12"
      fill="none"
      stroke={tint}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-label={isRead ? "Read" : "Sent"}
    >
      {/* primary check */}
      <path d="M2 6.5l3 3 6-7" />
      {/* second check (visible only when read) */}
      {isRead && <path d="M7 9.5l1.5 1.5L15 3" />}
    </svg>
  );
}

// ── Read receipts (tiny avatar dots under the bubble) ────────────────────────
function ReadReceipts({ readers, members }) {
  if (!readers || readers.length === 0) return null;
  const MAX = 3;
  const shown = readers.slice(0, MAX);
  const extra = readers.length - MAX;

  const initialsFor = (uid) => {
    const m = members?.find((u) => u.id === uid);
    return (m?.username || m?.email || uid || "?").slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center gap-0.5 justify-end mt-0.5 pr-1">
      {shown.map((uid) => (
        <span
          key={uid}
          title={members?.find((m) => m.id === uid)?.username || uid}
          className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
          style={{
            width: 16,
            height: 16,
            background: avatarColorFor(members?.find((m) => m.id === uid)?.username || uid),
            fontSize: 7,
          }}
        >
          {initialsFor(uid)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 16, height: 16, background: "#e5e7eb", color: "#6b7280", fontSize: 7, fontWeight: 700 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function MessageBubble({
  msg,
  isMine,
  conversationId,
  members,
  readers,
  // cluster metadata supplied by MessagerList
  position = "only",       // "only" | "first" | "middle" | "last"
  showAvatar = true,       // render avatar gutter (only on "last" / "only" for non-mine)
  showName = false,        // render sender name above bubble (only on "first" / "only" for non-mine, in groups)
  senderName = "",
  isGroup = false,
}) {
  const [decryptedContent, setDecryptedContent] = useState(msg.content || "");
  const [decryptError,     setDecryptError]     = useState(false);

  useEffect(() => {
    if (!msg.is_encrypted && !encryptionUtils.isLikelyEncryptedMessage(msg.content)) {
      setDecryptedContent(msg.content);
      setDecryptError(false);
      return;
    }
    const sessionKey = encryptionUtils.getCachedSessionKey(conversationId);
    if (!sessionKey) {
      setDecryptError(true);
      setDecryptedContent(null);
      return;
    }
    try {
      setDecryptedContent(encryptionUtils.decryptMessage(msg.content, sessionKey));
      setDecryptError(false);
    } catch {
      setDecryptError(true);
      setDecryptedContent(null);
    }
  }, [msg.content, msg.is_encrypted, conversationId]);

  const radius = bubbleRadius(position, isMine);
  const showTime = position === "last" || position === "only";

  // Tighter vertical spacing within a cluster, normal between clusters.
  const stackMargin =
    position === "middle" || position === "first" ? "1px" : undefined;

  return (
    <div
      className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
      style={{ marginTop: stackMargin }}
    >
      {/* Left avatar gutter (other side only) */}
      {!isMine && (
        <div className="shrink-0 w-8 flex items-end justify-center">
          {showAvatar ? (
            <Avatar name={senderName || "?"} size="xs" />
          ) : (
            <span className="block w-6 h-6" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Bubble */}
      <div className={`flex flex-col max-w-[78%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Sender name above first message of a cluster, group chats only */}
        {showName && !isMine && isGroup && (
          <p
            className="px-1 mb-0.5 text-[11px] font-semibold leading-tight"
            style={{ color: avatarColorFor(senderName) }}
          >
            {senderName}
          </p>
        )}

        <div
          className="px-3.5 py-2 text-sm shadow-sm"
          style={{
            borderRadius: radius,
            background: isMine ? "#183a37" : "#ffffff",
            color: isMine ? "#fbfbf2" : "#160f29",
            border: isMine ? "none" : "1px solid #ebebeb",
          }}
        >
          <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">
            {decryptError ? (
              <span style={{ color: isMine ? "rgba(251,251,242,0.6)" : "#9ca3af", fontStyle: "italic" }}>
                🔒 Encrypted with a previous key
              </span>
            ) : (
              decryptedContent || "[Empty message]"
            )}
          </p>

          {/* Time + status — only on the last bubble of a cluster */}
          {showTime && (
            <div
              className={`flex items-center gap-1 ${isMine ? "justify-end" : "justify-end"} mt-0.5`}
              style={{ color: isMine ? "rgba(251,251,242,0.6)" : "#9ca3af" }}
            >
              <span className="text-[10px] leading-none">
                {formatTimeShort(msg.sent_datetime)}
              </span>
              {isMine && <StatusIcon readers={readers} />}
            </div>
          )}
        </div>

        {/* Read-receipt avatar dots under own message, only on last of cluster */}
        {isMine && showTime && <ReadReceipts readers={readers} members={members} />}
      </div>
    </div>
  );
}
