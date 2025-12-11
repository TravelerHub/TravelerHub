import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
        <h1>Dashboard</h1>
        <button onClick={() => navigate("/")}>Log out</button>
    </div>
  );
}

export default Dashboard;