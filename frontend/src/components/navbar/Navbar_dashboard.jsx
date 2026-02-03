import { useNavigate } from "react-router-dom";

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

function Navbar_Dashboard() {
  const navigate = useNavigate();

  return (
    <nav className="w-full bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-end gap-4">
        {/* Welcome Text */}
        <span className="text-sm text-gray-600">
          Welcome,{" "}
          <span className="font-medium text-gray-800">{user?.username}</span>
        </span>

        {/* Profile Dropdown */}
        <div className="relative group">
          {/* Avatar */}
          <div className="w-9 h-9 bg-blue-400 text-white rounded-full flex items-center justify-center font-semibold cursor-pointer">
            {getInitials(user?.username)}
          </div>

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full w-40 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
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
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar_Dashboard;
