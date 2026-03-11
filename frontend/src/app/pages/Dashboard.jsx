import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from '../../config';
import ImageUpload from "../../components/ImageUpload.jsx";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";

function Dashboard() {
  const navigate = useNavigate();

  const getStoredUser = () => {
    const stored = localStorage.getItem("user");
    if (stored) return JSON.parse(stored);
    return null;
  };

  const user = getStoredUser();

  // Trips state
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Create trip modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripDescription, setNewTripDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Members modal state
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (user) fetchTrips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTrips = async () => {
    setLoadingTrips(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/groups/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
      }
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoadingTrips(false);
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTripName.trim()) {
      setCreateError("Trip name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/groups/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTripName.trim(),
          description: newTripDescription.trim() || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTripName("");
        setNewTripDescription("");
        fetchTrips();
      } else {
        const err = await res.json();
        setCreateError(err.detail || "Failed to create trip.");
      }
    } catch (err) {
      console.error("Error creating trip:", err);
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleViewMembers = async (trip) => {
    setSelectedGroup(trip);
    setShowMembersModal(true);
    setLoadingMembers(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/groups/${trip.group_id}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleMakeLeader = async (groupId, userId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/groups/${groupId}/members/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: "leader" }),
      });
      // Refresh members list
      handleViewMembers(selectedGroup);
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-full text-center max-w-7xl mx-auto px-6 py-8">
          <p className="text-black-600 mb-4">You are not logged in.</p>
          <button
            onClick={() => navigate("/login")}
            className="bg-blue-600 text-black px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar_Dashboard />

      <div className="w-full max-w-7xl mx-auto px-6 py-8">
        {/* TOP ROW: Profile Photo + Your Trips */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Profile / Image Upload Card */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-center">
              <ImageUpload onUploadSuccess={() => console.log("Image uploaded successfully!")} />
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Upload a photo to personalize your account.
            </p>
          </div>

          {/* RIGHT: Your Trips Card */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Your Trips</h2>
              <button
                onClick={() => { setShowCreateModal(true); setCreateError(""); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition text-sm"
              >
                + Create Trip
              </button>
            </div>

            {loadingTrips ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading trips...</div>
            ) : trips.length === 0 ? (
              <div className="py-6 text-center">
                <div className="text-4xl mb-3">🌴</div>
                <p className="text-gray-600">No trips yet</p>
                <p className="text-gray-400 text-sm mt-1">Start planning your first adventure!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{trip.name}</h3>
                        {trip.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{trip.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              trip.my_role === "leader"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {trip.my_role === "leader" ? "👑 Leader" : "Member"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewMembers(trip)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition"
                      >
                        Members
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECOND ROW: Bookings */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Bookings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Flights, hotels, and transportation in one place.
              </p>
            </div>
            <span className="text-2xl">✈️</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-500">Flights</p>
              <p className="text-sm font-semibold text-gray-800">0</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-500">Hotels</p>
              <p className="text-sm font-semibold text-gray-800">0</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-500">Rides</p>
              <p className="text-sm font-semibold text-gray-800">0</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/booking")}
            className="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Go to Bookings
          </button>

          <button
            onClick={() => navigate("/booking/new")}
            className="mt-3 w-full py-2.5 rounded-lg font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            Add Booking
          </button>
        </div>
      </div>

      {/* Create Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Trip</h3>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="e.g., Europe Summer 2025"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={newTripDescription}
                  onChange={(e) => setNewTripDescription(e.target.value)}
                  placeholder="Where are you going and with who?"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-400"
                >
                  {creating ? "Creating..." : "Create Trip"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedGroup.name} — Members</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {loadingMembers ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No members found.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {member.username || member.email || member.user_id}
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          member.role === "leader"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {member.role === "leader" ? "👑 Leader" : "Member"}
                      </span>
                    </div>
                    {selectedGroup.my_role === "leader" &&
                      member.role !== "leader" &&
                      member.user_id !== user?.id && (
                        <button
                          onClick={() => handleMakeLeader(selectedGroup.group_id, member.user_id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                        >
                          Make Leader
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowMembersModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
