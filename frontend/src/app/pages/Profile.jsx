import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Profile() {
    const navigate = useNavigate();
    // Load user from localStorage (saved during login)
    const getStoredUser = () => {
    const stored = localStorage.getItem("user");
    if (stored) {
        const parsed = JSON.parse(stored);
        return {
        username: parsed.username || "",
        email: parsed.email || "",
        // phone: parsed.phone || "",
        };
    }
    // return { username: "", email: "", phone: "" };
    return { username: "", email: "" };
    };

    const [user, setUser] = useState(getStoredUser);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(user);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
        const token = localStorage.getItem("token");
        
        const response = await fetch("http://localhost:8000/users/me", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
        });

        if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setFormData(updatedUser);
        // Update localStorage too
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setIsEditing(false);
        } else {
        const data = await response.json();
        setError(data.detail || "Failed to save changes");
        }
    } catch (err) {
        console.error("Save error:", err);
        setError("Cannot connect to server");
    } finally {
        setSaving(false);
    }
    };

    const handleCancel = () => {
        setFormData(user);
        setIsEditing(false);
    };

    // Get initials for avatar
    const getInitials = (name) => {
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <button
                onClick={() => navigate("/dashboard")}
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
            >
                ← Back
            </button>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Avatar Section */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-center">
                <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-md">
                <span className="text-2xl font-bold text-blue-600">
                    {getInitials(user.username)}
                </span>
                </div>
                <h2 className="text-white text-xl font-semibold mt-4">{user.username}</h2>
                <p className="text-blue-100 text-sm">{user.email}</p>
            </div>

            {/* Info Section */}
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Profile Details</h3>
                {!isEditing && (
                    <button
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition"
                    >
                    Edit
                    </button>
                )}
                </div>

                {isEditing ? (
                <div className="space-y-5">
                    <div>
                    <label className="text-gray-600 text-sm font-medium block mb-2">
                        Username
                    </label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    </div>

                    <div>
                    <label className="text-gray-600 text-sm font-medium block mb-2">
                        Email
                    </label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    </div>

                    {/* <div>
                    <label className="text-gray-600 text-sm font-medium block mb-2">
                        Phone
                    </label>
                    <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                    </div> */}

                    <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-blue-400"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                        onClick={handleCancel}
                        className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 font-medium transition"
                    >
                        Cancel
                    </button>
                    </div>
                    {error && (
                        <p className="text-red-500 text-sm mt-3">{error}</p>
                    )}
                </div>
                ) : (
                <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-500">Username</span>
                    <span className="text-gray-900 font-medium">{user.username}</span>
                    </div>

                    <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900 font-medium">{user.email}</span>
                    </div>

                    {/* <div className="flex justify-between py-3">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-900 font-medium">{user.phone}</span>
                    </div> */}
                </div>
                )}
            </div>
            </div>

            {/* Link to Settings */}
            <div className="mt-6 text-center">
            <button
                onClick={() => navigate("/settings")}
                className="text-gray-500 hover:text-blue-600 text-sm transition"
            >
                Go to Settings →
            </button>
            </div>
        </div>
        </div>
    );
    }

export default Profile;