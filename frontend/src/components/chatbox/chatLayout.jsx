import { useEffect, useMemo, useState } from "react";
import { chatApi } from "./chatAPI";
import { EmptyState, Panel } from "./ui";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";

/**
 * Props:
 * - currentUser: { id, username, email, ... }
 */
export default function ChatLayout({ currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // cache members/messages per conversation to avoid refetch spam
  const [membersByConversation, setMembersByConversation] = useState({});
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [loadingLeft, setLoadingLeft] = useState(true);
  const [loadingRight, setLoadingRight] = useState(false);
  const [error, setError] = useState("");

  // Load conversation list
  useEffect(() => {
    if (!currentUser?.id) return;
    let alive = true;

    (async () => {
      try {
        setLoadingLeft(true);
        setError("");
        const data = await chatApi.getConversations({ userId: currentUser.id });
        if (!alive) return;
        setConversations(Array.isArray(data) ? data : data.conversations || []);
        // auto-select first conversation if none selected
        const firstId = (Array.isArray(data) ? data : data.conversations || [])?.[0]?.conversation_id;
        setSelectedId((prev) => prev ?? firstId ?? null);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load conversations");
      } finally {
        if (alive) setLoadingLeft(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [currentUser?.id]);

  // When selected conversation changes, load members + messages
  useEffect(() => {
    if (!selectedId) return;

    let alive = true;

    (async () => {
      try {
        setLoadingRight(true);
        setError("");

        // load members if missing
        if (!membersByConversation[selectedId]) {
          const members = await chatApi.getMembers(selectedId);
          if (!alive) return;
          setMembersByConversation((prev) => ({
            ...prev,
            [selectedId]: normalizeUsers(members),
          }));
        }

        // load messages if missing
        if (!messagesByConversation[selectedId]) {
          const msgs = await chatApi.getMessages(selectedId);
          if (!alive) return;
          setMessagesByConversation((prev) => ({
            ...prev,
            [selectedId]: Array.isArray(msgs) ? msgs : msgs.messages || [],
          }));
        }
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load conversation");
      } finally {
        if (alive) setLoadingRight(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedId]); // intentionally not depending on caches to avoid loops

  const selectedMembers = membersByConversation[selectedId] || [];
  const selectedMessages = messagesByConversation[selectedId] || [];

  // Create a nice display name: all other users in conversation (excluding me)
  const conversationTitle = useMemo(() => {
    if (!selectedId) return "";
    const others = selectedMembers.filter((u) => u.id !== currentUser?.id);
    if (others.length === 0) return "Just you";
    return others.map((u) => u.username || u.email || u.id).join(", ");
  }, [selectedId, selectedMembers, currentUser?.id]);

  return (
    <div className="h-[calc(100vh-64px)] w-full grid grid-cols-12 gap-4">
      {/* Left */}
      <Panel className="col-span-4 lg:col-span-3 h-full overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <div className="font-semibold text-gray-800">Conversations</div>
          <div className="text-xs text-gray-500">Pick a chat to view messages</div>
        </div>

        <div className="flex-1 overflow-auto">
          <ConversationList
            loading={loadingLeft}
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            currentUserId={currentUser?.id}
            membersByConversation={membersByConversation}
          />
        </div>
      </Panel>

      {/* Right */}
      <Panel className="col-span-8 lg:col-span-9 h-full overflow-hidden flex flex-col">
        {!selectedId ? (
          <EmptyState
            title="No conversation selected"
            subtitle="Select one from the left to start."
          />
        ) : (
          <ChatWindow
            loading={loadingRight}
            title={conversationTitle}
            currentUserId={currentUser?.id}
            members={selectedMembers}
            messages={selectedMessages}
            error={error}
            conversationID={selectedId}
          />
        )}
      </Panel>

      {error && (
        <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// Ensures no duplicates + consistent shape
function normalizeUsers(input) {
  const arr = Array.isArray(input) ? input : input.members || [];
  const map = new Map();
  for (const u of arr) {
    if (!u?.id) continue;
    map.set(u.id, u);
  }
  return [...map.values()];
}
