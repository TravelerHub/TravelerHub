import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Navbar_Dashboard() {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const stored = localStorage.getItem("user");
  const user = stored ? JSON.parse(stored) : null;
  const displayName = user?.username || user?.name || "Traveler";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    // Only remove auth tokens — keep user_keypair and conversation_keys
    // so encrypted messages remain readable on next login.
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Simple feature search — navigate on Enter
  const handleSearch = (e) => {
    if (e.key !== "Enter" || !searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    const routes = {
      navigation: "/navigation", map: "/navigation",
      chat: "/message", message: "/message", messages: "/message",
      booking: "/booking", hotel: "/booking", flight: "/booking",
      calendar: "/calendar",
      finance: "/finance", wallet: "/finance",
      scanner: "/expenses", receipt: "/expenses", expenses: "/expenses",
      profile: "/profile",
      settings: "/settings",
    };
    const match = Object.keys(routes).find((k) => q.includes(k));
    if (match) navigate(routes[match]);
    setSearchQuery("");
  };

  return (
    <header
      className="h-14 shrink-0 flex items-center gap-4 px-6 border-b"
      style={{ background: "#fbfbf2", borderColor: "#d1d1c7" }}
    >
      {/* ── Search ── */}
      <div className="flex-1 max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search features…"
          className="w-full px-4 py-2 rounded-lg text-sm outline-none placeholder-gray-400 transition focus:ring-2"
          style={{
            background: "#e8e8e0",
            color: "#160f29",
            "--tw-ring-color": "#183a37",
          }}
        />
      </div>

<<<<<<< HEAD
        {/* Quick Action Icons */}
        <div className="flex items-center gap-3">   

          {/* Notification */}
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


          {/* Booking */}
          <div className="relative group">
            <button
              onClick={() => navigate("/booking")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">🏨</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Booking
            </div>
          </div>

          {/* Messenger */}
          <div className="relative group">
            <button
              // onClick={() => navigate("/message")}
              onClick={() => navigate("/message")}
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

          {/* Expenses */}
          <div className="relative group">
            <button
              onClick={() => navigate("/expenses")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">🧾</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Smart Scanner
            </div>
          </div>

          {/* Calendar */}
          <div className="relative group">
            <button
              onClick={() => navigate("/calendar")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">📅</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Calendar
            </div>
          </div>
          

          {/* Finance */}
          <div className="relative group">
            <button
              onClick={() => navigate("/finance")}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-lg">💰</span>
            </button>
            <div className="absolute top-full mt-2 right-1/2 translate-x-1/2
              bg-gray-900 text-white text-xs rounded px-2 py-1
              opacity-0 invisible group-hover:opacity-100 group-hover:visible transition
              whitespace-nowrap z-50">
              Finance
            </div>
          </div>
        </div>

        {/* Welcome Text */}
        <span className="text-lg text-gray-600 hidden sm:inline">
          Welcome,{" "}
          <span className="font-medium text-gray-800">{user?.username}</span>
=======
      {/* ── Right actions ── */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Language badge */}
        <span
          className="text-xs font-semibold px-2 py-1 rounded select-none"
          style={{ color: "#5c6b73", background: "#e2e2da" }}
        >
          EN
>>>>>>> ac19178fac1baf248ff86fcf4a4a2a2bcffab7cb
        </span>

        {/* Chat notifications */}
        <button
          onClick={() => navigate("/message")}
          title="Messages"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#5c6b73" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.84L3 20l1.09-3.27A7.958 7.958 0 013 12C3 7.582 7.03 4 12 4s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Event notifications */}
        <button
          onClick={() => navigate("/calendar")}
          title="Events"
          className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#5c6b73" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Profile avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition hover:opacity-90 select-none"
            style={{ background: "#183a37" }}
          >
            {initials}
          </button>

          {showProfile && (
            <>
              {/* Click-away overlay */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProfile(false)}
              />
              <div
                className="absolute right-0 top-10 w-36 rounded-xl shadow-lg overflow-hidden z-50"
                style={{ background: "#fbfbf2", border: "1px solid #d1d1c7" }}
              >
                <button
                  onClick={() => { navigate("/profile"); setShowProfile(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition"
                  style={{ color: "#160f29" }}
                >
                  Profile
                </button>
                <div style={{ borderTop: "1px solid #d1d1c7" }} />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 transition"
                  style={{ color: "#160f29" }}
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar_Dashboard;
