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
    <div className="min-h-screen w-screen flex flex-col bg-blue-500">

      <Navbar_Dashboard />
      

        




      
        
        

        

    </div>    
  );
}

export default Dashboard;