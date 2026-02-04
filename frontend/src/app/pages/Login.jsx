import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar_empty from "../../components/navbar/Navbar_empty";
import Footer from "../../components/Footer";


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
    const response = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      // Store the token for authenticated requests
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    }
  }

  return (
    <div className="w-screen min-h-screen flex flex-col">
      {/* Navbar */}
      <Navbar_empty />
      
      <div className="  bg-gradient-to-br from-white-50 to-indigo-100 flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl mx-auto grid place-items-center ">
          <div className=" min-w-sm max-w-2xl border-solid border-2 border-gray-700 rounded-3xl shadow-lg p-8">


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
                  className="border-solid border-2 border-gray-700  text-black w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
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
                  className="border-solid border-2 border-gray-700 text-black w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Error Message  TODO: fix this function for the user prevent error*/}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Forget Password Link */}
              <div className="text-center mt-6">
                <p className="text-gray-600 text-sm">
                  Forget password?{" "}
                  <Link
                    to="/resetpassword"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
                  >
                    Reset Password
                  </Link>
                </p>
              </div>

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
          <div className="max-w-md px-8 py-4">
              <p className="text-center text-gray-600 text-xs mt-6">
            Secure login by TravelerHub
              </p>
          </div>
          
        </div>

        
      </div>
      <Footer />
      
      
    </div>
  );
}

export default Login;