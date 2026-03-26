import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  sendMessage,
  getConversations,
  getConversationMessages,
  deleteConversation,
} from "../services/chatbotService";

// Feature routes the bot can direct users to
const FEATURE_ROUTES = {
  navigation: { path: "/navigation", label: "Navigation" },
  booking: { path: "/booking", label: "Booking" },
  expenses: { path: "/expenses", label: "Smart Scanner" },
  calendar: { path: "/calendar", label: "Calendar" },
  finance: { path: "/finance", label: "Finance" },
  message: { path: "/message", label: "Messenger" },
  profile: { path: "/profile", label: "Profile" },
  settings: { path: "/settings", label: "Settings" },
  dashboard: { path: "/dashboard", label: "Dashboard" },
};

const QUICK_PROMPTS = [
  { icon: "🗺️", label: "Plan trip", text: "Help me plan a trip" },
  { icon: "🍽️", label: "Find food", text: "Find popular restaurants nearby" },
  { icon: "💱", label: "Currency", text: "Convert 100 USD to EUR" },
  { icon: "🌍", label: "Translate", text: "Translate 'Where is the train station?' to Spanish" },
  { icon: "📋", label: "My trips", text: "Show me my current trips" },
  { icon: "🎯", label: "Activities", text: "Suggest fun activities for a group trip" },
];

function ChatWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("chat"); // "chat" | "history"
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Stop speech when widget closes
  useEffect(() => {
    if (!isOpen && isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, [isOpen, isSpeaking]);

  async function loadConversations() {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }

  async function loadMessages(conversationId) {
    try {
      const data = await getConversationMessages(conversationId);
      setMessages(data);
      setActiveConversationId(conversationId);
      setView("chat");
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  function startNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setView("chat");
  }

  async function handleSend(text = null) {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: messageText, id: "u-" + Date.now() },
    ]);
    setLoading(true);

    try {
      const data = await sendMessage(messageText, activeConversationId);

      if (!activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }

      const botReply = data.response;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botReply, id: "b-" + Date.now() },
      ]);

      // If widget is closed, show unread dot
      if (!isOpen) setHasUnread(true);

      // Check if bot response contains navigation suggestions
      detectAndOfferNavigation(botReply);
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          id: "e-" + Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function detectAndOfferNavigation(text) {
    // The bot's response is handled naturally — navigation buttons
    // are rendered when the bot includes feature keywords
  }

  // Text-to-Speech
  function speakText(text) {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    // Clean markdown formatting for speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/#+\s/g, "")
      .replace(/[-*]\s/g, "");

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synthRef.current.speak(utterance);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Parse bot messages for inline navigation links like [Navigate](/navigation)
  function renderMessageContent(text, role) {
    if (role === "user") return text;

    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).replace(/^\w+\n/, "");
        return (
          <pre
            key={i}
            className="bg-gray-800 text-green-300 rounded-lg p-2 my-1.5 overflow-x-auto text-xs"
          >
            <code>{code}</code>
          </pre>
        );
      }
      return (
        <span key={i}>
          {part.split("\n").map((line, j) => {
            // Check for navigation-like patterns
            let processed = line;

            // Bold
            processed = processed.replace(
              /\*\*(.*?)\*\*/g,
              '<strong class="font-semibold">$1</strong>'
            );
            // Inline code
            processed = processed.replace(
              /`(.*?)`/g,
              '<code class="bg-gray-200 text-gray-800 px-1 rounded text-xs">$1</code>'
            );
            // Bullet points
            if (processed.match(/^\s*[-*]\s/)) {
              processed = "  \u2022 " + processed.replace(/^\s*[-*]\s/, "");
            }

            return (
              <span key={j}>
                <span dangerouslySetInnerHTML={{ __html: processed }} />
                {j < part.split("\n").length - 1 && <br />}
              </span>
            );
          })}
        </span>
      );
    });
  }

  // Detect feature keywords in bot response to show action buttons
  function getActionButtons(text) {
    const buttons = [];
    const lower = text.toLowerCase();
    if (lower.includes("navigation") || lower.includes("route") || lower.includes("map") || lower.includes("directions"))
      buttons.push(FEATURE_ROUTES.navigation);
    if (lower.includes("booking") || lower.includes("hotel") || lower.includes("flight") || lower.includes("reservation"))
      buttons.push(FEATURE_ROUTES.booking);
    if (lower.includes("expense") || lower.includes("receipt") || lower.includes("scan"))
      buttons.push(FEATURE_ROUTES.expenses);
    if (lower.includes("calendar") || lower.includes("schedule") || lower.includes("itinerary"))
      buttons.push(FEATURE_ROUTES.calendar);
    if (lower.includes("budget") || lower.includes("finance") || lower.includes("money"))
      buttons.push(FEATURE_ROUTES.finance);
    // Deduplicate
    const seen = new Set();
    return buttons.filter((b) => {
      if (seen.has(b.path)) return false;
      seen.add(b.path);
      return true;
    });
  }

  // All hooks above — safe to early-return now
  if (!token) return null;
  if (pathname === "/message") return null;

  const isNewChat = messages.length === 0;

  return (
    <>
      {/* ── Floating Toggle Button ─────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-[9999] hover:scale-105 active:scale-95"
        style={{
          background: "#160f29",
          boxShadow: "0 4px 24px rgba(22, 15, 41, 0.45)",
        }}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            {hasUnread && (
              <span
                className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
                style={{ background: "#ef4444", borderColor: "#160f29" }}
              />
            )}
          </>
        )}
      </button>

      {/* ── Chat Panel ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 w-96 h-[560px] rounded-2xl flex flex-col z-[9998] overflow-hidden"
          style={{
            background: "#fbfbf2",
            border: "1px solid #d1d5db",
            boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ background: "#160f29", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#fbfbf2" }}>TravelBot</h3>
                <span className="text-xs" style={{ color: "#9ca3af" }}>AI Travel Assistant</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {/* History button */}
              <button
                onClick={() => {
                  if (view === "history") {
                    setView("chat");
                  } else {
                    loadConversations();
                    setView("history");
                  }
                }}
                className="p-1.5 rounded-lg transition hover:bg-white/10"
                title="Chat history"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#9ca3af">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {/* New chat */}
              <button
                onClick={startNewChat}
                className="p-1.5 rounded-lg transition hover:bg-white/10"
                title="New chat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#9ca3af">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>

          {view === "history" ? (
            /* ── History View ── */
            <div className="flex-1 overflow-y-auto" style={{ background: "#fbfbf2" }}>
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-sm"
                  style={{ color: "#9ca3af" }}>
                  <svg className="w-10 h-10 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                  No conversations yet
                </div>
              ) : (
                <div className="py-1.5">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadMessages(conv.id)}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer transition group"
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>
                          {conv.title || "New chat"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                          {new Date(conv.updated_at || conv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id).then(() => {
                            setConversations((prev) =>
                              prev.filter((c) => c.id !== conv.id)
                            );
                            if (activeConversationId === conv.id) startNewChat();
                          });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition"
                        style={{ color: "#ef4444" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : isNewChat ? (
            /* ── Welcome / Quick Prompts ── */
            <div className="flex-1 overflow-y-auto px-4 py-5" style={{ background: "#fbfbf2" }}>
              <div className="text-center mb-5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#160f29" }}
                >
                  <svg style={{ width: 22, height: 22 }} fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-sm" style={{ color: "#111827" }}>
                  How can I help you travel?
                </h3>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                  Plan trips, find places, convert currency, translate & more
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => handleSend(prompt.text)}
                    className="text-left p-2.5 rounded-xl transition group"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                      e.currentTarget.style.borderColor = "#374151";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    <span className="text-base">{prompt.icon}</span>
                    <p className="text-xs font-medium mt-1" style={{ color: "#374151" }}>
                      {prompt.label}
                    </p>
                  </button>
                ))}
              </div>

              {/* Quick feature nav */}
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                <p className="text-xs mb-2" style={{ color: "#9ca3af" }}>Quick navigation</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { icon: "🗺️", label: "Navigate", path: "/navigation" },
                    { icon: "🏨", label: "Bookings",  path: "/booking"    },
                    { icon: "🧾", label: "Scanner",   path: "/expenses"   },
                    { icon: "📅", label: "Calendar",  path: "/calendar"   },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        color: "#374151",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f3f4f6";
                        e.currentTarget.style.borderColor = "#374151";
                        e.currentTarget.style.color = "#111827";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.borderColor = "#d1d5db";
                        e.currentTarget.style.color = "#374151";
                      }}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          ) : (
            /* ── Messages ── */
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: "#fbfbf2" }}>
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center mr-2 mt-1 shrink-0"
                        style={{ background: "#160f29" }}
                      >
                        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    )}
                    <div
                      className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                      style={
                        msg.role === "user"
                          ? { background: "#160f29", color: "#fbfbf2" }
                          : { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" }
                      }
                    >
                      <div className="leading-relaxed whitespace-pre-wrap">
                        {renderMessageContent(msg.content, msg.role)}
                      </div>
                    </div>
                  </div>

                  {/* Action bar for assistant messages */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 ml-8 mt-1">
                      {/* Read aloud button */}
                      <button
                        onClick={() => speakText(msg.content)}
                        className="p-1 rounded transition"
                        title={isSpeaking ? "Stop reading" : "Read aloud"}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {isSpeaking ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#160f29">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#9ca3af">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        )}
                      </button>

                      {/* Feature navigation buttons based on response content */}
                      {getActionButtons(msg.content).map((btn) => (
                        <button
                          key={btn.path}
                          onClick={() => navigate(btn.path)}
                          className="px-2 py-0.5 rounded-full text-xs font-medium transition"
                          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#160f29";
                            e.currentTarget.style.color = "#fbfbf2";
                            e.currentTarget.style.borderColor = "#160f29";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f3f4f6";
                            e.currentTarget.style.color = "#374151";
                            e.currentTarget.style.borderColor = "#d1d5db";
                          }}
                        >
                          Go to {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center mr-2 shrink-0"
                    style={{ background: "#160f29" }}
                  >
                    <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="#fbfbf2">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="rounded-2xl px-4 py-2.5" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#9ca3af" }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#9ca3af", animationDelay: "0.15s" }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#9ca3af", animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* ── Input Area ── */}
          {view === "chat" && (
            <div
              className="px-3 py-3 shrink-0"
              style={{ borderTop: "1px solid #e5e7eb", background: "#ffffff" }}
            >
              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2 transition"
                style={{ background: "#f3f4f6", border: "1px solid #d1d5db" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#374151"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "#d1d5db"}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything…"
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-sm"
                  style={{ minHeight: "20px", maxHeight: "80px", color: "#111827" }}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg transition shrink-0"
                  style={
                    input.trim() && !loading
                      ? { background: "#160f29", color: "#fbfbf2" }
                      : { background: "#e5e7eb", color: "#9ca3af" }
                  }
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
              <p className="text-center text-[10px] mt-1.5" style={{ color: "#9ca3af" }}>
                Powered by Gemini AI
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ChatWidget;
