import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

// ── Scroll-reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function reveal(visible, delay = 0) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
  };
}

const CATEGORIES = ["General", "Bug Report", "Feature Request", "Navigation", "Chat", "Booking", "Finance", "Other"];

const REVIEWS = [
  {
    name: "Sophia R.",
    avatar: "SR",
    avatarBg: "#183a37",
    rating: 5,
    category: "Navigation",
    date: "March 2025",
    text: "The navigation feature is honestly the best part. We planned a 6-stop road trip through California and the optimized routing saved us over an hour. The turn-by-turn was super smooth too.",
  },
  {
    name: "Marcus T.",
    avatar: "MT",
    avatarBg: "#1e3a5f",
    rating: 5,
    category: "Finance",
    date: "February 2025",
    text: "Finally — a travel app that actually handles splitting costs without any drama. We scanned every receipt at dinner and TravelHub split it instantly. No more 'I'll Venmo you later' moments.",
  },
  {
    name: "Aiko N.",
    avatar: "AN",
    avatarBg: "#3b2f00",
    rating: 4,
    category: "Chat",
    date: "March 2025",
    text: "Love that the chat is encrypted. Our group has 9 people and keeping everyone in the loop used to be chaos. Now everything's in one place. Would love emoji reactions in a future update!",
  },
  {
    name: "Daniel K.",
    avatar: "DK",
    avatarBg: "#2d1b4e",
    rating: 5,
    category: "General",
    date: "January 2025",
    text: "We've tried 4 different group travel apps. TravelHub is the only one that actually does everything. Booking, map, chat, expenses — all in one. We're never going back.",
  },
  {
    name: "Priya M.",
    avatar: "PM",
    avatarBg: "#1a3320",
    rating: 4,
    category: "Feature Request",
    date: "March 2025",
    text: "Would love a packing list feature for the group so we don't show up with 4 portable chargers and zero sunscreen. Aside from that, the calendar and voting tools are 10/10.",
  },
  {
    name: "Carlos V.",
    avatar: "CV",
    avatarBg: "#3b1f1f",
    rating: 5,
    category: "Booking",
    date: "February 2025",
    text: "Having all our hotel and flight info in one dashboard instead of scattered across emails was a game changer. Our trip to Japan was the most organized we've ever been.",
  },
];

