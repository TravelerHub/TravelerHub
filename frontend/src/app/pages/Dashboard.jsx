import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  // Load user from localStorage
  const getStoredUser = () => {
    const stored = localStorage.getItem("user");
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  };

  const user = getStoredUser();

  const getInitials = (name) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // uncomment this if using sessionStorage
    // sessionStorage.removeItem('token');
    // sessionStorage.removeItem('user');
    navigate("/");
  };

  // If no user, redirect to login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-md mx-auto text-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow">
              <span className="text-xl font-bold text-white">
                {getInitials(user.username)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.username}!</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition">
                <span className="text-blue-600 text-lg">👤</span>
              </div>
              <span className="text-gray-700 font-medium">My Profile</span>
            </button>
            <button
              onClick={() => navigate("/navigation")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition">
                <span className="text-green-600 text-lg">🗺️</span>
              </div>
              <span className="text-gray-700 font-medium">Navigation</span>
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition group"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition">
                <span className="text-gray-600 text-lg">⚙️</span>
              </div>
              <span className="text-gray-700 font-medium">Settings</span>
            </button>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Trips</h2>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🌴</div>
            <p className="text-gray-500">No trips yet</p>
            <p className="text-gray-400 text-sm mt-1">Start planning your first adventure!</p>
            <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition">
              Create Trip
            </button>
          </div>
        </div>

        {/* Log Out */}
        <div className="mt-6 text-center">
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 text-sm transition"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;