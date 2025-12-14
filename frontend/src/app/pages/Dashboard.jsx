import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="mt-6 flex gap-4">
        <button 
          onClick={() => navigate("/settings")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Settings
        </button>
        
        <button 
          onClick={() => navigate("/")}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Dashboard;