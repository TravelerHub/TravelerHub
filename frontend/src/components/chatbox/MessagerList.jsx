import MessageBubble from "./MessagerBubble";

export default function MessageList({ messages, currentUserId, conversationId, members, readStatus }) {
  if (!messages?.length) {
    return (
      <div className="text-sm text-gray-500 text-center mt-8">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => {
        // Collect readers whose last_read_message_id === this message's id
        // Only compute for messages sent by the current user
        let readers = [];
        if (m.from_user === currentUserId && readStatus) {
          for (const [userId, lastReadId] of readStatus.entries()) {
            if (userId !== currentUserId && lastReadId === m.message_id) {
              readers.push(userId);
            }
          }
        }

        return (
          <MessageBubble
            key={m.message_id}
            msg={m}
            isMine={m.from_user === currentUserId}
            conversationId={conversationId}
            members={members}
            readers={readers}
          />
        );
      })}
    </div>
  );
}
