import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
  const navigate = useNavigate();

  // Mock user data
  const [user, setUser] = useState({
    username: "johndoe",
    email: "john@example.com",
    phone: "555-123-4567",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user);

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
      <div className="max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Profile Card */}
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

        {/* Link to Settings */}
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate("/settings")}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Go to Settings →
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;