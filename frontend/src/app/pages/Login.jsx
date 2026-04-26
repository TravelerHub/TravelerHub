import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { API_BASE } from '../../config';
import Navbar_empty from "../../components/navbar/Navbar_empty";
import Footer from "../../components/Footer";
import { CompassIcon } from "../../components/icons/NavIcons.jsx";
import { encryptionUtils } from "../../lib/encryption";
import { chatApi } from "../../components/chatbox/chatAPI";


function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function _Login(e) {
    e.preventDefault();
    setError("");
    const response = await fetch(`${API_BASE}/login`, {
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
      if (data.symmetric_key) {
        localStorage.setItem("card_symmetric_key", data.symmetric_key);
      }

      // Set up E2E encryption keypair if this device doesn't have one yet.
      // Private key stays in localStorage — only the public key is uploaded.
      if (!encryptionUtils.getKeypair()) {
        try {
          const keypair = encryptionUtils.generateKeypair();
          encryptionUtils.storeKeypair(keypair);
          await chatApi.uploadPublicKey(keypair.public_key);
        } catch (err) {
          console.error("Keypair setup failed:", err);
        }
      } else {
        // Keypair exists locally — ensure public key is on the server
        try {
          const keypair = encryptionUtils.getKeypair();
          await chatApi.uploadPublicKey(keypair.public_key);
        } catch (err) {
          console.error("Public key upload failed:", err);
        }
      }

      const params = new URLSearchParams(location.search);
      const redirectTo = params.get("redirect");
      navigate(redirectTo || "/welcome");
    }
    else {
      setError(data.detail || "Error logging in. Please try again!");
      return;
    }
  }

  return (
    <div className="w-screen min-h-screen flex flex-col" style={{ background: "#fbfbf2" }}>
      <Navbar_empty />

      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md mx-auto">
          <div
            className="rounded-3xl p-7 sm:p-9"
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e0",
              boxShadow: "0 16px 40px rgba(22, 15, 41, 0.08)",
            }}
          >
            {/* Brand mark + header */}
            <div className="flex flex-col items-center text-center mb-7">
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#160f29", color: "#c8a96e" }}
                aria-hidden="true"
              >
                <CompassIcon size={26} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#160f29" }}>
                Welcome back
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "#5c6b73" }}>
                Sign in to keep planning your trip.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={_Login} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#5c6b73" }}>
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 rounded-xl outline-none transition focus:ring-2"
                  style={{ background: "#fbfbf2", border: "1px solid #d1d1c7", color: "#160f29", "--tw-ring-color": "#183a37" }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "#5c6b73" }}>
                    Password
                  </label>
                  <Link to="/resetpassword" className="text-xs font-semibold transition" style={{ color: "#183a37" }}>
                    Forgot?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 rounded-xl outline-none transition focus:ring-2"
                  style={{ background: "#fbfbf2", border: "1px solid #d1d1c7", color: "#160f29", "--tw-ring-color": "#183a37" }}
                />
              </div>

              {error && (
                <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full font-semibold py-3 px-4 rounded-xl transition active:scale-[0.99] mt-2"
                style={{ background: "#160f29", color: "#fbfbf2" }}
              >
                Log In
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-sm" style={{ color: "#5c6b73" }}>
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="font-semibold transition" style={{ color: "#183a37" }}>
                  Sign Up
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "#9ca3af" }}>
            Secure login by TravelerHub
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Login;