import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-600 mt-2">Welcome back!</p>

      <div className="mt-6 flex gap-4">
        <button
          onClick={() => navigate("/profile")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          My Profile
        </button>

        <button
          onClick={() => navigate("/settings")}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Settings
        </button>

        <button
          onClick={() => navigate("/")}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

export default Dashboard;