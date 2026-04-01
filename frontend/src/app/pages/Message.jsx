import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatApi } from "../../components/chatbox/chatAPI";
import ChatLayout from "../../components/chatbox/chatLayout";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import { API_BASE } from "../../config";
import { ensureActiveGroupId, getActiveGroupId, getMyGroups, setActiveGroupId } from "../../services/groupService";

export default function Message() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [availableUsers,   setAvailableUsers]   = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");
  const [refreshTrigger,   setRefreshTrigger]   = useState(0);
  const [groups,           setGroups]           = useState([]);
  const [activeGroupId,    setActiveGroupIdState] = useState("");

  const displayName = user?.username || user?.name || "Traveler";

  if (!user) return <div className="p-6 text-sm text-gray-500">Please log in.</div>;

  useEffect(() => {
    const bootGroupContext = async () => {
      try {
        const allGroups = await getMyGroups();
        setGroups(allGroups);

        let groupId = getActiveGroupId();
        const found = allGroups.some((g) => String(g.group_id || g.id) === String(groupId));
        if (!found) {
          groupId = await ensureActiveGroupId();
        }
        setActiveGroupIdState(groupId || "");
      } catch (err) {
        console.error("Failed to load groups:", err);
        setGroups([]);
      }
    };
    bootGroupContext();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!activeGroupId) {
        setAvailableUsers([]);
        return;
      }

      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch(`${API_BASE}/groups/${activeGroupId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const members = await res.json();
          const others = members
            .filter((m) => m.user_id !== user.id)
            .map((m) => ({ id: m.user_id, username: m.username, email: m.email }));
          setAvailableUsers(others);
        }
      } catch (err) {
        console.error("Failed to fetch group members:", err);
      }
    };
    fetchUsers();
  }, [activeGroupId, user?.id]);

  const handleCreateConversation = async () => {
    if (!conversationName.trim()) { setError("Conversation name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const conversation = await chatApi.createConversation({
        conversation_name: conversationName,
        members: selectedMembers,
        trip_id: activeGroupId || null,
      });

      // Distribute session key to all members client-side.
      // allMemberIds = selected members + the creator (current user).
      const allMemberIds = [...new Set([...selectedMembers, user.id])];
      try {
        await chatApi.setupConversationEncryption(conversation.conversation_id, allMemberIds);
      } catch (err) {
        console.error("Encryption setup failed:", err);
        // Non-fatal: chat still works, but messages won't be encrypted until keys are set up
      }

      setConversationName("");
      setSelectedMembers([]);
      setShowCreateModal(false);
      setRefreshTrigger((n) => n + 1);
    } catch (err) {
      setError(err.message || "Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setError("");
    setConversationName("");
    setSelectedMembers([]);
  };

  const toggleMember = (id) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ══ SIDEBAR ════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>

        {/* Greeting */}
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>
            Hi,
          </p>
          <p className="font-bold text-lg leading-tight truncate" style={{ color: "#f9fafb" }}>
            {displayName}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive   = item.path === "/message";
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={isDisabled}
                className={`
                  w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition
                  ${isActive ? "font-bold" : isDisabled ? "cursor-not-allowed" : "hover:bg-white/10"}
                `}
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  color:      isActive ? "#000000" : isDisabled ? "#4b5563" : "#9ca3af",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* New trip */}
        <div className="px-3 pb-5">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:bg-gray-700 active:scale-95"
            style={{ background: "#374151", color: "#f9fafb" }}
          >
            + New Trip
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        {/* Chat area */}
        <div className="flex-1 overflow-hidden p-4" style={{ background: "#f3f4f6" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "#6b7280" }}>Group</span>
            <select
              value={activeGroupId}
              onChange={(e) => {
                const value = e.target.value;
                setActiveGroupId(value);
                setActiveGroupIdState(value);
                setRefreshTrigger((n) => n + 1);
              }}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ border: "1px solid #d1d5db", background: "#fff", color: "#111827" }}
            >
              {groups.length === 0 ? (
                <option value="">No groups</option>
              ) : (
                groups.map((group) => {
                  const gid = group.group_id || group.id;
                  return (
                    <option key={gid} value={gid}>
                      {group.name || "Untitled Group"}
                    </option>
                  );
                })
              )}
            </select>
          </div>
          <ChatLayout
            key={refreshTrigger}
            currentUser={user}
            tripId={activeGroupId || undefined}
            onNewChat={() => setShowCreateModal(true)}
          />
        </div>
      </div>

      {/* ══ CREATE CHAT MODAL ════════════════════════════════════════════ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={closeModal}
        >
          <div
            className="rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            style={{ background: "#fbfbf2" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: "#000000" }}>
              <p className="text-sm font-semibold" style={{ color: "#f9fafb" }}>
                New Chat
              </p>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {error && (
                <p className="text-xs px-3 py-2 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
                  {error}
                </p>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                  Conversation Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={conversationName}
                  onChange={(e) => setConversationName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                  placeholder="e.g., Trip to Paris"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition focus:ring-2"
                  style={{
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    color: "#160f29",
                    "--tw-ring-color": "#183a37",
                  }}
                  autoFocus
                />
              </div>

              {/* Members */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                  Add Members
                  {selectedMembers.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
                      style={{ background: "#000", color: "#fff" }}>
                      {selectedMembers.length}
                    </span>
                  )}
                </label>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid #e5e7eb", maxHeight: 180, overflowY: "auto" }}
                >
                  {availableUsers.length === 0 ? (
                    <p className="text-xs text-center py-5" style={{ color: "#9ca3af" }}>
                      No other users available
                    </p>
                  ) : (
                    availableUsers.map((u) => {
                      const isSelected = selectedMembers.includes(u.id);
                      const initials   = (u.username || u.email || "?").slice(0, 2).toUpperCase();
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleMember(u.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 transition text-left"
                          style={{
                            background: isSelected ? "rgba(0,0,0,0.04)" : "transparent",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          {/* Avatar */}
                          <span
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: "#183a37" }}
                          >
                            {initials}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: "#160f29" }}>
                              {u.username || u.email}
                            </p>
                            <p className="text-[10px] truncate" style={{ color: "#9ca3af" }}>
                              {u.email}
                            </p>
                          </div>
                          {/* Check */}
                          <span
                            className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition"
                            style={{
                              background: isSelected ? "#000000" : "#f3f4f6",
                              border: isSelected ? "none" : "1px solid #e5e7eb",
                            }}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 active:scale-95 disabled:opacity-50"
                style={{ background: "#000000", color: "#f9fafb" }}
              >
                {loading ? "Creating…" : "Create Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
