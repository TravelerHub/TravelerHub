import { PlusIcon } from "@heroicons/react/24/outline";
import { Avatar, RowButton, EmptyState } from "./ui";

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
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#f3f4f6" }} />
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
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
              style={{ background: "#000000", color: "#f9fafb" }}
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

          const sub = others.length
            ? `${others.length + 1} members`
            : "Loading…";

          return (
            <RowButton key={id} active={isActive} onClick={() => onSelect(id)}>
              <Avatar name={title} size="sm" />
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold truncate leading-tight"
                  style={{ color: isActive ? "#ffffff" : "#160f29" }}
                >
                  {title}
                </p>
                <p
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: isActive ? "rgba(255,255,255,0.55)" : "#9ca3af" }}
                >
                  {sub}
                </p>
              </div>
            </RowButton>
          );
        })}
      </div>

      {/* New chat button pinned at bottom */}
      {onNewChat && (
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid #ebebeb" }}>
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition hover:bg-gray-700 active:scale-95"
            style={{ background: "#000000", color: "#f9fafb" }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>
      )}
    </div>
  );
}
