import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';

// Import Heroicons
import {
  ChatBubbleLeftRightIcon  
} from '@heroicons/react/24/outline';

function Message() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    // example seed; real data should come from API
    // { message_id: "1", from_user: "alice", content: "Hi!", sent_datetime: new Date().toISOString(), conversation_id: "conv1" }
    { message_id: "1", from_user: "alice", content: "Hi!", sent_datetime: new Date().toISOString(), conversation_id: "conv1" }
  ]);
  const [text, setText] = useState("");
  const [conversationId] = useState("conv1"); // replace dynamically
  const listRef = useRef(null);

  useEffect(() => {
    // load messages for conversationId (replace with real API)
    async function load() {
      // const res = await fetch(`/api/conversations/${conversationId}/messages`);
      // const data = await res.json();
      // setMessages(data);
    }
    load();
  }, [conversationId]);

  useEffect(() => {
    // scroll to bottom on new messages
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const newMsg = {
      message_id: Date.now().toString(),
      from_user: "current_user_id",
      content: text,
      sent_datetime: new Date().toISOString(),
      conversation_id: conversationId,
    };
    // optimistic UI
    setMessages((m) => [...m, newMsg]);
    setText("");

    // replace with real POST to backend
    // await fetch("/messages", { method: "POST", body: JSON.stringify({ from_user:..., content: text, conversation_id })})
    // optionally replace optimistic item with server response
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-7 h-7 text-blue-600" />
              Message
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12, background: "#fafafa" }}>
        {messages.map((m) => (
          <div key={m.message_id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{m.from_user}</div>
            <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 12, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
              {m.content}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{new Date(m.sent_datetime).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>

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
  );
}

export default Message;