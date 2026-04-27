import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Avatar, EmptyState } from "./ui";
import MessageList from "./MessagerList";
import { chatApi } from "./chatAPI";
import { encryptionUtils } from "../../lib/encryption";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { API_BASE } from "../../config.js";

// ── Typing indicator dots animation ─────────────────────────────────────────
const typingDotsStyle = `
@keyframes typingPulse {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40%            { opacity: 1;    transform: translateY(-3px); }
}
.typing-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: typingPulse 1.2s infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
`;

function TypingIndicator({ typingUsers }) {
  const names = [...typingUsers.values()];
  if (names.length === 0) return null;

  let label;
  if (names.length === 1)      label = `${names[0]} is typing`;
  else if (names.length === 2) label = `${names[0]} and ${names[1]} are typing`;
  else                         label = `${names.length} people are typing`;

  return (
    <div
      className="flex items-center gap-1.5 px-1 mt-1"
      style={{ color: "#9ca3af", fontSize: "12px", fontStyle: "italic" }}
    >
      <span>{label}</span>
      <span className="flex items-center gap-[3px] ml-0.5" style={{ color: "#9ca3af" }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </div>
  );
}

export default function ChatWindow({
  loading,
  title,
  currentUserId,
  members,
  messages,
  error,
  conversationID,
}) {
  const listRef      = useRef(null);
  const inputRef     = useRef(null);
  const wsRef        = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef  = useRef(false);

  const [text,            setText]            = useState("");
  const [localMessages,   setLocalMessages]   = useState(messages || []);
  const [encryptionError, setEncryptionError] = useState(null);
  const [sending,         setSending]         = useState(false);
  const [typingUsers,     setTypingUsers]     = useState(new Map()); // user_id → username
  const [readStatus,      setReadStatus]      = useState(new Map()); // user_id → last_read_message_id
  const retryRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const currentUsername = useMemo(() => {
    const me = (members || []).find((m) => m.id === currentUserId);
    return me?.username || me?.email || "Someone";
  }, [members, currentUserId]);

  const lastMessageId = useMemo(() => {
    if (!localMessages?.length) return null;
    return localMessages[localMessages.length - 1]?.message_id ?? null;
  }, [localMessages]);

  const sendWsEvent = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  // ── Typing events ──────────────────────────────────────────────────────────

  const sendTypingStop = useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    sendWsEvent({ type: "typing_stop", user_id: currentUserId });
  }, [currentUserId, sendWsEvent]);

  const handleInputChange = useCallback((e) => {
    setText(e.target.value);
    // Auto-grow up to ~4 lines
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 104) + "px";

    // Send typing event (debounced stop after 2 s)
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendWsEvent({ type: "typing", user_id: currentUserId, username: currentUsername });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTypingStop();
    }, 2000);
  }, [currentUserId, currentUsername, sendWsEvent, sendTypingStop]);

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Cancel any pending typing debounce and stop indicator
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingStop();

    setSending(true);
    try {
      setEncryptionError(null);
      await chatApi.sendMessage(conversationID, trimmed);
      setText("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.focus();
      }
    } catch (err) {
      console.error("Send error:", err);
      setEncryptionError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // ── Sync messages from parent ──────────────────────────────────────────────

  useEffect(() => {
    setLocalMessages(messages || []);
  }, [messages, conversationID]);

  // Stop any pending key-wait retry when conversation changes
  useEffect(() => {
    return () => {
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationID]);

  // ── Session key init ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationID) return;

    const initSessionKey = async () => {
      const memberIds = (members || []).map((m) => m.id).filter(Boolean);

      const cached = encryptionUtils.getCachedSessionKey(conversationID);
      if (cached) {
        setEncryptionError(null);
        if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
        if (memberIds.length > 0) {
          chatApi.distributeToMissingMembers(conversationID, cached, memberIds).catch(() => {});
        }
        return;
      }

      try {
        const sessionKey = await chatApi.fetchAndDecryptSessionKey(conversationID);
        if (sessionKey) {
          encryptionUtils.cacheSessionKey(conversationID, sessionKey);
          setEncryptionError(null);
          if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
          if (memberIds.length > 0) {
            chatApi.distributeToMissingMembers(conversationID, sessionKey, memberIds).catch(() => {});
          }
          return;
        }

        if (memberIds.length === 0) return;
        await chatApi.setupConversationEncryption(conversationID, memberIds);
        setEncryptionError(null);
      } catch (err) {
        if (err.message?.includes("Failed to decrypt session key")) {
          console.warn("Session key mismatch — rotating keypair, waiting for peer redistribution");
          try {
            await chatApi.rotateKeypair(conversationID);
            setEncryptionError("Waiting for key — ask another member to open the chat");

            let attempts = 0;
            if (retryRef.current) clearInterval(retryRef.current);
            retryRef.current = setInterval(async () => {
              attempts++;
              try {
                const key = await chatApi.fetchAndDecryptSessionKey(conversationID);
                if (key) {
                  encryptionUtils.cacheSessionKey(conversationID, key);
                  setEncryptionError(null);
                  clearInterval(retryRef.current);
                  retryRef.current = null;
                }
              } catch { /* still waiting */ }
              if (attempts >= 24) {
                clearInterval(retryRef.current);
                retryRef.current = null;
                setEncryptionError("Could not recover key — refresh when another member is online");
              }
            }, 5000);
          } catch (rotateErr) {
            console.error("Key rotation failed:", rotateErr);
            setEncryptionError("Could not load encryption key");
          }
        } else {
          console.error("Session key init error:", err);
          setEncryptionError("Could not load encryption key");
        }
      }
    };

    initSessionKey();
  }, [conversationID, members]);

  // ── WebSocket — real-time messages + presence events ──────────────────────

  useEffect(() => {
    if (!conversationID) return;
    let isActive = true;
    let retryCount = 0;
    let reconnectTimer = null;
    let pingInterval = null;

    const connect = () => {
      if (!isActive) return;
      clearInterval(pingInterval);

      const wsBase = API_BASE.replace(/^http/, "ws");
      // Browsers can't send custom Authorization headers on a WS handshake,
      // so we pass the JWT as ?token=... The server validates it + the
      // conversation membership BEFORE accepting the connection.
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const ws = new WebSocket(
        `${wsBase}/api/ws/conversations/${conversationID}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount = 0;
        if (currentUserId && lastMessageId) {
          ws.send(JSON.stringify({
            type: "read",
            user_id: currentUserId,
            last_read_message_id: lastMessageId,
          }));
        }
      };

      ws.onmessage = (event) => {
        if (!isActive) return;
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.type === "typing") {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.set(data.user_id, data.username || data.user_id);
            return next;
          });
        } else if (data.type === "typing_stop") {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.user_id);
            return next;
          });
        } else if (data.type === "read") {
          setReadStatus((prev) => {
            const next = new Map(prev);
            next.set(data.user_id, data.last_read_message_id);
            return next;
          });
        } else {
          const msg = data;
          if (msg.message_id) {
            setLocalMessages((prev) => {
              if (prev.some((m) => m.message_id === msg.message_id)) return prev;
              return [...prev, msg];
            });
          }
        }
      };

      ws.onerror = (e) => { if (isActive) console.error("WebSocket error:", e); };

      ws.onclose = () => {
        if (!isActive) return;
        clearInterval(pingInterval);
        wsRef.current = null;
        // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        retryCount = Math.min(retryCount + 1, 5);
        reconnectTimer = setTimeout(connect, delay);
      };

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    connect();

    return () => {
      isActive = false;
      clearTimeout(reconnectTimer);
      clearInterval(pingInterval);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) ws.close();
      setTypingUsers(new Map());
      setReadStatus(new Map());
    };
  }, [conversationID]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send read receipt when new messages arrive (window focused) ────────────

  useEffect(() => {
    if (!currentUserId || !lastMessageId || !conversationID) return;
    sendWsEvent({
      type: "read",
      user_id: currentUserId,
      last_read_message_id: lastMessageId,
    });
  }, [lastMessageId, currentUserId, conversationID, sendWsEvent]);

  // ── Scroll to bottom on new messages ──────────────────────────────────────

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [localMessages?.length]);

  // ── Subtitle ───────────────────────────────────────────────────────────────

  const subtitle = useMemo(() => {
    const others = (members || []).filter((u) => u.id !== currentUserId);
    if (!others.length) return "Loading members…";
    return `${others.length + 1} members`;
  }, [members, currentUserId]);

  return (
    <>
      {/* Inject keyframe CSS once */}
      <style>{typingDotsStyle}</style>

      <div className="flex flex-col h-full">

        {/* ── Chat header (sticky, Telegram-style) ─────────────────────── */}
        <div
          className="sticky top-0 z-10 shrink-0 flex items-center gap-3 px-4 py-2.5"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #ebebeb",
            backdropFilter: "saturate(180%) blur(8px)",
          }}
        >
          <Avatar name={title} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate leading-tight" style={{ color: "#160f29" }}>
              {title || "Conversation"}
            </p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: "#5c6b73" }}>
              {subtitle}
            </p>
          </div>

          {/* Encryption status — single small lock icon, color tells the state */}
          <span
            className="shrink-0 inline-flex items-center justify-center rounded-full"
            title={encryptionError ? `Encryption issue: ${encryptionError}` : "End-to-end encrypted"}
            style={{
              width: 26,
              height: 26,
              background: encryptionError ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)",
              color: encryptionError ? "#dc2626" : "#16a34a",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
        </div>

        {/* ── Message body ─────────────────────────────────────────────── */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ background: "#f9fafb" }}
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-9 rounded-2xl animate-pulse ${i % 3 === 0 ? "ml-auto w-2/3" : "w-1/2"}`}
                  style={{ background: "#e5e7eb" }}
                />
              ))}
            </div>
          ) : error ? (
            <EmptyState title="Could not load messages" subtitle={error} />
          ) : (
            <MessageList
              messages={localMessages}
              currentUserId={currentUserId}
              conversationId={conversationID}
              members={members}
              readStatus={readStatus}
            />
          )}

          {/* Typing indicator */}
          <TypingIndicator typingUsers={typingUsers} />
        </div>

        {/* ── Input bar ───────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-4 py-3 flex items-end gap-2"
          style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition focus:ring-2 leading-relaxed"
            style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              color: "#160f29",
              "--tw-ring-color": "#183a37",
              minHeight: "40px",
              maxHeight: "104px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-40"
            style={{ background: "#000000" }}
          >
            <PaperAirplaneIcon className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}
