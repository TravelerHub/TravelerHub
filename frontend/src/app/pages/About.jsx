import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

// ── Scroll-reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.15) {
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
    transform: visible ? "translateY(0)" : "translateY(32px)",
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  };
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    emoji: "🗺️",
    title: "Smart Navigation",
    desc: "Interactive Mapbox-powered maps with optimized multi-stop routing, real-time turn-by-turn directions, and preference-based place suggestions.",
  },
  {
    emoji: "💬",
    title: "Encrypted Group Chat",
    desc: "End-to-end encrypted real-time messaging keeps your group conversations private and synced across devices during your trip.",
  },
  {
    emoji: "🏨",
    title: "Unified Booking",
    desc: "Manage flights, hotels, car rentals, and activities in one place. No more juggling a dozen tabs or apps.",
  },
  {
    emoji: "💰",
    title: "Shared Finances",
    desc: "Track group expenses, split costs fairly, and scan receipts with AI. Everyone stays on the same page — no awkward IOUs.",
  },
  {
    emoji: "📅",
    title: "Trip Calendar",
    desc: "Visualize your entire itinerary on a shared calendar. Coordinate arrivals, activities, and departures with ease.",
  },
  {
    emoji: "🗳️",
    title: "Group Voting",
    desc: "Can't agree on a destination? Let everyone vote. Democratic decision-making built right into the platform.",
  },
];

const VALUES = [
  { emoji: "🤝", title: "Together First", desc: "Every feature is designed around the group, not the individual." },
  { emoji: "🔒", title: "Privacy Matters", desc: "E2E encryption and secure auth protect your travel plans." },
  { emoji: "⚡", title: "Frictionless", desc: "Complex trips shouldn't require complex tools." },
  { emoji: "🌍", title: "Go Anywhere", desc: "Built to support any destination, any group size, any style." },
];

