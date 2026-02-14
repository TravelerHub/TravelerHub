import ChatLayout from "../../components/chatbox/chatLayout";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from 'react-router-dom';

// Import Heroicons
import {
  ChatBubbleLeftRightIcon  
} from '@heroicons/react/24/outline';

export default function MessagesPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user) return <div className="p-6">Please log in.</div>;

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
    <div className="p-4">
      <ChatLayout currentUser={user} />
    </div>
  </div>
  );
}
