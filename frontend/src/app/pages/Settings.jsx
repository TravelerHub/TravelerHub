import { useState } from "react";

function Settings() {
  // Mock user data
  const [user, setUser] = useState({
    username: "johndoe",
    email: "john@example.com",
    phone: "555-123-4567",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user);

  // Settings toggles
  const [notifications, setNotifications] = useState({
    tripReminders: true,
    financeUpdates: false,
    voteResults: true,
  });

  const [locationSharing, setLocationSharing] = useState(false);

  const handleSave = () => {
    setUser(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(user);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6 max-w-md">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Profile Info</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-gray-500 text-sm block mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="text-gray-500 text-sm block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="text-gray-500 text-sm block mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 text-sm">Username</span>
                <p className="text-gray-900">{user.username}</p>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Email</span>
                <p className="text-gray-900">{user.email}</p>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Phone</span>
                <p className="text-gray-900">{user.phone}</p>
              </div>
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}

export default Settings;