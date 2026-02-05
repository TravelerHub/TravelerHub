import { useNavigate } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload.jsx";


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
  if (!user) {
    return (
      <div className="min-h-screen  bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-full text-center w-full max-w-7xl mx-auto px-6 py-8">
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
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">

      <Navbar_Dashboard />
      <div className="w-full max-w-7xl mx-auto px-6 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Quick Actions Widget */}
          <div className="mb-6">
              <div className="flex justify-center">
                <ImageUpload 
                onUploadSuccess={() => console.log("Image uploaded successfully!")} />
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