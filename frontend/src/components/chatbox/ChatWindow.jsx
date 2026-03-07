import { useEffect, useMemo, useState, useRef } from "react";
import { Avatar, EmptyState } from "./ui";
import MessageList from "./MessagerList";

export default function ChatWindow({
  loading,
  title,
  currentUserId,
  members,
  messages,
  error,
  conversationID
}) {
  const listRef = useRef(null);
  const [text, setText] = useState("");
  const [localMessages, setLocalMessages] = useState(messages || []);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const newMsg = {
      from_user: currentUserId,
      content: text,
      sent_datetime: new Date().toISOString(),
      conversation_id: conversationID
    };
    
    try {
      const res = await fetch("http://localhost:8000/api/conversations/" + conversationID + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg)
      });
      if (!res.ok) throw new Error("Failed to send message");
      setText("");
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
  setLocalMessages(messages || []);
}, [messages, conversationID]);

// WebSocket for real-time updates
useEffect(() => {
  if (!conversationID) return;

  const ws = new WebSocket(`ws://localhost:8000/api/ws/conversations/${conversationID}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    setLocalMessages((prev) => {
      if (prev.some((m) => m.message_id === msg.message_id)) return prev;
      return [...prev, msg];
    });
  };

  // optional keepalive (your backend waits for receive_text)
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
  }, 25000);

  return () => {
    clearInterval(ping);
    ws.close();
  };
}, [conversationID]);

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
          <MessageList messages={localMessages} currentUserId={currentUserId} />
        )}
      </div>

      {/* Footer */}
      <div>
        <footer style={{ padding: 12, borderTop: "1px solid #e6edf3", display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Type a message..."
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <button onClick={sendMessage} style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white", border: "none" }}>
            Send
          </button>
        </footer>
      </div>

    </>
  );
}
