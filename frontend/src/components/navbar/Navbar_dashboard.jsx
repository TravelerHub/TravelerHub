import { useNavigate } from "react-router-dom";

function Navbar_Dashboard() {
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

  return (
    <nav className="w-full bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-3">

        {/* Quick Action Icons */}
        <div className="flex items-center gap-3">   

          {/* Navigation */}
          <div className="relative group">
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center  hover:bg-gray-100 transition"
            >
              <span className="text-lg">🔔</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Notification
            </div>
          </div>

          {/* Navigation */}
          <div className="relative group">
            <button
              onClick={() => navigate("/navigation")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">🗺️</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Navigation
            </div>
          </div>

          {/* Group Voting */}
          <div className="relative group">
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">👥</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Group Voting
            </div>
          </div>

          {/* Messenger */}
          <div className="relative group">
            <button
              onClick={() => navigate("/messenger")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">💬</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Messenger
            </div>
          </div>

          
        </div>

        {/* Welcome Text */}
        <span className="text-lg text-gray-600 hidden sm:inline">
          Welcome,{" "}
          <span className="font-medium text-gray-800">{user?.username}</span>
        </span>

        {/* Profile Dropdown */}
        <div className="relative group">
          <div className="w-9 h-9 bg-blue-400 text-white rounded-full flex items-center justify-center font-semibold cursor-pointer">
            {getInitials(user?.username)}
          </div>

          <div className="absolute right-0 top-full w-40 bg-white rounded-lg shadow-lg border border-gray-200
            opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-50">
            <button
              onClick={() => navigate("/profile")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              👤 Profile
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                navigate("/login");
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              🚪 Logout
            </button>
          </div>
        </div>

      </div>
    </nav>
  );
}

export default Navbar_Dashboard;
