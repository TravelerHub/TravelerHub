import { useEffect, useMemo, useRef } from "react";
import { Avatar, EmptyState } from "./ui";
import MessageList from "./MessagerList";

export default function ChatWindow({
  loading,
  title,
  currentUserId,
  members,
  messages,
  error,
}) {
  const listRef = useRef(null);

  // scroll to bottom on new messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages?.length]);

  const subtitle = useMemo(() => {
    const others = (members || []).filter((u) => u.id !== currentUserId);
    if (!others.length) return "Members loading…";
    return `${others.length + 1} member(s)`;
  }, [members, currentUserId]);

  return (
    <>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center gap-3">
        <Avatar name={title} size="md" />
        <div className="min-w-0">
          <div className="font-semibold text-gray-800 truncate">{title}</div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
      </div>

      {/* Body */}
      <div ref={listRef} className="flex-1 overflow-auto p-3 bg-gray-50">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Could not load messages" subtitle={error} />
        ) : (
          <MessageList messages={messages} currentUserId={currentUserId} />
        )}
      </div>

      {/* Footer (optional for now) */}
      <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
        (Hook up your send-message input here)
      </div>
    </>
  );
}
