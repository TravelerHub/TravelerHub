import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TravelPreferences from "../../components/TravelPreferences";

function Settings() {
  const navigate = useNavigate();

  // Settings toggles
  const [notifications, setNotifications] = useState({
    tripReminders: true,
    financeUpdates: false,
    voteResults: true,
  });

  const [locationSharing, setLocationSharing] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    setPasswordSaving(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:8000/users/me/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess("Password changed successfully!");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setShowPasswordForm(false);
      } else {
        setPasswordError(data.detail || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change error:", err);
      setPasswordError("Cannot connect to server");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    navigate("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className=" w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between ">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Settings</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            ← Back
          </button>
        </div>

        <div className="space-y-6">

          {/* ✅ Travel Preferences Section */}
          <TravelPreferences />

          {/* Notifications Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
            <p className="text-gray-500 text-sm">Manage how you receive updates</p>

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

          {/* Security Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Security</h2>
            <p className="text-gray-500 text-sm mb-5">Manage your password</p>

            {passwordSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {passwordSuccess}
              </div>
            )}

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>

                {passwordError && (
                  <p className="text-red-500 text-sm">{passwordError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handlePasswordChange}
                    disabled={passwordSaving}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-blue-400"
                  >
                    {passwordSaving ? "Saving..." : "Update Password"}
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                      setPasswordError("");
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Account Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Account</h2>
            <p className="text-gray-500 text-sm mb-5">Manage your account</p>

            <div className="space-y-3">
              <button
                onClick={handleLogout}
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