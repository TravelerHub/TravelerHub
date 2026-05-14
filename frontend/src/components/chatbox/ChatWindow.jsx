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
    // Auto-grow up to ~7 lines (was ~4) so longer messages don't feel cramped.
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";

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

    // Optimistic render — show the message in the sender's own thread
    // immediately so the chat feels responsive, even before the WS echo
    // round-trips back. Field names match what MessagerList / MessagerBubble
    // expect (from_user, sent_datetime, content) so the bubble renders
    // correctly without special-casing optimistic messages.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date().toISOString();
    const optimisticMessage = {
      message_id: tempId,
      conversation_id: conversationID,
      from_user: currentUserId,
      content: trimmed,
      sent_datetime: sentAt,
      is_encrypted: false,
      _optimistic: true,
    };
    setLocalMessages((prev) => [...prev, optimisticMessage]);
    setText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    }

    setSending(true);
    try {
      setEncryptionError(null);
      // Retry once on transient failures (network blip / 502 / 503) before
      // rolling back the optimistic message — feels much smoother on
      // flaky mobile connections.
      let sent;
      try {
        sent = await chatApi.sendMessage(conversationID, trimmed);
      } catch (firstErr) {
        await new Promise((r) => setTimeout(r, 200));
        sent = await chatApi.sendMessage(conversationID, trimmed);
      }
      // Replace the optimistic placeholder with the server's canonical row
      // so it carries the real message_id (needed for read receipts) and
      // sent_datetime. We keep showing the user's plaintext locally rather
      // than re-decrypting the encrypted payload.
      if (sent && sent.message_id) {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.message_id === tempId
              ? { ...sent, content: trimmed, is_encrypted: false, _optimistic: false }
              : m
          )
        );
      } else {
        setLocalMessages((prev) =>
          prev.map((m) => (m.message_id === tempId ? { ...m, _optimistic: false } : m))
        );
      }
    } catch (err) {
      console.error("Send error:", err);
      // Remove the failed optimistic message and put the text back so the user can retry.
      setLocalMessages((prev) => prev.filter((m) => m.message_id !== tempId));
      setText(trimmed);
      setEncryptionError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // ── Sync messages from parent ──────────────────────────────────────────────

  useEffect(() => {
    // Preserve any optimistic messages still pending — the parent re-fetch
    // might not include them yet if the server is just behind the WS echo.
    setLocalMessages((prev) => {
      const pending = prev.filter((m) => m._optimistic);
      const incoming = messages || [];
      if (pending.length === 0) return incoming;
      const stillPending = pending.filter((p) => {
        const pts = new Date(p.sent_datetime).getTime();
        return !incoming.some((m) => {
          if ((m.from_user || m.sender_id) !== p.from_user) return false;
          const mts = new Date(m.sent_datetime || m.created_at).getTime();
          return Math.abs(mts - pts) < 30_000;
        });
      });
      return [...incoming, ...stillPending];
    });
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
            setEncryptionError("Setting up secure chat — one of your trip-mates will need to open this conversation once.");

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
    let hasConnectedOnce = false;
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
        const wasReconnect = hasConnectedOnce;
        hasConnectedOnce = true;
        retryCount = 0;
        if (currentUserId && lastMessageId) {
          ws.send(JSON.stringify({
            type: "read",
            user_id: currentUserId,
            last_read_message_id: lastMessageId,
          }));
        }

        // Reconnect → refetch messages and merge by message_id. Without this,
        // any messages sent by others while the socket was down stay missing
        // until a full page reload, because the WS only pushes deltas.
        if (wasReconnect) {
          (async () => {
            try {
              const fresh = await chatApi.getMessages(conversationID);
              if (!isActive) return;
              const arr = Array.isArray(fresh) ? fresh : fresh.messages || [];
              setLocalMessages((prev) => {
                const seen = new Set(prev.map((m) => m.message_id).filter(Boolean));
                const merged = prev.slice();
                for (const m of arr) {
                  if (!m?.message_id || seen.has(m.message_id)) continue;
                  merged.push(m);
                  seen.add(m.message_id);
                }
                merged.sort((a, b) => {
                  const at = new Date(a.sent_datetime || a.created_at || 0).getTime();
                  const bt = new Date(b.sent_datetime || b.created_at || 0).getTime();
                  return at - bt;
                });
                return merged;
              });
            } catch {
              // Best-effort refetch; the next WS push will eventually catch us up.
            }
          })();
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
              // Already have it (e.g. server returned it from the POST response)
              if (prev.some((m) => m.message_id === msg.message_id)) return prev;
              // Race: WS echo can land before the API response replaces the
              // optimistic placeholder. The encrypted ciphertext won't match
              // the plaintext we stored locally, so dedupe by sender + a tight
              // recency window instead. Keep the local plaintext content so
              // the user doesn't see their own message rendered as ciphertext.
              const senderField = msg.from_user || msg.sender_id;
              const ts = new Date(msg.sent_datetime || msg.created_at || Date.now()).getTime();
              const optimisticIdx = prev.findIndex((m) => {
                if (!m._optimistic) return false;
                if (m.from_user !== senderField) return false;
                const mts = new Date(m.sent_datetime).getTime();
                return Math.abs(ts - mts) < 30_000;
              });
              if (optimisticIdx !== -1) {
                const next = prev.slice();
                const optimistic = next[optimisticIdx];
                next[optimisticIdx] = {
                  ...msg,
                  content: optimistic.content,
                  is_encrypted: false,
                  _optimistic: false,
                };
                return next;
              }
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
        // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max, plus a
        // ±15% jitter so a whole group of clients doesn't reconnect in
        // lockstep when the backend restarts.
        const base = Math.min(1000 * Math.pow(2, retryCount), 30000);
        const delay = Math.round(base * (0.85 + Math.random() * 0.3));
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
  // Only auto-scroll when the user is already near the bottom (within ~120 px)
  // or when the conversation just opened. Prevents the list from yanking the
  // viewport away while the user is reading older messages, and avoids the
  // flicker that happened on slow networks during initial paginated load.
  const justOpenedRef = useRef(true);
  useEffect(() => {
    justOpenedRef.current = true;
  }, [conversationID]);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    if (justOpenedRef.current || isNearBottom) {
      el.scrollTop = el.scrollHeight;
      justOpenedRef.current = false;
    }
  }, [localMessages?.length]);

  // ── Keyboard awareness — keep the composer pinned above the on-screen
  //    keyboard on mobile. visualViewport.height shrinks when the keyboard
  //    opens; we offset the wrapping container by the inverse so the input
  //    bar never gets covered by the keyboard.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

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

      <div
        className="flex flex-col h-full"
        style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
      >

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

        {/* Inline encryption-setup banner — friendlier than relying on the
            lock-icon tooltip alone. Shown only when `encryptionError` is
            set; the small spinner reads as "still working" instead of
            "stuck". When the error is the "waiting for a trip-mate" state
            we also enumerate which members can unlock the chat and give
            the user a one-tap way to copy an invite message — otherwise
            the user has no idea who they're waiting on. */}
        {encryptionError && !loading && !error && (() => {
          const isWaitingForPeer = /trip-mate|trip mate|another member/i.test(encryptionError);
          const others = (members || []).filter((u) => u.id !== currentUserId);
          const otherNames = others.map((u) => u.username || u.email || "trip-mate");
          const copyInvite = async () => {
            const text = `Hey — can you open the TravelerHub chat on your phone once? It needs another device online to finish setting up encryption. Thanks!`;
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              // Clipboard API unavailable (e.g. non-HTTPS preview build) — silently no-op.
            }
          };
          return (
            <div
              className="shrink-0 px-4 py-2 text-xs"
              style={{
                background: "rgba(200,169,110,0.10)",
                borderBottom: "1px solid rgba(200,169,110,0.25)",
                color: "#7c5e1a",
              }}
              role="status"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                  style={{ borderColor: "#c8a96e", borderTopColor: "transparent" }}
                />
                <span className="leading-snug">{encryptionError}</span>
              </div>

              {isWaitingForPeer && otherNames.length > 0 && (
                <div className="mt-1.5 ml-5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="opacity-70">Waiting on:</span>
                  {otherNames.slice(0, 4).map((n) => (
                    <span
                      key={n}
                      className="px-1.5 py-0.5 rounded-md font-medium"
                      style={{ background: "rgba(200,169,110,0.18)" }}
                    >
                      {n}
                    </span>
                  ))}
                  {otherNames.length > 4 && (
                    <span className="opacity-70">+{otherNames.length - 4} more</span>
                  )}
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="ml-auto px-2 py-1 rounded-md text-[11px] font-semibold transition hover:bg-white/40"
                    style={{ border: "1px solid rgba(200,169,110,0.5)", color: "#7c5e1a" }}
                  >
                    Copy a "please open the app" message
                  </button>
                </div>
              )}
            </div>
          );
        })()}

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
            placeholder="Message"
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none transition focus:ring-2 leading-relaxed"
            style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              color: "#160f29",
              "--tw-ring-color": "#183a37",
              minHeight: "40px",
              maxHeight: "180px",
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
