import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function NewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email;

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
          <p className="text-red-600 text-center">
            Invalid access. Please start from forgot password.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

/*     if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
 */
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/updatepassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess("Password updated successfully!");
        setNewPassword("");
        setConfirmPassword("");

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.message || "Failed to update password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Create New Password
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-600 text-sm"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <button
          onClick={() => navigate("/resetpassword")}
          className="mt-4 w-full text-blue-600 hover:text-blue-700 text-sm"
        >
          Back to Email Verification
        </button>
      </div>
    </div>
  );
}
