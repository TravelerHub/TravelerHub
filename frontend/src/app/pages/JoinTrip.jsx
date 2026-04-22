import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../../config";

export default function JoinTrip() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const user = (() => {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  })();

  // Fetch trip preview on mount
  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`${API_BASE}/groups/invite/${token}`);
        if (res.status === 404) {
          const data = await res.json();
          setError(data.detail || "This invite link is invalid or has expired.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Something went wrong loading the invite. Please try again.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPreview(data);
      } catch (err) {
        setError("Could not reach the server. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      navigate(`/login?redirect=/join/${token}`);
      return;
    }

    setJoining(true);
    setError("");
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/groups/invite/${token}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (res.status === 409) {
        setError("You are already a member of this trip.");
        return;
      }
      if (res.status === 404) {
        setError(data.detail || "This invite link is invalid or has expired.");
        return;
      }
      if (!res.ok) {
        setError(data.detail || "Failed to join the trip. Please try again.");
        return;
      }

      setSuccessMsg(data.message || `You joined ${preview?.trip_name}!`);
      setTimeout(() => navigate("/dashboard"), 1800);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f3f4f6" }}
      >
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "#183a37", borderTopColor: "transparent" }}
          />
          <p style={{ color: "#5c6b73" }}>Loading invite…</p>
        </div>
      </div>
    );
  }

  // ── Error state (invalid / expired / maxed out) ────────────────────────────
  if (error && !preview) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "#f3f4f6" }}
      >
        <div
          className="rounded-2xl shadow-xl max-w-sm w-full p-8 text-center"
          style={{ background: "#fbfbf2" }}
        >
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#160f29" }}>
            Invite Link Unavailable
          </h2>
          <p className="text-sm mb-6" style={{ color: "#5c6b73" }}>
            {error}
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
            style={{ background: "#183a37" }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (successMsg) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "#f3f4f6" }}
      >
        <div
          className="rounded-2xl shadow-xl max-w-sm w-full p-8 text-center"
          style={{ background: "#fbfbf2" }}
        >
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#160f29" }}>
            {successMsg}
          </h2>
          <p className="text-sm" style={{ color: "#5c6b73" }}>
            Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    );
  }

  // ── Preview + join UI ──────────────────────────────────────────────────────
  const expiresLabel = preview?.expires_at
    ? new Date(preview.expires_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#f3f4f6" }}
    >
      <div
        className="rounded-2xl shadow-xl max-w-sm w-full p-8"
        style={{ background: "#fbfbf2" }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✈️</div>
          <p className="text-sm font-medium mb-1" style={{ color: "#5c6b73" }}>
            You&apos;re invited to join
          </p>
          <h1 className="text-2xl font-bold" style={{ color: "#160f29" }}>
            {preview?.trip_name}
          </h1>
        </div>

        {/* Trip info */}
        <div
          className="rounded-xl p-4 mb-6 space-y-2"
          style={{ background: "#f3f4f6", border: "1px solid #d1d5db" }}
        >
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "#5c6b73" }}>Members</span>
            <span className="font-semibold" style={{ color: "#160f29" }}>
              {preview?.member_count ?? "—"}
            </span>
          </div>
          {preview?.created_by_name && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "#5c6b73" }}>Invited by</span>
              <span className="font-semibold" style={{ color: "#160f29" }}>
                {preview.created_by_name}
              </span>
            </div>
          )}
          {expiresLabel && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "#5c6b73" }}>Link expires</span>
              <span className="font-semibold" style={{ color: "#160f29" }}>
                {expiresLabel}
              </span>
            </div>
          )}
        </div>

        {/* Error (post-preview, e.g. already a member) */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
          >
            {error}
          </div>
        )}

        {/* CTA */}
        {user ? (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "#183a37" }}
          >
            {joining ? "Joining…" : "Join Trip"}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-center" style={{ color: "#5c6b73" }}>
              Sign in to join this trip
            </p>
            <button
              onClick={() => navigate(`/login?redirect=/join/${token}`)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition hover:opacity-90"
              style={{ background: "#183a37" }}
            >
              Sign In to Join
            </button>
            <button
              onClick={() => navigate(`/signup?redirect=/join/${token}`)}
              className="w-full py-3 rounded-xl font-semibold text-sm transition hover:opacity-90"
              style={{ background: "#f3f4f6", color: "#160f29", border: "1px solid #d1d5db" }}
            >
              Create Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
