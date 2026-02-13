import { RowButton, Avatar, Badge, EmptyState } from "./ui";

/**
 * conversations: [{ conversation_id, conversation_name? }]
 * membersByConversation: { [conversationId]: [{id, username, email}] }
 */
export default function ConversationList({
  loading,
  conversations,
  selectedId,
  onSelect,
  currentUserId,
  membersByConversation,
}) {
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!conversations?.length) {
    return <EmptyState title="No conversations" subtitle="Start a new chat to see it here." />;
  }

  return (
    <div className="p-2 space-y-1">
      {conversations.map((c) => {
        const id = c.conversation_id ?? c.id ?? c.conversationId;
        const members = membersByConversation?.[id] || [];
        const others = members.filter((u) => u.id !== currentUserId);

        const title =
          c.conversation_name?.trim() ||
          (others.length
            ? others.map((u) => u.username || u.email || u.id).join(", ")
            : `Conversation ${String(id).slice(0, 6)}`);

        return (
          <RowButton key={id} active={selectedId === id} onClick={() => onSelect(id)}>
            <Avatar name={title} size="sm" />
            <div className="min-w-0">
              <div className="font-medium text-gray-800 truncate">{title}</div>
              <div className="text-xs text-gray-500 truncate">
                {others.length ? `${others.length} other member(s)` : "Loading members…"}
              </div>
            </div>
            {others.length > 0 && <Badge>{others.length + 1}</Badge>}
          </RowButton>
        );
      })}
    </div>
  );
}
