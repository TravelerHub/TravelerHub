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

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteAccount = () => {
    // For now, just navigate to home
    // Later: call backend to delete account
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            ← Back
          </button>
        </div>

        <div className="space-y-6">
          {/* Notifications Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Notifications</h2>
            <p className="text-gray-500 text-sm mb-5">Manage how you receive updates</p>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <span className="text-gray-700 font-medium">Trip Reminders</span>
                  <p className="text-gray-400 text-sm">Get notified about upcoming trips</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={notifications.tripReminders}
                    onChange={(e) => setNotifications({ ...notifications, tripReminders: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>

              <div className="border-t border-gray-100"></div>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <span className="text-gray-700 font-medium">Finance Updates</span>
                  <p className="text-gray-400 text-sm">Expense and payment notifications</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={notifications.financeUpdates}
                    onChange={(e) => setNotifications({ ...notifications, financeUpdates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>

              <div className="border-t border-gray-100"></div>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <span className="text-gray-700 font-medium">Vote Results</span>
                  <p className="text-gray-400 text-sm">Get notified when voting ends</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={notifications.voteResults}
                    onChange={(e) => setNotifications({ ...notifications, voteResults: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Privacy</h2>
            <p className="text-gray-500 text-sm mb-5">Control your privacy settings</p>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 font-medium">Location Sharing</span>
                <p className="text-gray-400 text-sm">Share location with trip members</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={locationSharing}
                  onChange={(e) => setLocationSharing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
            </label>
          </div>

          {/* Account Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Account</h2>
            <p className="text-gray-500 text-sm mb-5">Manage your account</p>

            <div className="space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition"
              >
                Log Out
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full bg-red-50 text-red-600 py-3 rounded-lg hover:bg-red-100 font-medium transition"
              >
                Delete Account
              </button>
            </div>
          </div>

          {/* Link to Profile */}
          <div className="text-center">
            <button
              onClick={() => navigate("/profile")}
              className="text-gray-500 hover:text-blue-600 text-sm transition"
            >
              Go to Profile →
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Account?</h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. All your data, trips, and settings will be permanently deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;