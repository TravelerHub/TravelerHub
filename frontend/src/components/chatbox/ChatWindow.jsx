import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Avatar, EmptyState } from "./ui";
import MessageList from "./MessagerList";
import { chatApi } from "./chatAPI";
import { encryptionUtils } from "../../lib/encryption";
import { PaperAirplaneIcon, PhotoIcon, XMarkIcon, MicrophoneIcon, StopIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import { API_BASE } from "../../config.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_BYTES = 15 * 1024 * 1024;
const MAX_VOICE_SECONDS = 180;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

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

// ── Read receipt avatar dots ─────────────────────────────────────────────────
function ReadReceipts({ readers, members }) {
  if (!readers || readers.length === 0) return null;

  const MAX_SHOWN = 3;
  const shown = readers.slice(0, MAX_SHOWN);
  const extra = readers.length - MAX_SHOWN;

  const getInitials = (userId) => {
    const member = members?.find((m) => m.id === userId);
    const name = member?.username || member?.email || userId || "?";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center gap-0.5 justify-end mt-0.5 pr-1">
      {shown.map((uid) => (
        <span
          key={uid}
          title={members?.find((m) => m.id === uid)?.username || uid}
          className="flex items-center justify-center rounded-full text-[7px] font-bold shrink-0"
          style={{
            width: "16px",
            height: "16px",
            background: "#183a37",
            color: "#ffffff",
            fontSize: "7px",
          }}
        >
          {getInitials(uid)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: "16px",
            height: "16px",
            background: "#e5e7eb",
            color: "#6b7280",
            fontSize: "7px",
            fontWeight: 700,
          }}
        >
          +{extra}
        </span>
      )}
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
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const wsRef        = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const voiceSecondsRef = useRef(0);
  const typingTimerRef = useRef(null);
  const isTypingRef  = useRef(false);

  const [text,            setText]            = useState("");
  const [localMessages,   setLocalMessages]   = useState(messages || []);
  const [encryptionError, setEncryptionError] = useState(null);
  const [sendError,       setSendError]       = useState("");
  const [sending,         setSending]         = useState(false);
  const [selectedImage,   setSelectedImage]   = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [selectedVoiceNote, setSelectedVoiceNote] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [voiceDurationSec, setVoiceDurationSec] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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

  const clearImageSelection = useCallback(() => {
    setSelectedImage(null);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearVideoSelection = useCallback(() => {
    setSelectedVideo(null);
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    if (videoInputRef.current) videoInputRef.current.value = "";
  }, []);

  const clearVoiceSelection = useCallback(() => {
    setSelectedVoiceNote(null);
    setVoiceDurationSec(0);
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, []);

  const stopVoiceRecording = useCallback(() => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (sending) return;

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSendError("Voice recording is not supported in this browser");
      return;
    }

    try {
      setSendError("");
      sendTypingStop();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      clearImageSelection();
      clearVideoSelection();
      clearVoiceSelection();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];

      let selectedMimeType = "";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        selectedMimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      const chunks = [];
      voiceRecorderRef.current = recorder;
      voiceSecondsRef.current = 0;
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        setSendError("Failed to record voicemail");
      };

      recorder.onstop = () => {
        setIsRecording(false);

        if (voiceTimerRef.current) {
          clearInterval(voiceTimerRef.current);
          voiceTimerRef.current = null;
        }

        const activeStream = voiceStreamRef.current;
        if (activeStream) {
          activeStream.getTracks().forEach((track) => track.stop());
          voiceStreamRef.current = null;
        }

        if (!chunks.length) return;

        const blobType = recorder.mimeType || chunks[0].type || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });

        if (blob.size > MAX_VOICE_BYTES) {
          setSendError("Voice message is too large (max 15MB)");
          return;
        }

        const extension =
          blobType.includes("mp4") ? "mp4" :
          blobType.includes("mpeg") ? "mp3" :
          blobType.includes("wav") ? "wav" :
          blobType.includes("ogg") ? "ogg" :
          "webm";

        const file = new File([blob], `voicemail_${Date.now()}.${extension}`, { type: blobType });

        setSelectedVoiceNote(file);
        setVoiceDurationSec(Math.max(voiceSecondsRef.current, 1));
        setVoicePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      };

      recorder.start(250);

      voiceTimerRef.current = setInterval(() => {
        voiceSecondsRef.current += 1;
        setRecordingSeconds(voiceSecondsRef.current);

        if (voiceSecondsRef.current >= MAX_VOICE_SECONDS) {
          stopVoiceRecording();
        }
      }, 1000);
    } catch {
      const activeStream = voiceStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
      }
      setIsRecording(false);
      setSendError("Microphone access failed. Please allow mic permission and try again.");
    }
  }, [clearImageSelection, clearVideoSelection, clearVoiceSelection, sendTypingStop, sending, stopVoiceRecording]);

  const handleImagePick = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSendError("Only image files can be attached");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setSendError("Image is too large (max 8MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSendError("");
    clearVideoSelection();
    clearVoiceSelection();
    setSelectedImage(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, [clearVideoSelection, clearVoiceSelection]);

  const handleVideoPick = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const looksLikeVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v|ogg|ogv|mkv|3gp|3g2)$/i.test(file.name || "");

    if (!looksLikeVideo) {
      setSendError("Only video files can be attached");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_VIDEO_BYTES) {
      setSendError("Video is too large (max 40MB)");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    setSendError("");
    clearImageSelection();
    clearVoiceSelection();
    setSelectedVideo(file);
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, [clearImageSelection, clearVoiceSelection]);

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
    const hasImage = Boolean(selectedImage);
    const hasVideo = Boolean(selectedVideo);
    const hasVoice = Boolean(selectedVoiceNote);

    if (isRecording) {
      setSendError("Stop recording before sending your voicemail");
      return;
    }

    if ((!trimmed && !hasImage && !hasVideo && !hasVoice) || sending) return;

    // Cancel any pending typing debounce and stop indicator
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTypingStop();

    setSending(true);
    try {
      setSendError("");
      if (hasVoice) {
        const uploadedVoice = await chatApi.uploadConversationVoicemail(conversationID, selectedVoiceNote);
        await chatApi.sendMessage(conversationID, {
          type: "audio",
          audio_url: uploadedVoice.public_url,
          caption: trimmed,
          duration_sec: voiceDurationSec,
          file_name: uploadedVoice.file_name || selectedVoiceNote.name,
          mime_type: uploadedVoice.content_type || selectedVoiceNote.type,
        });
        clearVoiceSelection();
      } else if (hasVideo) {
        const uploadedVideo = await chatApi.uploadConversationVideo(conversationID, selectedVideo);
        await chatApi.sendMessage(conversationID, {
          type: "video",
          video_url: uploadedVideo.public_url,
          caption: trimmed,
          file_name: uploadedVideo.file_name || selectedVideo.name,
          mime_type: uploadedVideo.content_type || selectedVideo.type,
        });
        clearVideoSelection();
      } else if (hasImage) {
        const uploaded = await chatApi.uploadConversationImage(conversationID, selectedImage);
        await chatApi.sendMessage(conversationID, {
          type: "image",
          image_url: uploaded.public_url,
          caption: trimmed,
          file_name: uploaded.file_name || selectedImage.name,
          mime_type: uploaded.content_type || selectedImage.type,
        });
        clearImageSelection();
      } else {
        await chatApi.sendMessage(conversationID, trimmed);
      }

      setText("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.focus();
      }
    } catch (err) {
      console.error("Send error:", err);
      setSendError(err.message || "Failed to send");
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

      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }

      const recorder = voiceRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      const activeStream = voiceStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
      }
    };
  }, [conversationID]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl);
    };
  }, [voicePreviewUrl]);

  useEffect(() => {
    setSendError("");
    clearImageSelection();
    clearVideoSelection();
    clearVoiceSelection();
    setRecordingSeconds(0);
    setIsRecording(false);
  }, [conversationID, clearImageSelection, clearVideoSelection, clearVoiceSelection]);

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
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/ws/conversations/${conversationID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // On (re)connect send our current read position so peers see it
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
        // Regular chat message
        const msg = data;
        if (msg.message_id) {
          setLocalMessages((prev) => {
            if (prev.some((m) => m.message_id === msg.message_id)) return prev;
            return [...prev, msg];
          });
        }
      }
    };

    ws.onerror  = (e) => { if (isActive) console.error("WebSocket error:", e); };
    ws.onclose  = ()  => { if (isActive) console.log("WebSocket closed"); };
    const ping  = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 25000);

    return () => {
      isActive = false;
      clearInterval(ping);
      wsRef.current = null;
      ws.close();
      // Clear typing state when leaving conversation
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
              members={members}
              readStatus={readStatus}
            />
          )}

          {/* Typing indicator */}
          <TypingIndicator typingUsers={typingUsers} />
        </div>

        {/* ── Input bar ───────────────────────────────────────────────── */}
        {selectedImage && (
          <div
            className="shrink-0 px-4 pt-3"
            style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
          >
            <div
              className="rounded-xl p-2.5 flex items-center gap-2.5"
              style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "#e5e7eb" }}>
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "#111827" }}>
                  {selectedImage.name}
                </p>
                <p className="text-[10px]" style={{ color: "#6b7280" }}>
                  {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <button
                type="button"
                onClick={clearImageSelection}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-black/5"
                aria-label="Remove image"
              >
                <XMarkIcon className="w-4 h-4" style={{ color: "#6b7280" }} />
              </button>
            </div>
          </div>
        )}

        {selectedVideo && (
          <div
            className="shrink-0 px-4 pt-3"
            style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
          >
            <div
              className="rounded-xl p-2.5 flex items-start gap-2.5"
              style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "#111827" }}>
                  {selectedVideo.name}
                </p>
                <p className="text-[10px] mb-1" style={{ color: "#6b7280" }}>
                  {(selectedVideo.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {videoPreviewUrl && (
                  <video
                    controls
                    preload="metadata"
                    src={videoPreviewUrl}
                    className="w-full max-w-[260px] rounded-lg"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={clearVideoSelection}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-black/5"
                aria-label="Remove video"
              >
                <XMarkIcon className="w-4 h-4" style={{ color: "#6b7280" }} />
              </button>
            </div>
          </div>
        )}

        {selectedVoiceNote && (
          <div
            className="shrink-0 px-4 pt-3"
            style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
          >
            <div
              className="rounded-xl p-2.5 flex items-center gap-2.5"
              style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "#111827" }}>
                  {selectedVoiceNote.name}
                </p>
                <p className="text-[10px] mb-1" style={{ color: "#6b7280" }}>
                  Voicemail {voiceDurationSec ? `• ${formatDuration(voiceDurationSec)}` : ""}
                </p>
                {voicePreviewUrl && (
                  <audio
                    controls
                    preload="metadata"
                    src={voicePreviewUrl}
                    className="w-full max-w-[260px] h-9"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={clearVoiceSelection}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-black/5"
                aria-label="Remove voicemail"
              >
                <XMarkIcon className="w-4 h-4" style={{ color: "#6b7280" }} />
              </button>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="shrink-0 px-4 pt-2" style={{ background: "#ffffff" }}>
            <p className="text-xs font-semibold" style={{ color: "#dc2626" }}>
              Recording voicemail: {formatDuration(recordingSeconds)}
            </p>
          </div>
        )}

        {sendError && (
          <div className="shrink-0 px-4 pt-2" style={{ background: "#ffffff" }}>
            <p className="text-xs" style={{ color: "#dc2626" }}>
              {sendError}
            </p>
          </div>
        )}

        <div
          className="shrink-0 px-4 py-3 flex items-end gap-2"
          style={{ borderTop: "1px solid #ebebeb", background: "#ffffff" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*,.mov,.m4v,.mkv,.3gp,.3g2"
            onChange={handleVideoPick}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition active:scale-95"
            style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            aria-label="Attach image"
            disabled={sending || isRecording}
          >
            <PhotoIcon className="w-5 h-5" style={{ color: "#374151" }} />
          </button>

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition active:scale-95"
            style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
            aria-label="Attach video"
            disabled={sending || isRecording}
          >
            <VideoCameraIcon className="w-5 h-5" style={{ color: "#374151" }} />
          </button>

          <button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition active:scale-95"
            style={{
              background: isRecording ? "#fee2e2" : "#f3f4f6",
              border: `1px solid ${isRecording ? "#fecaca" : "#e5e7eb"}`,
            }}
            aria-label={isRecording ? "Stop recording" : "Record voicemail"}
            disabled={sending}
          >
            {isRecording ? (
              <StopIcon className="w-5 h-5" style={{ color: "#dc2626" }} />
            ) : (
              <MicrophoneIcon className="w-5 h-5" style={{ color: "#374151" }} />
            )}
          </button>

          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={isRecording ? "Recording voicemail..." : "Type a message, attach image/video, or record voicemail..."}
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
            disabled={sending || isRecording}
          />
          <button
            onClick={sendMessage}
            disabled={(!text.trim() && !selectedImage && !selectedVideo && !selectedVoiceNote) || sending || isRecording}
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
