import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Settings() {
  const navigate = useNavigate();

  // Settings toggles
  const [notifications, setNotifications] = useState({
    tripReminders: true,
    financeUpdates: false,
    voteResults: true,
  });

  const [locationSharing, setLocationSharing] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="space-y-6">
          {/* Notifications Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-700">Trip Reminders</span>
                <input
                  type="checkbox"
                  checked={notifications.tripReminders}
                  onChange={(e) => setNotifications({ ...notifications, tripReminders: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-700">Finance Updates</span>
                <input
                  type="checkbox"
                  checked={notifications.financeUpdates}
                  onChange={(e) => setNotifications({ ...notifications, financeUpdates: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-gray-700">Vote Results</span>
                <input
                  type="checkbox"
                  checked={notifications.voteResults}
                  onChange={(e) => setNotifications({ ...notifications, voteResults: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Privacy</h2>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Share my location with trip members</span>
              <input
                type="checkbox"
                checked={locationSharing}
                onChange={(e) => setLocationSharing(e.target.checked)}
                className="w-5 h-5 accent-blue-600"
              />
            </label>
          </div>

          {/* Account Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Account</h2>

            <button
              onClick={() => navigate("/")}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
            >
              Log Out
            </button>
          </div>

          {/* Link to Profile */}
          <div className="text-center">
            <button
              onClick={() => navigate("/profile")}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Go to Profile →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;