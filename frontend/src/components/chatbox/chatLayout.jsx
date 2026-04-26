import { useEffect, useMemo, useState } from "react";
import { chatApi } from "./chatAPI";
import { EmptyState, Panel } from "./ui";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";

export default function ChatLayout({ currentUser, onNewChat, tripId }) {
  const [conversations,         setConversations]         = useState([]);
  const [selectedId,            setSelectedId]            = useState(null);
  const [membersByConversation, setMembersByConversation] = useState({});
  const [messagesByConversation,setMessagesByConversation]= useState({});
  const [loadingLeft,           setLoadingLeft]           = useState(true);
  const [loadingRight,          setLoadingRight]          = useState(false);
  const [error,                 setError]                 = useState("");

  // Load conversation list
  useEffect(() => {
    if (!currentUser?.id) return;
    let alive = true;
    (async () => {
      try {
        setLoadingLeft(true);
        setError("");
        const data = await chatApi.getConversations(tripId || null);
        if (!alive) return;
        const list = Array.isArray(data) ? data : data.conversations || [];
        setConversations(list);
        setSelectedId((prev) => prev ?? list[0]?.conversation_id ?? null);
      } catch (e) {
        if (alive) setError(e.message || "Failed to load conversations");
      } finally {
        if (alive) setLoadingLeft(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser?.id, tripId]);

  // Load members + messages when conversation selected
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    (async () => {
      try {
        setLoadingRight(true);
        setError("");
        if (!membersByConversation[selectedId]) {
          const members = await chatApi.getMembers(selectedId);
          if (!alive) return;
          setMembersByConversation((prev) => ({ ...prev, [selectedId]: normalizeUsers(members) }));
        }
        if (!messagesByConversation[selectedId]) {
          const msgs = await chatApi.getMessages(selectedId);
          if (!alive) return;
          setMessagesByConversation((prev) => ({
            ...prev,
            [selectedId]: Array.isArray(msgs) ? msgs : msgs.messages || [],
          }));
        }
      } catch (e) {
        if (alive) setError(e.message || "Failed to load conversation");
      } finally {
        if (alive) setLoadingRight(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedId]);

  const selectedMembers  = membersByConversation[selectedId]  || [];
  const selectedMessages = messagesByConversation[selectedId] || [];

  const conversationTitle = useMemo(() => {
    if (!selectedId) return "";
    const others = selectedMembers.filter((u) => u.id !== currentUser?.id);
    if (others.length === 0) return "Just you";
    return others.map((u) => u.username || u.email || u.id).join(", ");
  }, [selectedId, selectedMembers, currentUser?.id]);

  // Find the full name of selected conversation (may have a conversation_name)
  const selectedConv = conversations.find(
    (c) => (c.conversation_id ?? c.id) === selectedId
  );
  const displayTitle = selectedConv?.conversation_name?.trim() || conversationTitle;

  // On mobile, show conversation list when no conversation selected,
  // and switch to chat window when one is picked. On md+, show side-by-side.
  return (
    <div className="h-full flex gap-3">

      {/* ── Conversation list panel ──────────────────────────────────── */}
      <Panel
        className={`w-full md:w-64 md:shrink-0 flex-col ${selectedId ? "hidden md:flex" : "flex"}`}
      >
        {/* Header */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #ebebeb" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
            Messages
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ConversationList
            loading={loadingLeft}
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            currentUserId={currentUser?.id}
            membersByConversation={membersByConversation}
            onNewChat={onNewChat}
          />
        </div>
      </Panel>

      {/* ── Chat window panel ────────────────────────────────────────── */}
      <Panel
        className={`flex-1 flex-col min-w-0 ${selectedId ? "flex" : "hidden md:flex"}`}
      >
        {!selectedId ? (
          <EmptyState
            title="Select a conversation"
            subtitle="Choose one from the left to start chatting."
          />
        ) : (
          <>
            {/* Mobile: back button to return to conversation list */}
            <button
              onClick={() => setSelectedId(null)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b shrink-0"
              style={{ color: "#160f29", borderColor: "#ebebeb" }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Conversations
            </button>
            <ChatWindow
              loading={loadingRight}
              title={displayTitle}
              currentUserId={currentUser?.id}
              members={selectedMembers}
              messages={selectedMessages}
              error={error}
              conversationID={selectedId}
            />
          </>
        )}
      </Panel>

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium z-50"
          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function normalizeUsers(input) {
  const arr = Array.isArray(input) ? input : input.members || [];
  const map = new Map();
  for (const u of arr) {
    if (!u?.id) continue;
    map.set(u.id, u);
  }
  return [...map.values()];
}
