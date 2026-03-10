import ChatLayout from "../../components/chatbox/chatLayout";
import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { chatApi } from "../../components/chatbox/chatAPI";

// Import Heroicons
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Message() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!user) return <div className="p-6">Please log in.</div>;

  // Fetch available users for adding to new conversation
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/users/", {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
          }
        });
        if (response.ok) {
          const users = await response.json();
          console.log("Users fetched:", users);
          // Filter out current user from available users
          setAvailableUsers(users.filter(u => u.id !== user.id));
        } else {
          console.error("Failed to fetch users, status:", response.status);
          const errorText = await response.text();
          console.error("Error response:", errorText);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, [user?.id]);

  const handleCreateConversation = async () => {
    if (!conversationName.trim()) {
      setError("Conversation name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        conversation_name: conversationName,
        members: selectedMembers
      };

      console.log("Creating conversation with payload:", payload);

      const newConversation = await chatApi.createConversation(payload);
      console.log("Conversation created successfully:", newConversation);

      // Reset form
      setConversationName("");
      setSelectedMembers([]);
      setShowCreateModal(false);

      // Trigger refresh in ChatLayout by changing the key
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error creating conversation:", err);
      setError(err.message || "Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (userId) => {
    setSelectedMembers(prev => {
      const updated = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      console.log("Selected members updated:", updated);
      return updated;
    });
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
              Messages
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <PlusIcon className="w-5 h-5" />
            New Chat
          </button>
        </div>
      </div>

      {/* Main Chat Layout */}
      <div className="p-4">
        <ChatLayout key={refreshTrigger} currentUser={user} />
      </div>

      {/* Create Conversation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Chat</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError("");
                  setConversationName("");
                  setSelectedMembers([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                  {error}
                </div>
              )}

              {/* Conversation Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conversation Name
                </label>
                <input
                  type="text"
                  value={conversationName}
                  onChange={(e) => setConversationName(e.target.value)}
                  placeholder="e.g., Trip to Paris"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Members Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Members (Optional)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {availableUsers.length > 0 ? (
                    availableUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(u.id)}
                          onChange={() => toggleMemberSelection(u.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {u.username || u.email}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {u.email}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No other users available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError("");
                  setConversationName("");
                  setSelectedMembers([]);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
