import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./../../supabaseClient.jsx";
import bcrypt from "bcryptjs";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function _verifyPassword(password, hashedPassword) {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  }

  async function _Login(e) {
    e.preventDefault();
    setError("");
    // Check if username exists
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("username, password")
      .eq("username", username)
      .single();

    if (!userData) {
      setError("Username does not exist!");
      return;
    }

    // Check if password matches
    if (!await _verifyPassword(password, userData.password)) {
      setError("Incorrect password!");
      return;
    }

    // Redirect to Dashboard
    navigate("/dashboard");
  }

  return (
    <div className="w-screen min-h-screen bg-gradient-to-br from-white-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Log In</h1>
           
          </div>

          {/* Form */}
          <form onSubmit={_Login} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-black mb-2 ">
                Username
              </label>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-black-600 bg-black hover:bg-gray-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 mt-6"
            >
              Log In
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Secure login by TravelerHub
        </p>
      </div>
    </div>
  );
}

export default Login;