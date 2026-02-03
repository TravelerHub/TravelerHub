import { useNavigate } from "react-router-dom";


import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";

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
  // if (!user) {
  //   return (
  //     <div className="min-h-screen bg-red-500">
  //       <div className="w-full text-center w-full max-w-7xl mx-auto px-6 py-8">
  //         <p className="text-black-600 mb-4">You are not logged in.</p>
  //         <button
  //           onClick={() => navigate("/login")}
  //           className="bg-blue-600 text-black px-6 py-2 rounded-lg hover:bg-blue-700"
  //         >
  //           Go to Login
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">

      <Navbar_Dashboard />
      <div className="w-full max-w-7xl mx-auto px-6 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Quick Actions Widget */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-center text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              <button
              onClick={() => navigate("/")}
              className="quickAction_btn group"
            >
              <div className="quickAction_icon bg-blue-100 group-hover:bg-blue-200">
                <span className="text-blue-600 text-lg">🔔</span>
              </div>
              <span className="quickAction_text">Notification</span>
            </button>

            <button
              onClick={() => navigate("/navigation")}
              className="quickAction_btn group"
            >
              <div className="quickAction_icon bg-green-100 group-hover:bg-green-200">
                <span className="text-green-600 text-lg">🗺️</span>
              </div>
              <span className="quickAction_text">Navigation</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="quickAction_btn group"
            >
              <div className="quickAction_icon bg-pink-100 group-hover:bg-pink-200">
                <span className="text-pink-600 text-lg">👥</span>
              </div>
              <span className="quickAction_text">Group Voting</span>
            </button>


            <button
              onClick={() => navigate("/")}
              className="quickAction_btn group"
            >
              <div className="quickAction_icon bg-yellow-100 group-hover:bg-yellow-200">
                <span className="text-yellow-600 text-lg">💬</span>
              </div>
              <span className="quickAction_text">App Message</span>
            </button>

            </div>
          </div>



          {/* RIGHT: Coming Soon Section */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Trips</h2>

          <div className="py-6">
            <div className="text-4xl mb-3">🌴</div>
            <p className="text-gray-600">No trips yet</p>
            <p className="text-gray-400 text-sm mt-1">Start planning your first adventure!</p>

            <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition">
              Create Trip
            </button>
          </div>
        </div>

        </div>
      </div>

        

    </div>    
  );
}

export default Dashboard;