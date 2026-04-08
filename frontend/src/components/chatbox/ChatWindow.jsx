import { useEffect, useMemo, useState, useRef } from "react";
import { Avatar, EmptyState } from "./ui";
import MessageList from "./MessagerList";
import { chatApi } from "./chatAPI";
import { encryptionUtils } from "../../lib/encryption";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { API_BASE } from "../../config.js";

export default function ChatWindow({
  loading,
  title,
  currentUserId,
  members,
  messages,
  error,
  conversationID,
}) {
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [text,            setText]            = useState("");
  const [localMessages,   setLocalMessages]   = useState(messages || []);
  const [encryptionError, setEncryptionError] = useState(null);
  const [sending,         setSending]         = useState(false);
  const retryRef = useRef(null);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      setEncryptionError(null);
      await chatApi.sendMessage(conversationID, trimmed);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Send error:", err);
      setEncryptionError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { setLocalMessages(messages || []); }, [messages, conversationID]);

  // Stop any pending key-wait retry when conversation changes
  useEffect(() => {
    return () => {
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
    };
  }, [conversationID]);

  // Fetch + decrypt the session key once when the conversation opens.
  // If no key exists yet (e.g. conversations created before the migration),
  // generate one and distribute it to all current members right away.
  useEffect(() => {
    if (!conversationID) return;

    const initSessionKey = async () => {
      const memberIds = (members || []).map((m) => m.id).filter(Boolean);

      // Already cached — still try to distribute to any members added since last open
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
        // Try to fetch existing key from server and decrypt client-side
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

        // No key on server for this user — generate one and distribute.
        // If members haven't loaded yet, return silently; effect re-runs when they do.
        if (memberIds.length === 0) return;

        await chatApi.setupConversationEncryption(conversationID, memberIds);
        setEncryptionError(null);
      } catch (err) {
        if (err.message?.includes("Failed to decrypt session key")) {
          // Private key mismatch — rotate keypair WITHOUT changing the session key.
          // Deleting our server entry makes us appear "missing" to other members.
          // When any member opens the chat, distributeToMissingMembers re-encrypts
          // the SAME session key with our new public key → old messages stay readable.
          console.warn("Session key mismatch — rotating keypair, waiting for peer redistribution");
          try {
            await chatApi.rotateKeypair(conversationID);
            setEncryptionError("Waiting for key — ask another member to open the chat");

            // Retry every 5 s (up to 24 attempts = 2 min) until a member redistributes
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

  // WebSocket real-time updates
  useEffect(() => {
    if (!conversationID) return;
    let isActive = true;
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/ws/conversations/${conversationID}`);
    ws.onmessage = (event) => {
      if (!isActive) return;
      const msg = JSON.parse(event.data);
      setLocalMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });
    };
    ws.onerror  = (e) => { if (isActive) console.error("WebSocket error:", e); };
    ws.onclose  = ()  => { if (isActive) console.log("WebSocket closed"); };
    const ping  = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 25000);
    return () => { isActive = false; clearInterval(ping); ws.close(); };
  }, [conversationID]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [localMessages?.length]);

  const subtitle = useMemo(() => {
    const others = (members || []).filter((u) => u.id !== currentUserId);
    if (!others.length) return "Loading members…";
    return `${others.length + 1} members`;
  }, [members, currentUserId]);

  return (
    <div className="flex flex-col h-full">

      {/* ── Chat header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid #ebebeb" }}
      >
        <Avatar name={title} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate leading-tight" style={{ color: "#160f29" }}>
            {title || "Conversation"}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
            {subtitle}
          </p>
        </div>

        {/* Encryption status dot */}
        <span
          className="shrink-0 flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
          style={{
            background: encryptionError ? "#fef2f2" : "rgba(24,58,55,0.08)",
            color: encryptionError ? "#dc2626" : "#183a37",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: encryptionError ? "#dc2626" : "#16a34a" }}
          />
          {encryptionError ? "Encryption issue" : "Encrypted"}
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
          />
        )}
      </div>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3 flex items-end gap-2"
        style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Auto-grow up to ~4 lines
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 104) + "px";
          }}
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
  );
}
