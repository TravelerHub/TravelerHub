import { useNavigate } from "react-router-dom";
import { useState } from "react";

function Navbar() {
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleProfileClick = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const handleLogout = () => {
    // Add logout logic here
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="w-screen px-6 py-4 flex items-center justify-between">
        {/* Logo/Title on the Left */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 focus:outline-none"
          type="button"
        >
          <span className="text-2xl font-bold text-gray-900">TravelerHub</span>
        </button>

        {/* Navigation Links in the Center */}
        <div className="flex items-center gap-8 text-black">
          <button
            type="button"
            onClick={() => navigate("/about")}
            className="text-gray-700 font-medium hover:text-indigo-600 transition"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-gray-700 font-medium hover:text-indigo-600 transition"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate("/service")}
            className="text-gray-700 font-medium hover:text-indigo-600 transition"
          >
            Service
          </button>
        </div>

        {/* Profile Icon on the Far Right */}
        <div className="relative">
          <button
            onClick={handleProfileClick}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black text-white hover:bg-indigo-700 transition"
            title="User Profile"
            type="button"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="w-full text-left px-4 py-2 text-black hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                My Profile
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                Settings
              </button>
              <hr className="my-2" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition font-medium"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
