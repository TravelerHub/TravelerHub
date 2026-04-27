import { PlusIcon } from "@heroicons/react/24/outline";
import { Avatar, EmptyState, relativeShort } from "./ui";

// Strip a likely-encrypted blob down to "🔒 Encrypted" so the preview line
// doesn't show base64 garbage to the user. The full decrypt only happens
// inside the active chat.
function previewText(raw) {
  if (!raw) return "";
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  // Heuristic: very long pure base64-ish strings → encrypted blob
  if (trimmed.length > 80 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) return "🔒 Encrypted message";
  return trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;
}

export default function ConversationList({
  loading,
  conversations,
  selectedId,
  onSelect,
  currentUserId,
  membersByConversation,
  onNewChat,
}) {
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "#f3f4f6" }} />
        ))}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState
          title="No conversations yet"
          subtitle="Start a new chat to get going."
        />
        {onNewChat && (
          <div className="p-3">
            <button
              onClick={onNewChat}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-95"
              style={{ background: "#183a37", color: "#fbfbf2" }}
            >
              + New Chat
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {conversations.map((c) => {
          const id      = c.conversation_id ?? c.id ?? c.conversationId;
          const members = membersByConversation?.[id] || [];
          const others  = members.filter((u) => u.id !== currentUserId);
          const isActive = selectedId === id;

          const title =
            c.conversation_name?.trim() ||
            (others.length
              ? others.map((u) => u.username || u.email || u.id).join(", ")
              : `Conversation ${String(id).slice(0, 6)}`);

          // Last-message metadata is optional from the backend — use whatever
          // is available, fall back to the legacy "X members" subtitle.
          const lastMsg     = c.last_message || c.lastMessage || null;
          const lastMsgAt   = c.last_message_at || c.lastMessageAt || lastMsg?.sent_datetime || null;
          const lastMsgFrom = lastMsg?.from_user || lastMsg?.fromUser || null;
          const lastMsgText = lastMsg?.content || lastMsg?.text || (typeof lastMsg === "string" ? lastMsg : "");
          const unread      = Number(c.unread_count || c.unreadCount || 0);

          // Preview line: "you: hey there" / "Sara: hey there" / fallback subtitle
          let previewLine;
          if (lastMsg && lastMsgText) {
            const senderLabel = lastMsgFrom === currentUserId
              ? "You: "
              : (() => {
                  const sender = members.find((u) => u.id === lastMsgFrom);
                  const name = sender?.username || sender?.email;
                  return name ? `${name}: ` : "";
                })();
            previewLine = `${senderLabel}${previewText(lastMsgText)}`;
          } else {
            previewLine = others.length ? `${others.length + 1} members` : "Loading…";
          }

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors"
              style={{
                background: isActive ? "#183a37" : "transparent",
                color: isActive ? "#fbfbf2" : "inherit",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Avatar name={title} size="md" />

              <div className="min-w-0 flex-1">
                {/* Top row: title + relative time on the right */}
                <div className="flex items-baseline gap-2">
                  <p
                    className="text-sm font-semibold truncate leading-tight flex-1"
                    style={{ color: isActive ? "#fbfbf2" : "#160f29" }}
                  >
                    {title}
                  </p>
                  {lastMsgAt && (
                    <span
                      className="shrink-0 text-[10px] font-medium leading-none"
                      style={{ color: isActive ? "rgba(251,251,242,0.65)" : "#9ca3af" }}
                    >
                      {relativeShort(lastMsgAt)}
                    </span>
                  )}
                </div>

                {/* Bottom row: preview + unread badge */}
                <div className="flex items-center gap-2 mt-0.5">
                  <p
                    className="text-[12px] truncate flex-1 leading-snug"
                    style={{
                      color: isActive
                        ? "rgba(251,251,242,0.7)"
                        : (unread > 0 ? "#160f29" : "#6b7280"),
                      fontWeight: unread > 0 ? 600 : 400,
                    }}
                  >
                    {previewLine}
                  </p>
                  {unread > 0 && (
                    <span
                      className="shrink-0 inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: "0 6px",
                        background: isActive ? "#fbfbf2" : "#183a37",
                        color: isActive ? "#160f29" : "#fbfbf2",
                      }}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* New chat button pinned at bottom */}
      {onNewChat && (
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid #ebebeb" }}>
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition hover:opacity-90 active:scale-95"
            style={{ background: "#183a37", color: "#fbfbf2" }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>
      )}
    </div>
  );
}
