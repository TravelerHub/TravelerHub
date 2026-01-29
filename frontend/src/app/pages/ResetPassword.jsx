import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/navbar/Navbar_empty";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function _ResetPassword(e) {
    e.preventDefault();
    setError("");
    const response = await fetch("http://localhost:8000/resetpassword", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      navigate("/otp");
    }
  }

  return (
    <>
      {/* Navbar */}
      <Navbar />

      <div className="w-screen min-h-screen bg-gradient-to-br from-white-50 to-indigo-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
            </div>

            {/* Form */}
            <form onSubmit={_ResetPassword} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-black w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-black py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default ResetPassword;