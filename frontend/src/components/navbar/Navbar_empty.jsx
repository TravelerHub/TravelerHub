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
      </div>
    </nav>
  );
}

export default Navbar;
