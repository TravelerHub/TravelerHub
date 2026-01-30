import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../../components/navbar/Navbar_empty";

function OTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // If no email was passed, redirect back to ResetPassword
  if (!email) {
    return (
      <>
        <Navbar />
        <div className="w-screen min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <p className="text-gray-600 mb-4">Please verify your email first.</p>
              <button
                onClick={() => navigate("/resetpassword")}
                className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
              >
                Go back to Reset Password
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Verify OTP
  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!otp || otp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }

    setLoading(true);

    try {
      // TODO: Add actual OTP verification endpoint to backend
      // For now, show success message
      setSuccess("OTP verified successfully!");
      setTimeout(() => {
        // Redirect to password reset or new password page
        navigate("/resetpassword");
      }, 1500);
    } catch (err) {
      console.error("Error verifying OTP:", err);
      setError("Invalid OTP. Please try again!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />

      <div className="w-screen min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify OTP</h1>
              <p className="text-gray-600">
                Enter the OTP sent to your email
              </p>
            </div>

            {/* OTP Input Form */}
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="text-center mb-4 text-sm text-gray-600">
                Email: <span className="font-medium text-gray-900">{email}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength="6"
                  required
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 mt-6"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => navigate("/resetpassword")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition duration-200"
              >
                Change Email
              </button>
            </form>

            {/* Back to Login Link */}
            <div className="text-center mt-6">
              <p className="text-gray-600 text-sm">
                Remember your password?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
                >
                  Log In
                </button>
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

export default OTP;
