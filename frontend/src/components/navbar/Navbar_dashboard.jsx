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

function Navbar_Dashboard() {
  return (
    <nav className="w-full bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-end">
        <span className="text-sm text-gray-600">
          Welcome, <span className="font-medium text-gray-800">{user?.username}</span>
        </span>
      </div>
    </nav>
  );
}

export default Navbar_Dashboard;