const STATS = [
  { value: "6+", label: "Core Features" },
  { value: "1", label: "Unified Platform" },
  { value: "∞", label: "Destinations" },
  { value: "0", label: "Awkward Splits" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function About() {
  const navigate = useNavigate();

  const [heroRef, heroVisible]       = useScrollReveal(0.05);
  const [missionRef, missionVisible] = useScrollReveal(0.15);
  const [featRef, featVisible]       = useScrollReveal(0.1);
  const [valRef, valVisible]         = useScrollReveal(0.1);
  const [statsRef, statsVisible]     = useScrollReveal(0.1);
  const [ctaRef, ctaVisible]         = useScrollReveal(0.1);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fbfbf2" }}>
      <Navbar_Landing />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center px-6 py-28 overflow-hidden"
        style={{ background: "#160f29" }}
      >
        {/* subtle grid texture */}
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
          Who we are
        </p>
        <h1
          className="text-4xl sm:text-6xl font-bold leading-tight mb-6 max-w-3xl"
          style={{ ...reveal(heroVisible, 0.1), color: "#fbfbf2" }}
        >
          Travel together,{" "}
          <span style={{ color: "#183a37" }}>without the chaos</span>
        </h1>
        <p
          className="text-base sm:text-lg max-w-xl leading-relaxed"
          style={{ ...reveal(heroVisible, 0.2), color: "#5c6b73" }}
        >
          TravelHub is a single platform that replaces every fragmented tool
          your group needs — maps, chat, bookings, expenses, and more — all in one place.
        </p>

        <div style={reveal(heroVisible, 0.3)} className="mt-10 flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate("/signup")}
            className="px-7 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90"
            style={{ background: "#fbfbf2", color: "#160f29" }}
          >
            Get Started Free
          </button>
          <button
            onClick={() => navigate("/service")}
            className="px-7 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80 border"
            style={{ borderColor: "#374151", color: "#fbfbf2" }}
          >
            See Features
          </button>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────────────────────── */}
      <section ref={missionRef} className="px-6 py-24 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ ...reveal(missionVisible, 0), color: "#183a37" }}
            >
              Our Mission
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-6 leading-snug"
              style={{ ...reveal(missionVisible, 0.1), color: "#160f29" }}
            >
              Planning a group trip should be fun, not a second job.
            </h2>
            <p
              className="text-base leading-relaxed mb-5"
              style={{ ...reveal(missionVisible, 0.2), color: "#5c6b73" }}
            >
              We built TravelHub because every group trip involves the same pain:
              one person stuck coordinating seven different apps while everyone
              else sends conflicting Google Docs links at midnight.
            </p>
            <p
              className="text-base leading-relaxed"
              style={{ ...reveal(missionVisible, 0.3), color: "#5c6b73" }}
            >
              Our goal is simple — consolidate every tool a traveling group needs
              into a single, secure, and genuinely enjoyable platform so you can
              spend less time planning and more time exploring.
            </p>
          </div>

          {/* Visual card stack */}
          <div style={reveal(missionVisible, 0.2)} className="flex flex-col gap-4">
            {[
              { icon: "📍", label: "Multi-stop route planned", sub: "LA → Malibu → Santa Barbara" },
              { icon: "💳", label: "Hotel split evenly", sub: "$312 · 4 people · $78 each" },
              { icon: "✅", label: "Group voted: Paris!", sub: "5 of 6 in favor" },
            ].map(({ icon, label, sub }) => (
              <div
                key={label}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
                style={{ background: "#fff", borderColor: "#d1d1c7" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: "#f0f0e8" }}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#160f29" }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#5c6b73" }}>{sub}</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-green-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section
        ref={featRef}
        className="px-6 py-24"
        style={{ background: "#f0f0e8" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ ...reveal(featVisible, 0), color: "#183a37" }}
            >
              Everything You Need
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ ...reveal(featVisible, 0.1), color: "#160f29" }}
            >
              One platform. Every tool.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ emoji, title, desc }, i) => (
              <div
                key={title}
                className="rounded-2xl p-6 border"
                style={{ ...reveal(featVisible, 0.05 * i), background: "#fbfbf2", borderColor: "#d1d1c7" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: "#e8e8e0" }}
                >
                  {emoji}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: "#160f29" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#5c6b73" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────────── */}
      <section
        ref={valRef}
        className="px-6 py-24"
        style={{ background: "#160f29" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ ...reveal(valVisible, 0), color: "#183a37" }}
            >
              What We Stand For
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ ...reveal(valVisible, 0.1), color: "#fbfbf2" }}
            >
              Our core values
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ emoji, title, desc }, i) => (
              <div
                key={title}
                className="rounded-2xl p-6 border text-center"
                style={{ ...reveal(valVisible, 0.08 * i), borderColor: "#374151", background: "rgba(255,255,255,0.04)" }}
              >
                <div className="text-3xl mb-4">{emoji}</div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#fbfbf2" }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#5c6b73" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section ref={statsRef} className="px-6 py-20 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, label }, i) => (
            <div key={label} style={reveal(statsVisible, 0.1 * i)}>
              <p className="text-4xl sm:text-5xl font-bold mb-2" style={{ color: "#160f29" }}>{value}</p>
              <p className="text-sm font-medium" style={{ color: "#5c6b73" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section
        ref={ctaRef}
        className="px-6 py-24 text-center"
        style={{ background: "#183a37" }}
      >
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl mx-auto leading-snug"
          style={{ ...reveal(ctaVisible, 0), color: "#fbfbf2" }}
        >
          Ready to plan your next adventure?
        </h2>
        <p
          className="text-base mb-10 max-w-md mx-auto"
          style={{ ...reveal(ctaVisible, 0.1), color: "rgba(251,251,242,0.65)" }}
        >
          Join TravelHub and bring your whole group on board — for free.
        </p>
        <div style={reveal(ctaVisible, 0.2)} className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate("/signup")}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90"
            style={{ background: "#fbfbf2", color: "#160f29" }}
          >
            Create an Account
          </button>
          <button
            onClick={() => navigate("/contactus")}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80 border"
            style={{ borderColor: "rgba(251,251,242,0.3)", color: "#fbfbf2" }}
          >
            Contact Us
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
