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

// ── Data ──────────────────────────────────────────────────────────────────────
const SERVICES = [
  {
    emoji: "🗺️",
    title: "Smart Navigation & Routing",
    tag: "Maps",
    desc: "Plan multi-stop trips with Mapbox-powered interactive maps. Get optimized routes, real-time turn-by-turn directions, and AI-powered place suggestions tailored to your group's preferences.",
    bullets: ["Multi-stop route optimization", "Driving, walking, cycling & transit modes", "Preference-based nearby place discovery", "Drop custom pins & save favorite spots"],
    accent: "#183a37",
  },
  {
    emoji: "💬",
    title: "Encrypted Group Chat",
    tag: "Communication",
    desc: "Stay in sync with your travel crew through real-time, end-to-end encrypted messaging. Your conversations are private — always.",
    bullets: ["WebSocket real-time messaging", "TweetNaCl E2E encryption", "Group & direct conversations", "Persistent message history"],
    accent: "#1e3a5f",
  },
  {
    emoji: "🏨",
    title: "Unified Booking Management",
    tag: "Bookings",
    desc: "Keep all your travel bookings in one dashboard. Flights, hotels, car rentals, and activities — no more context-switching between apps.",
    bullets: ["Flights, hotels, cars & activities", "Shared trip booking dashboard", "Upcoming booking reminders", "Group itinerary at a glance"],
    accent: "#3b2f00",
  },
  {
    emoji: "💰",
    title: "Shared Expense Tracking",
    tag: "Finance",
    desc: "Split costs fairly, scan receipts with AI, and keep a live view of who owes what. No spreadsheets. No awkward chases.",
    bullets: ["AI-powered receipt scanning (Gemini)", "Automatic cost splitting", "Group wallet & finance overview", "Expense history & export"],
    accent: "#2d1b4e",
  },
  {
    emoji: "📅",
    title: "Trip Calendar",
    tag: "Planning",
    desc: "Visualize your entire itinerary on a shared calendar. Coordinate check-ins, activities, and departures so no one gets left behind.",
    bullets: ["Shared group calendar", "Booking sync & event tagging", "Day-by-day itinerary view", "Conflict detection"],
    accent: "#1a3320",
  },
  {
    emoji: "🗳️",
    title: "Group Voting",
    tag: "Decisions",
    desc: "Can't agree on where to go or what to do? Let your group vote democratically — with polls built right into the platform.",
    bullets: ["Create polls for destinations & activities", "Real-time vote tallying", "Anonymous or named votes", "Decision history"],
    accent: "#3b1f1f",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Create a Trip Group", desc: "Start a new trip, name it, and invite your travel crew with one link." },
  { step: "02", title: "Plan Together", desc: "Use the map, calendar, and voting tools to shape your itinerary as a group." },
  { step: "03", title: "Book & Budget", desc: "Manage all bookings and split expenses from a single shared dashboard." },
  { step: "04", title: "Go & Stay in Sync", desc: "Navigate with live directions and stay connected via encrypted group chat on the go." },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Service() {
  const navigate = useNavigate();

  const [heroRef,  heroVisible]  = useScrollReveal(0.05);
  const [howRef,   howVisible]   = useScrollReveal(0.1);
  const [svcRef,   svcVisible]   = useScrollReveal(0.05);
  const [ctaRef,   ctaVisible]   = useScrollReveal(0.1);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fbfbf2" }}>
      <Navbar_Landing />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center px-6 py-28 overflow-hidden"
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
          What We Offer
        </p>
        <h1
          className="text-4xl sm:text-6xl font-bold leading-tight mb-6 max-w-3xl"
          style={{ ...reveal(heroVisible, 0.1), color: "#fbfbf2" }}
        >
          Every tool your trip needs,{" "}
          <span style={{ color: "#183a37" }}>built in.</span>
        </h1>
        <p
          className="text-base sm:text-lg max-w-xl leading-relaxed"
          style={{ ...reveal(heroVisible, 0.2), color: "#5c6b73" }}
        >
          Six powerful services. One platform. Built for groups who want to
          spend less time coordinating and more time exploring.
        </p>

        {/* Service pill tags */}
        <div style={reveal(heroVisible, 0.3)} className="mt-10 flex flex-wrap justify-center gap-3">
          {SERVICES.map(({ emoji, tag }) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border"
              style={{ borderColor: "#374151", color: "#9ca3af", background: "rgba(255,255,255,0.04)" }}
            >
              <span>{emoji}</span>{tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section ref={howRef} className="px-6 py-24" style={{ background: "#f0f0e8" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ ...reveal(howVisible, 0), color: "#183a37" }}
            >
              How It Works
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ ...reveal(howVisible, 0.1), color: "#160f29" }}
            >
              From zero to trip in four steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div
                key={step}
                className="relative rounded-2xl p-6 border"
                style={{ ...reveal(howVisible, 0.08 * i), background: "#fbfbf2", borderColor: "#d1d1c7" }}
              >
                {/* connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-10 -right-3 w-6 h-px"
                    style={{ background: "#d1d1c7", zIndex: 1 }}
                  />
                )}
                <p className="text-3xl font-black mb-4" style={{ color: "#e8e8e0" }}>{step}</p>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#160f29" }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#5c6b73" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────────── */}
      <section ref={svcRef} className="px-6 py-24 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ ...reveal(svcVisible, 0), color: "#183a37" }}
          >
            Our Services
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ ...reveal(svcVisible, 0.1), color: "#160f29" }}
          >
            Everything, in detail
          </h2>
        </div>

        <div className="space-y-8">
          {SERVICES.map(({ emoji, title, tag, desc, bullets, accent }, i) => {
            const isEven = i % 2 === 0;
            return (
              <div
                key={title}
                className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border"
                style={{ ...reveal(svcVisible, 0.06 * i), borderColor: "#d1d1c7" }}
              >
                {/* Color accent panel */}
                <div
                  className={`flex flex-col justify-center px-10 py-12 ${isEven ? "md:order-1" : "md:order-2"}`}
                  style={{ background: accent }}
                >
                  <div className="text-5xl mb-5">{emoji}</div>
                  <span
                    className="text-xs font-semibold uppercase tracking-widest mb-3 px-2.5 py-1 rounded-full w-fit"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(251,251,242,0.7)" }}
                  >
                    {tag}
                  </span>
                  <h3 className="text-xl font-bold leading-snug" style={{ color: "#fbfbf2" }}>
                    {title}
                  </h3>
                </div>

                {/* Content panel */}
                <div
                  className={`flex flex-col justify-center px-10 py-12 ${isEven ? "md:order-2" : "md:order-1"}`}
                  style={{ background: "#fbfbf2" }}
                >
                  <p className="text-sm leading-relaxed mb-6" style={{ color: "#5c6b73" }}>{desc}</p>
                  <ul className="space-y-2.5">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span
                          className="mt-1 w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                          style={{ background: accent }}
                        >
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M1 4l2.5 2.5L9 1" />
                          </svg>
                        </span>
                        <span className="text-sm" style={{ color: "#160f29" }}>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section
        ref={ctaRef}
        className="px-6 py-24 text-center"
        style={{ background: "#160f29" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ ...reveal(ctaVisible, 0), color: "#183a37" }}
        >
          Get Started
        </p>
        <h2
          className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl mx-auto leading-snug"
          style={{ ...reveal(ctaVisible, 0.1), color: "#fbfbf2" }}
        >
          All six services. One free account.
        </h2>
        <p
          className="text-base mb-10 max-w-md mx-auto"
          style={{ ...reveal(ctaVisible, 0.2), color: "#5c6b73" }}
        >
          Create your group, invite your crew, and start planning in minutes.
        </p>
        <div style={reveal(ctaVisible, 0.3)} className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate("/signup")}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition hover:opacity-90"
            style={{ background: "#fbfbf2", color: "#160f29" }}
          >
            Create an Account
          </button>
          <button
            onClick={() => navigate("/about")}
            className="px-8 py-3 rounded-xl font-semibold text-sm transition hover:opacity-80 border"
            style={{ borderColor: "#374151", color: "#fbfbf2" }}
          >
            Learn About Us
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
