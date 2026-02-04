import { useNavigate } from "react-router-dom";
import { useState } from "react";

import LogoImg from "../../assets/images/logo_img.png";

function Navbar_Landing() {
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
          <img
            src={LogoImg}
            alt="TravelHub Logo"
            className="h-10 w-auto object-contain"
          />
        </button>


        {/* Login button on the Right */}
        <button
          onClick={() => navigate("/login")}
          className="border-2 border-white font-bold py-3 px-8 rounded-xl hover:bg-white bg-black text-white hover:text-indigo-600 transition"
        >
          Log In
        </button>
      </div>
    </nav>

    
  );
}

export default Navbar_Landing;
