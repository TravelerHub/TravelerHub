import { useNavigate } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload.jsx";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";

function Dashboard() {
  const navigate = useNavigate();

  // Load user from localStorage
  const getStoredUser = () => {
    const stored = localStorage.getItem("user");
    if (stored) return JSON.parse(stored);
    return null;
  };

  const user = getStoredUser();

  const getInitials = (name) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  // If no user, redirect to login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-6">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-4">🧳</div>
          <p className="text-gray-700 font-medium">You are not logged in.</p>
          <p className="text-gray-500 text-sm mt-1">
            Log in to view your trips and bookings.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-6 w-full bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-black/90 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const displayName = user?.username || user?.name || "Traveler";

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar_Dashboard />

      <div className="w-full max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            {/* <p className="text-sm text-gray-500">Dashboard</p> */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Welcome back, {displayName} 
            </h1>
            <p className="text-gray-600 mt-1">
              Keep your plans in one place — trips, bookings, and next steps.
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/trip/new")}
              className="px-5 py-2.5 rounded-xl bg-black text-white font-semibold hover:bg-black/90 transition"
            >
              + Create Trip
            </button>
            <button
              onClick={() => navigate("/booking/new")}
              className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition"
            >
              + Add Booking
            </button>
          </div>
        </div>

        {/* TOP ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Profile / Image Upload Card */}
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                {getInitials(displayName)}
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-2">
              Add a photo so your travel group can recognize you.
            </p>

            <div className="mt-6 flex justify-center">
              <ImageUpload
                onUploadSuccess={() =>
                  console.log("Image uploaded successfully!")
                }
              />
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Tip</p>
              <p className="text-sm text-gray-600 mt-1">
                Planning with friends is easier when everyone has a profile photo.
              </p>
            </div>
          </div>

          {/* RIGHT: Your Trips Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-200 p-6 overflow-hidden relative">
            {/* subtle travel gradient accent */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-black/5 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Your Trips</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Create a trip, invite friends, and build your itinerary.
                  </p>
                </div>
                <span className="text-2xl">🗺️</span>
              </div>

              {/* Empty state (replace later with real trips list) */}
              <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-5xl mb-3">🌴</div>
                <p className="text-gray-800 font-semibold">No trips yet</p>
                <p className="text-gray-500 text-sm mt-1">
                  Start planning your first adventure and keep everything organized.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => navigate("/trip/new")}
                    className="bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-black/90 transition"
                  >
                    Create Trip
                  </button>
                  <button
                    onClick={() => navigate("/explore")}
                    className="px-6 py-3 rounded-xl font-semibold border border-gray-200 text-gray-800 hover:bg-white transition"
                  >
                    Explore Ideas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECOND ROW: Bookings */}
        <div className="mt-6 bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bookings</h3>
              <p className="text-sm text-gray-500 mt-1">
                Flights, hotels, and transportation — all in one place.
              </p>
            </div>
            <span className="text-2xl">✈️</span>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Flights</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              <p className="text-xs text-gray-500 mt-2">Add your flight details</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Hotels</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              <p className="text-xs text-gray-500 mt-2">Keep stays organized</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Rides</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              <p className="text-xs text-gray-500 mt-2">Car / train / bus</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/booking")}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-black/90 transition"
            >
              Go to Bookings
            </button>

            <button
              onClick={() => navigate("/booking/new")}
              className="w-full py-3 rounded-xl font-semibold border border-gray-200 text-gray-800 hover:bg-gray-50 transition"
            >
              Add Booking
            </button>
          </div>
        </div>

        {/* Optional: small “inspiration” footer section */}
        <div className="mt-6 rounded-3xl bg-black text-white p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-white/70 text-sm uppercase tracking-wide">
              Travel reminder
            </p>
            <p className="mt-2 text-xl md:text-2xl font-bold">
              “Collect moments, not things.”
            </p>
            <p className="text-white/75 mt-2">
              Start a trip and let the planning be the easy part.
            </p>
          </div>

          <button
            onClick={() => navigate("/trip/new")}
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition"
          >
            Plan a Trip
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;