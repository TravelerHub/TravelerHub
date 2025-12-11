import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./../../supabaseClient.jsx";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function _Login(e) {
    e.preventDefault();
    setError("");
    // Check if username exists
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (!userData) {
      setError("Username does not exist!");
      return;
    }

    // Check if password matches
    if (userData.password !== password) {
      setError("Incorrect password!");
      return;
    }

    // Redirect to Dashboard
    navigate("/dashboard");
  }

  return (
    <div>
      <form onSubmit={_Login}>
        <h1>Login</h1>

        <input
          type="text"
          placeholder="Enter your Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Enter your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Login</button>
        
        <p>Don't have an account? <Link to="/signup">Sign Up</Link></p>
      </form>
      {error && <p>{error}</p>}
    </div>
  );
}

export default Login;