const RATINGS = [
  { value: 5, label: "Love it" },
  { value: 4, label: "Like it" },
  { value: 3, label: "It's ok" },
  { value: 2, label: "Not great" },
  { value: 1, label: "Poor" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Feedback() {
  const navigate = useNavigate();

  const [heroRef,    heroVisible]    = useScrollReveal(0.05);
  const [reviewsRef, reviewsVisible] = useScrollReveal(0.08);
  const [formRef,    formVisible]    = useScrollReveal(0.1);

  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [category,  setCategory]  = useState("General");
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [message,   setMessage]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) { setError("Please write your feedback before submitting."); return; }
    if (rating === 0)    { setError("Please select a rating."); return; }
    setError("");
    setLoading(true);
    // Simulate async submit — wire to your backend endpoint here
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setRating(0);
    setHovered(0);
    setCategory("General");
    setName("");
    setEmail("");
    setMessage("");
    setError("");
  };

  const activeRating = hovered || rating;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fbfbf2" }}>
      <Navbar_Landing />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden"
        style={{ background: "#160f29" }}
      >
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #fbfbf2 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ ...reveal(heroVisible, 0), color: "#183a37" }}
        >
          We're listening
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold leading-tight mb-5 max-w-2xl"
          style={{ ...reveal(heroVisible, 0.1), color: "#fbfbf2" }}
        >
          Share your{" "}
          <span style={{ color: "#183a37" }}>feedback</span>
        </h1>
        <p
          className="text-base max-w-lg leading-relaxed"
          style={{ ...reveal(heroVisible, 0.2), color: "#5c6b73" }}
        >
          Every piece of feedback helps us build a better TravelHub. Tell us
          what's working, what's broken, or what you wish existed.
        </p>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────────────────────────── */}
      <section ref={reviewsRef} className="px-6 py-20" style={{ background: "#f0f0e8" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ ...reveal(reviewsVisible, 0), color: "#183a37" }}
            >
              Community Feedback
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-2"
              style={{ ...reveal(reviewsVisible, 0.1), color: "#160f29" }}
            >
              What travelers are saying
            </h2>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ ...reveal(reviewsVisible, 0.15), color: "#5c6b73" }}
            >
              Real feedback from real groups who planned their trips with TravelHub.
            </p>

            {/* Overall score bar */}
            <div style={reveal(reviewsVisible, 0.2)} className="flex items-center justify-center gap-3 mt-6">
              <span className="text-5xl font-black" style={{ color: "#160f29" }}>4.8</span>
              <div className="text-left">
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className="text-xl" style={{ color: s <= 5 ? "#f59e0b" : "#d1d1c7" }}>★</span>
                  ))}
                </div>
                <p className="text-xs" style={{ color: "#5c6b73" }}>Based on {REVIEWS.length} reviews</p>
              </div>
            </div>
          </div>

          {/* Review cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVIEWS.map(({ name, avatar, avatarBg, rating, category, date, text }, i) => (
              <div
                key={name}
                className="flex flex-col rounded-2xl border p-6"
                style={{ ...reveal(reviewsVisible, 0.06 * i), background: "#fbfbf2", borderColor: "#d1d1c7" }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: avatarBg }}
                  >
                    {avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#160f29" }}>{name}</p>
                    <p className="text-xs" style={{ color: "#5c6b73" }}>{date}</p>
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: "#e8e8e0", color: "#5c6b73" }}
                  >
                    {category}
                  </span>
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className="text-base" style={{ color: s <= rating ? "#f59e0b" : "#d1d1c7" }}>★</span>
                  ))}
                </div>

                {/* Text */}
                <p className="text-sm leading-relaxed flex-1" style={{ color: "#5c6b73" }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM ─────────────────────────────────────────────────────────────── */}
      <section ref={formRef} className="px-6 py-20 flex-1">
        <div className="max-w-2xl mx-auto">

          {submitted ? (
            /* ── Success state ── */
            <div
              className="rounded-2xl border p-12 text-center"
              style={{ ...reveal(true, 0), background: "#fff", borderColor: "#d1d1c7" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6"
                style={{ background: "#f0f0e8" }}
              >
                🎉
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: "#160f29" }}>
                Thank you!
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "#5c6b73" }}>
                Your feedback has been received. We read every submission and use
                it to make TravelHub better for everyone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-80"
                  style={{ background: "#183a37" }}
                >
                  Submit Another
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80 border"
                  style={{ borderColor: "#d1d1c7", color: "#160f29" }}
                >
                  Back to Home
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border overflow-hidden"
              style={{ ...reveal(formVisible, 0), borderColor: "#d1d1c7" }}
            >
              {/* Form header */}
              <div className="px-8 py-6 border-b" style={{ background: "#160f29", borderColor: "#374151" }}>
                <h2 className="text-lg font-bold" style={{ color: "#fbfbf2" }}>Feedback Form</h2>
                <p className="text-xs mt-1" style={{ color: "#5c6b73" }}>
                  All fields marked <span style={{ color: "#ef4444" }}>*</span> are required
                </p>
              </div>

              <div className="px-8 py-8 space-y-7" style={{ background: "#fff" }}>

                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: "#160f29" }}>
                    Overall Rating <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHovered(star)}
                          onMouseLeave={() => setHovered(0)}
                          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                          aria-label={`Rate ${star} stars`}
                        >
                          <span style={{ color: star <= activeRating ? "#f59e0b" : "#d1d1c7", transition: "color 0.15s" }}>
                            ★
                          </span>
                        </button>
                      ))}
                    </div>
                    {activeRating > 0 && (
                      <span className="text-sm font-medium" style={{ color: "#5c6b73" }}>
                        {RATINGS.find((r) => r.value === activeRating)?.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: "#160f29" }}>
                    Category <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-medium transition"
                        style={{
                          background: category === cat ? "#183a37" : "#f0f0e8",
                          color:      category === cat ? "#fbfbf2" : "#5c6b73",
                          border:     category === cat ? "1px solid #183a37" : "1px solid #d1d1c7",
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name + Email row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: "#160f29" }}>
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name (optional)"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                      style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: "#160f29" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com (optional)"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                      style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: "#160f29" }}>
                    Your Feedback <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think — what's great, what's broken, or what you'd love to see next..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition resize-none"
                    style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                  />
                  <p className="text-xs mt-1.5 text-right" style={{ color: "#5c6b73" }}>
                    {message.length} characters
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition disabled:opacity-60 hover:opacity-90"
                  style={{ background: "#183a37" }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Submitting…
                    </span>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>

                <p className="text-xs text-center" style={{ color: "#5c6b73" }}>
                  Prefer email?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/contactus")}
                    className="underline underline-offset-2 hover:opacity-70 transition"
                    style={{ color: "#183a37" }}
                  >
                    Contact us directly
                  </button>
                </p>

              </div>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
