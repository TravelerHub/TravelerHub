import MessageBubble from "./MessagerBubble";

export default function MessageList({ messages, currentUserId }) {
  if (!messages?.length) {
    return (
      <div className="text-sm text-gray-500 text-center mt-8">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <MessageBubble key={m.message_id} msg={m} isMine={m.from_user === currentUserId} />
      ))}
    </div>
  );
}
