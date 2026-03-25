import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from '../../config';
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";
import TravelPreferences from "../../components/TravelPreferences";

function Profile() {
  const navigate = useNavigate();

  // ── Profile state ──────────────────────────────────────────────────────────
  const getStoredUser = () => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        username: parsed.username || "",
        email:    parsed.email    || "",
        street:   parsed.street   || "",
        city:     parsed.city     || "",
        state:    parsed.state    || "",
        zipcode:  parsed.zipcode  || "",
      };
    }
    return { username: "", email: "", street: "", city: "", state: "", zipcode: "" };
  };

  const [user,      setUser]      = useState(getStoredUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData,  setFormData]  = useState(user);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  // ── Settings state ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState({
    tripReminders:  true,
    financeUpdates: false,
    voteResults:    true,
  });
  const [locationSharing,  setLocationSharing]  = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData,     setPasswordData]     = useState({
    currentPassword: "", newPassword: "", confirmPassword: "",
  });
  const [passwordSaving,  setPasswordSaving]  = useState(false);
  const [passwordError,   setPasswordError]   = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("profile");

  const TABS = [
    { id: "profile",       label: "Profile"       },
    { id: "preferences",   label: "Preferences"   },
    { id: "notifications", label: "Notifications" },
    { id: "security",      label: "Security"      },
    { id: "account",       label: "Account"       },
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setFormData(updatedUser);
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
      const response = await fetch(`${API_BASE}/users/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password:     passwordData.newPassword,
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

  const handleDeleteAccount = () => navigate("/");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const hasAddress = user.street || user.city || user.state || user.zipcode;

  // ── Reusable input style ───────────────────────────────────────────────────
  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm outline-none transition";
  const inputStyle = { border: "1px solid #d1d5db", color: "#160f29", background: "#fff" };

  // ── Toggle switch component ────────────────────────────────────────────────
  const Toggle = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div
        className="w-11 h-6 rounded-full transition-colors peer-checked:bg-teal-800"
        style={{ background: checked ? "#183a37" : "#d1d5db" }}
      />
      <div
        className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </label>
  );

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ══ Black sidebar ══════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>

        {/* Avatar + name */}
        <div className="px-5 pt-6 pb-5 shrink-0 border-b" style={{ borderColor: "#374151" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-3"
            style={{ background: "#183a37", color: "#fbfbf2" }}
          >
            {getInitials(user.username)}
          </div>
          <p className="font-bold text-sm leading-tight truncate" style={{ color: "#f9fafb" }}>
            {user.username || "My Account"}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: "#6b7280" }}>
            {user.email}
          </p>
        </div>

        {/* Page nav */}
        <nav className="flex flex-col gap-1 px-3 py-4">
          {SIDEBAR_ITEMS.map((item) => {
            const isDisabled = !item.path;
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${isDisabled ? "cursor-not-allowed" : "hover:bg-white/10"}`}
                style={{ color: isDisabled ? "#4b5563" : "#9ca3af" }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Log out at bottom */}
        <div className="mt-auto px-3 pb-5">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition hover:bg-gray-800"
            style={{ background: "#1f2937", color: "#9ca3af" }}
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* ══ Main column ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto" style={{ background: "#f3f4f6" }}>
          <div className="max-w-2xl mx-auto px-6 py-8">

            {/* ── Hero banner ─────────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "#160f29" }}>
              <div className="px-8 py-7 flex items-center gap-5">
                <div
                  className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ background: "#183a37", color: "#fbfbf2" }}
                >
                  {getInitials(user.username)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold truncate" style={{ color: "#fbfbf2" }}>
                    {user.username || "—"}
                  </h2>
                  <p className="text-sm truncate mt-0.5" style={{ color: "rgba(251,251,242,0.5)" }}>
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Tab pills inside hero */}
              <div
                className="flex px-8 gap-1 pb-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="px-4 py-2.5 text-xs font-semibold transition rounded-t-lg"
                    style={
                      activeTab === tab.id
                        ? { color: "#fbfbf2", borderBottom: "2px solid #fbfbf2" }
                        : { color: "rgba(251,251,242,0.4)", borderBottom: "2px solid transparent" }
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab content ─────────────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
            >

              {/* ── PROFILE tab ── */}
              {activeTab === "profile" && (
                <div className="p-6">
                  {isEditing ? (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold" style={{ color: "#160f29" }}>Edit Profile</h3>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9ca3af" }}>Username</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className={inputClass}
                          style={inputStyle}
                          onFocus={e => e.target.style.borderColor = "#160f29"}
                          onBlur={e => e.target.style.borderColor = "#d1d5db"}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9ca3af" }}>Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={inputClass}
                          style={inputStyle}
                          onFocus={e => e.target.style.borderColor = "#160f29"}
                          onBlur={e => e.target.style.borderColor = "#d1d5db"}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9ca3af" }}>Address</p>
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Street"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = "#160f29"}
                            onBlur={e => e.target.style.borderColor = "#d1d5db"}
                          />
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { placeholder: "City",    field: "city"    },
                              { placeholder: "State",   field: "state"   },
                              { placeholder: "Zipcode", field: "zipcode" },
                            ].map(({ placeholder, field }) => (
                              <input
                                key={field}
                                type="text"
                                placeholder={placeholder}
                                value={formData[field]}
                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                className="px-4 py-2.5 rounded-xl text-sm outline-none transition"
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = "#160f29"}
                                onBlur={e => e.target.style.borderColor = "#d1d5db"}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {error && (
                        <p className="text-sm px-4 py-2.5 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
                          {error}
                        </p>
                      )}

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                          style={saving ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" } : { background: "#160f29", color: "#fbfbf2" }}
                        >
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold" style={{ color: "#160f29" }}>Profile Details</h3>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold transition"
                          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
                          onMouseLeave={e => e.currentTarget.style.background = "#f3f4f6"}
                        >
                          Edit
                        </button>
                      </div>

                      <div className="space-y-1">
                        {[
                          { label: "Username", value: user.username },
                          { label: "Email",    value: user.email    },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9ca3af" }}>{label}</span>
                            <span className="text-sm font-medium" style={{ color: "#160f29" }}>{value || "—"}</span>
                          </div>
                        ))}

                        <div className="pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9ca3af" }}>Address</p>
                          <div className="rounded-xl px-4 py-3" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                            {hasAddress ? (
                              <div className="text-sm space-y-0.5" style={{ color: "#374151" }}>
                                {user.street && <div>{user.street}</div>}
                                <div>
                                  {user.city}{user.city && user.state ? ", " : ""}{user.state} {user.zipcode}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm" style={{ color: "#9ca3af" }}>No address saved yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PREFERENCES tab ── */}
              {activeTab === "preferences" && (
                <div className="p-6">
                  <TravelPreferences />
                </div>
              )}

              {/* ── NOTIFICATIONS tab ── */}
              {activeTab === "notifications" && (
                <div className="p-6 space-y-0">
                  <h3 className="text-sm font-bold mb-5" style={{ color: "#160f29" }}>Notification Preferences</h3>

                  {[
                    { key: "tripReminders",  label: "Trip Reminders",  sub: "Get notified about upcoming trips"      },
                    { key: "financeUpdates", label: "Finance Updates",  sub: "Expense and payment notifications"      },
                    { key: "voteResults",    label: "Vote Results",     sub: "Get notified when group voting ends"    },
                  ].map(({ key, label, sub }, i, arr) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-4"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#160f29" }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{sub}</p>
                      </div>
                      <Toggle
                        checked={notifications[key]}
                        onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                      />
                    </div>
                  ))}

                  <div className="pt-4 mt-2" style={{ borderTop: "1px solid #f3f4f6" }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: "#160f29" }}>Privacy</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#160f29" }}>Location Sharing</p>
                        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>Share your location with trip members</p>
                      </div>
                      <Toggle
                        checked={locationSharing}
                        onChange={(e) => setLocationSharing(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECURITY tab ── */}
              {activeTab === "security" && (
                <div className="p-6">
                  <h3 className="text-sm font-bold mb-5" style={{ color: "#160f29" }}>Change Password</h3>

                  {passwordSuccess && (
                    <div className="text-sm px-4 py-3 rounded-xl mb-5" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
                      {passwordSuccess}
                    </div>
                  )}

                  {!showPasswordForm ? (
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
                      style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
                      onMouseLeave={e => e.currentTarget.style.background = "#f3f4f6"}
                    >
                      Change Password
                    </button>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: "Current Password",  field: "currentPassword" },
                        { label: "New Password",       field: "newPassword"     },
                        { label: "Confirm New Password", field: "confirmPassword" },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9ca3af" }}>
                            {label}
                          </label>
                          <input
                            type="password"
                            value={passwordData[field]}
                            onChange={(e) => setPasswordData({ ...passwordData, [field]: e.target.value })}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = "#160f29"}
                            onBlur={e => e.target.style.borderColor = "#d1d5db"}
                          />
                        </div>
                      ))}

                      {passwordError && (
                        <p className="text-sm px-4 py-2.5 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
                          {passwordError}
                        </p>
                      )}

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={handlePasswordChange}
                          disabled={passwordSaving}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                          style={passwordSaving ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" } : { background: "#160f29", color: "#fbfbf2" }}
                        >
                          {passwordSaving ? "Saving…" : "Update Password"}
                        </button>
                        <button
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                            setPasswordError("");
                          }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ACCOUNT tab ── */}
              {activeTab === "account" && (
                <div className="p-6">
                  <h3 className="text-sm font-bold mb-5" style={{ color: "#160f29" }}>Account Actions</h3>

                  <div className="space-y-3">
                    <button
                      onClick={handleLogout}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition text-left px-4 flex items-center justify-between"
                      style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
                      onMouseLeave={e => e.currentTarget.style.background = "#f3f4f6"}
                    >
                      <span>Log Out</span>
                      <span style={{ color: "#9ca3af" }}>→</span>
                    </button>

                    <div className="rounded-xl p-4" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#dc2626" }}>Danger Zone</p>
                      <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>
                        Permanently delete your account and all associated data. This cannot be undone.
                      </p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold transition"
                        style={{ background: "#dc2626", color: "#fff" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#b91c1c"}
                        onMouseLeave={e => e.currentTarget.style.background = "#dc2626"}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* ── Delete Account Modal ──────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: 420, background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div className="px-6 pt-6 pb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: "#fef2f2" }}>
                <span style={{ color: "#dc2626", fontSize: 18 }}>⚠</span>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "#160f29" }}>Delete Account?</h3>
              <p className="text-sm" style={{ color: "#5c6b73" }}>
                This action cannot be undone. All your data, trips, and settings will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ background: "#dc2626", color: "#fff" }}
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

export default Profile;
