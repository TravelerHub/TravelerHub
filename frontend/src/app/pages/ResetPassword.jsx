import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/navbar/Navbar_empty";

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function _ResetPassword(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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
      
      if (response.ok && data.exists) {
        // Email exists, navigate to OTP and pass email
        navigate("/otp", { state: { email } });
      } else {
        // Email not found
        setError(data.message || "Email not found in our system");
      }
    } catch (err) {
      console.error("Error checking email:", err);
      setError("Network error. Please try again!");
    } finally {
      setLoading(false);
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
              <p className="text-gray-600">Enter your email to verify your identity</p>
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

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 mt-6"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </form>

            {/* Back to Login Link */}
            <div className="text-center mt-6">
              <p className="text-gray-600 text-sm">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
                >
                  Log In
                </Link>
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-center text-gray-600 text-xs mt-6">
            Your data is secure with TravelerHub
          </p>
        </div>
      </div>
    </>
  );
}

export default ResetPassword;
