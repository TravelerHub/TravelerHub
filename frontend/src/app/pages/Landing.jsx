import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

import HeroImage   from "../../assets/images/homepage_img.jpg";
import LandingImg1 from "../../assets/images/travelPic1.jpg";
import LandingImg2 from "../../assets/images/travelPic2.jpg";
import LandingImg3 from "../../assets/images/travelPic3.jpg";
import LandingImg4 from "../../assets/images/travelPic4.jpg";
import LandingImg5 from "../../assets/images/travelPic5.jpg";
import LandingImg6 from "../../assets/images/travelPic6.jpg";
import LandingImg7 from "../../assets/images/travelPic7.jpg";

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

function revealStyle(visible, delay = 0) {
  return {
    opacity:    visible ? 1 : 0,
    transform:  visible ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  };
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(end, active, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const steps    = Math.ceil(duration / 16);
    const increment = Math.ceil(end / steps);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setValue(end); clearInterval(timer); }
      else setValue(start);
    }, 16);
    return () => clearInterval(timer);
  }, [active, end, duration]);
  return value;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "✈️", title: "Book in one place",   desc: "Flights, hotels, cars — all managed without switching apps." },
  { icon: "👥", title: "Plan as a group",      desc: "Vote on destinations, split decisions, move faster together." },
  { icon: "💬", title: "Chat & decide",        desc: "Encrypted group chat built right into your trip." },
  { icon: "💸", title: "Split expenses",       desc: "Track costs and settle up without the awkward math." },
  { icon: "🗺️", title: "Navigate together",   desc: "Real-time maps and saved routes for the whole group." },
  { icon: "📸", title: "Capture memories",     desc: "Shared photos and receipts — automatically organized." },
];

const HOW_IT_WORKS = [
  { num: "01", icon: "🗺️", title: "Create your trip",  desc: "Add a destination, travel dates, and invite your group in under a minute." },
  { num: "02", icon: "📋", title: "Plan together",      desc: "Vote on places, book flights and hotels, and share ideas in real-time." },
  { num: "03", icon: "🎉", title: "Travel & track",     desc: "Live maps, expense splits, and shared memories — all in one place." },
];

const MARQUEE_ITEMS = [
  "Tokyo", "Paris", "Bali", "New York", "Santorini", "Kyoto",
  "Cape Town", "Barcelona", "Maldives", "Patagonia", "Dubai", "Iceland",
  "Amalfi Coast", "Machu Picchu", "Queenstown", "Marrakech",
];

// ── Bento photo grid data ─────────────────────────────────────────────────────
const BENTO_TOP = [
  { img: LandingImg7, title: "Coastal Escapes",    tag: "Sun + water",     span: "col-span-2" },
  { img: LandingImg5, title: "Mountain Mornings",  tag: "Hikes + views",   span: "row-span-2", tall: true },
];
const BENTO_BOTTOM = [
  { img: LandingImg1, title: "City Nights",        tag: "Food + lights"   },
  { img: LandingImg4, title: "Big Adventures",     tag: "Go all in"       },
];
const BENTO_ROW3 = [
  { img: LandingImg6, title: "Hidden Gems",        tag: "Local favorites" },
  { img: LandingImg2, title: "Weekend Getaways",   tag: "Quick reset"     },
  { img: LandingImg3, title: "Urban Escapes",      tag: "New perspectives"},
];

// ── Photo card ────────────────────────────────────────────────────────────────
function PhotoCard({ img, title, tag, className = "", height = "h-64" }) {
  return (
    <div className={`group rounded-3xl overflow-hidden relative cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 ${className} ${height}`}>
      <img
        src={img}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      {/* base gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      {/* teal tint on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: "rgba(24,58,55,0.28)" }}
      />
      <div className="absolute bottom-5 left-5">
        <p className="text-white font-bold text-lg leading-tight translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
          {title}
        </p>
        <p className="text-white/70 text-sm mt-0.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
          {tag}
        </p>
      </div>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const [statsRef,  statsVisible]  = useScrollReveal();
  const [howRef,    howVisible]    = useScrollReveal();
  const [featRef,   featVisible]   = useScrollReveal();
  const [quoteRef,  quoteVisible]  = useScrollReveal();
  const [gridRef,   gridVisible]   = useScrollReveal();
  const [ctaRef,    ctaVisible]    = useScrollReveal();

  const c1 = useCounter(500,   statsVisible);
  const c2 = useCounter(50,    statsVisible);
  const c3 = useCounter(10000, statsVisible);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#fbfbf2" }}>
      <Navbar_Landing />

      <main className="flex flex-col">

        {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-[94vh] flex items-center justify-center text-white overflow-hidden">

          {/* Ken-Burns background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${HeroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "kenBurns 22s ease-in-out infinite alternate",
            }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/85" />

          {/* Ambient orbs — teal palette */}
          <div
            className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(24,58,55,0.18)", animation: "floatOrb 9s ease-in-out infinite" }}
          />
          <div
            className="absolute bottom-1/3 right-1/5 w-96 h-96 rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(255,255,255,0.05)", animation: "floatOrb 14s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute top-1/2 right-1/3 w-52 h-52 rounded-full blur-2xl pointer-events-none"
            style={{ background: "rgba(24,58,55,0.12)", animation: "floatOrb 7s ease-in-out infinite 2s" }}
          />

          {/* ── Floating trip card (desktop left) ── */}
          <div
            className="absolute left-8 xl:left-20 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3 pointer-events-none"
            style={{
              animation: "floatOrb 12s ease-in-out infinite",
              opacity: heroReady ? 1 : 0,
              transition: "opacity 1s ease 0.8s",
            }}
          >
            {/* Trip summary card */}
            <div
              className="rounded-2xl p-5 w-72"
              style={{
                background: "rgba(22,15,41,0.55)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: "#183a37" }}
                  >
                    ✈️
                  </span>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">Tokyo Adventure</p>
                    <p className="text-white/45 text-xs">4 travelers · Apr 12–19</p>
                  </div>
                </div>
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                  style={{ background: "rgba(24,58,55,0.7)", color: "#6ee7b7" }}
                >
                  Active
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Flight",   val: "Confirmed ✓", green: true  },
                  { label: "Hotel",    val: "Booked ✓",    green: true  },
                  { label: "Budget",   val: "$1,240 / $1,500", green: false },
                ].map(({ label, val, green }) => (
                  <div key={label} className="flex justify-between items-center">
                    <p className="text-white/45 text-xs">{label}</p>
                    <p className="text-xs font-medium" style={{ color: green ? "#6ee7b7" : "#ffffff" }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: "83%", background: "#183a37" }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-white/35 text-[10px]">83% planned</p>
                <p className="text-white/35 text-[10px]">6 days left</p>
              </div>
            </div>

            {/* Mini weather chip */}
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: "rgba(22,15,41,0.5)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-2xl">⛅</span>
              <div>
                <p className="text-white text-sm font-semibold">72°F · Tokyo</p>
                <p className="text-white/45 text-xs">Partly cloudy · Thu</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-white/45 text-[10px]">3 more days</p>
                <p className="text-[10px] font-medium" style={{ color: "#6ee7b7" }}>68–75°F</p>
              </div>
            </div>

            {/* Group avatars chip */}
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-3"
              style={{
                background: "rgba(22,15,41,0.5)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex -space-x-2">
                {["A","J","K","M"].map((l) => (
                  <div
                    key={l}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2"
                    style={{ background: "#183a37", color: "#ffffff", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-xs">4 travelers are ready</p>
            </div>
          </div>

          {/* ── Hero text (right-aligned) ── */}
          <div className="relative max-w-6xl w-full mx-auto px-6 lg:pl-80 xl:pl-0">
            <div style={revealStyle(heroReady, 0.15)}>
              <h1 className="landing-header text-right">Go Where</h1>
              <h1 className="landing-header text-right">You Choose.</h1>
            </div>

            <p
              className="mt-6 text-white/70 text-lg text-right max-w-md ml-auto leading-relaxed"
              style={revealStyle(heroReady, 0.45)}
            >
              Plan trips with your group — destinations, bookings, expenses,
              and memories all in one place.
            </p>

            <div className="mt-8 flex justify-end gap-3" style={revealStyle(heroReady, 0.7)}>
              <button
                onClick={() => navigate("/signup")}
                className="px-8 py-3.5 rounded-xl font-semibold text-black transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                style={{
                  background: "#fbfbf2",
                  animation: heroReady ? "tealPulse 3s ease-in-out 2s infinite" : "none",
                }}
              >
                Start Planning
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-8 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "rgba(24,58,55,0.5)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                Log In
              </button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1.5 text-white/45 pointer-events-none"
            style={{ animation: "scrollBounce 2.2s ease-in-out infinite" }}
          >
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        {/* ══ MARQUEE STRIP ════════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden border-y py-4"
          style={{ background: "#160f29", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex gap-10 whitespace-nowrap"
            style={{ animation: "marquee 28s linear infinite" }}
          >
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((name, i) => (
              <span
                key={i}
                className="flex items-center gap-2.5 text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                <span style={{ color: "#183a37" }}>✦</span>
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* ══ STATS STRIP ══════════════════════════════════════════════════════ */}
        <section ref={statsRef} style={{ background: "#000000" }}>
          <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-3 gap-6 text-center">
            {[
              { count: c1, suffix: "+",  label: "Trips Planned"   },
              { count: c2, suffix: "+",  label: "Destinations"    },
              { count: c3, suffix: "",   label: "Happy Travelers", prefix: "" },
            ].map(({ count, suffix, label, prefix = "" }, i) => (
              <div
                key={label}
                style={{
                  animation: statsVisible
                    ? `countUp 0.6s ease ${i * 0.15}s both`
                    : "none",
                }}
              >
                <p className="text-3xl md:text-4xl font-bold text-white">
                  {prefix}
                  {label === "Happy Travelers"
                    ? count >= 10000 ? "10k" : count >= 1000 ? `${(count / 1000).toFixed(0)}k` : count
                    : count}
                  {suffix}
                </p>
                <p
                  className="text-xs mt-2 tracking-widest uppercase font-medium"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ HOW IT WORKS ═════════════════════════════════════════════════════ */}
        <section ref={howRef} style={{ background: "#fbfbf2" }}>
          <div className="max-w-6xl mx-auto px-6 py-20">

            <div className="text-center mb-14" style={revealStyle(howVisible)}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#183a37" }}
              >
                Simple as 1–2–3
              </p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#160f29" }}>
                How TravelHub works
              </h2>
              <p className="mt-3 text-sm max-w-md mx-auto leading-relaxed" style={{ color: "#5c6b73" }}>
                From the first idea to the last memory — a single platform that covers every step.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
              {/* Connecting line */}
              <div
                className="hidden md:block absolute top-10 left-[38%] right-[38%] h-px"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(24,58,55,0.4), transparent)",
                  animation: howVisible ? "stepLine 1s ease 0.3s both" : "none",
                }}
              />

              {HOW_IT_WORKS.map((step, i) => (
                <div
                  key={step.num}
                  className="flex flex-col items-center text-center"
                  style={revealStyle(howVisible, i * 0.18)}
                >
                  <div className="relative mb-6">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl"
                      style={{
                        background: "#160f29",
                        animation: howVisible ? `tealPulse 3s ease ${i * 0.4 + 0.5}s infinite` : "none",
                      }}
                    >
                      {step.icon}
                    </div>
                    <span
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: "#183a37" }}
                    >
                      {step.num}
                    </span>
                  </div>
                  <p className="text-lg font-bold mb-2" style={{ color: "#160f29" }}>{step.title}</p>
                  <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#5c6b73" }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FEATURES ═════════════════════════════════════════════════════════ */}
        <section style={{ background: "#000000", color: "#ffffff" }}>
          <div className="max-w-6xl mx-auto px-6 py-20">

            <div ref={featRef} className="text-center" style={revealStyle(featVisible)}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#6ee7b7" }}
              >
                Built for travelers
              </p>
              <h2 className="text-3xl md:text-4xl font-bold">Everything your trip needs.</h2>
              <p className="mt-4 max-w-xl mx-auto leading-relaxed text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                From the first idea to the last receipt — built for groups who want to travel better.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 cursor-default"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    ...revealStyle(featVisible, i * 0.08),
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(24,58,55,0.2)";
                    e.currentTarget.style.borderColor = "rgba(24,58,55,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                  }}
                >
                  <span className="text-2xl">{f.icon}</span>
                  <p className="mt-3 font-semibold text-white">{f.title}</p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Feature image banner */}
            <div
              className="mt-16 relative rounded-3xl overflow-hidden shadow-2xl"
              style={{
                border: "1px solid rgba(255,255,255,0.07)",
                ...revealStyle(featVisible, 0.5),
              }}
            >
              <img
                src={LandingImg2}
                alt="Travel preview"
                className="w-full h-[380px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div
                className="absolute inset-0 opacity-40"
                style={{ background: "linear-gradient(135deg, rgba(24,58,55,0.4) 0%, transparent 60%)" }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                <p className="text-2xl md:text-3xl font-bold text-white">Build memories, not spreadsheets.</p>
                <p className="text-sm mt-2 max-w-md" style={{ color: "rgba(255,255,255,0.6)" }}>
                  A clean, simple space to plan the trip you actually want.
                </p>
                <button
                  onClick={() => navigate("/signup")}
                  className="mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: "#183a37", border: "1px solid rgba(110,231,183,0.2)" }}
                >
                  Start for free →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ══ QUOTE ════════════════════════════════════════════════════════════ */}
        <section ref={quoteRef} style={{ background: "#fbfbf2" }}>
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div
              className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
              style={{
                background: "#160f29",
                ...revealStyle(quoteVisible),
              }}
            >
              {/* Teal ambient glow */}
              <div
                className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(24,58,55,0.5)", transform: "translate(30%, -40%)" }}
              />
              <div
                className="absolute bottom-0 left-0 w-60 h-60 rounded-full blur-3xl pointer-events-none"
                style={{ background: "rgba(24,58,55,0.3)", transform: "translate(-25%, 40%)" }}
              />

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-5"
                    style={{ color: "#6ee7b7" }}
                  >
                    Our philosophy
                  </p>
                  <p className="text-3xl md:text-4xl font-bold text-white leading-tight">
                    &ldquo;Collect moments,<br />not things.&rdquo;
                  </p>
                  <p className="mt-5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Your next adventure doesn&rsquo;t start at the airport —
                    it starts with a plan. TravelHub helps you turn inspiration
                    into a trip everyone can enjoy together.
                  </p>
                  <button
                    onClick={() => navigate("/about")}
                    className="mt-7 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 hover:gap-3"
                    style={{ color: "#6ee7b7" }}
                  >
                    About us →
                  </button>
                </div>

                {/* Quote photo */}
                <div className="rounded-2xl overflow-hidden h-60 md:h-72 relative">
                  <img
                    src={LandingImg6}
                    alt="Travel"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "rgba(24,58,55,0.25)" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PHOTO MOSAIC ═════════════════════════════════════════════════════ */}
        <section style={{ background: "#ffffff" }}>
          <div className="max-w-6xl mx-auto px-6 pb-20">

            <div
              ref={gridRef}
              className="flex items-end justify-between gap-6 mb-10"
              style={revealStyle(gridVisible)}
            >
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#183a37" }}
                >
                  Explore vibes
                </p>
                <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#160f29" }}>
                  Find your next destination
                </h2>
                <p className="mt-3 text-sm max-w-md leading-relaxed" style={{ color: "#5c6b73" }}>
                  Beaches, cities, mountains — start with inspiration and turn it into a real plan.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="hidden md:inline-flex px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shrink-0"
                style={{ background: "#160f29" }}
              >
                Explore all →
              </button>
            </div>

            {/* Row 1: big (col-span-2) + tall (row-span-2 implicitly via CSS) */}
            <div
              className="grid grid-cols-3 gap-4"
              style={revealStyle(gridVisible, 0.1)}
            >
              {/* Wide tile */}
              <div className="col-span-2">
                <PhotoCard img={LandingImg7} title="Coastal Escapes" tag="Sun + water" height="h-72" />
              </div>
              {/* Tall tile */}
              <div className="row-span-2" style={{ gridRow: "1 / 3" }}>
                <PhotoCard img={LandingImg5} title="Mountain Mornings" tag="Hikes + views" height="h-full" className="min-h-[592px]" />
              </div>
              {/* Two smaller tiles in row 2 */}
              <PhotoCard img={LandingImg1} title="City Nights"    tag="Food + lights"  height="h-72" style={revealStyle(gridVisible, 0.18)} />
              <PhotoCard img={LandingImg4} title="Big Adventures" tag="Go all in"       height="h-72" style={revealStyle(gridVisible, 0.22)} />
            </div>

            {/* Row 3: three equal */}
            <div
              className="grid grid-cols-3 gap-4 mt-4"
              style={revealStyle(gridVisible, 0.3)}
            >
              <PhotoCard img={LandingImg6} title="Hidden Gems"     tag="Local favorites"  height="h-56" />
              <PhotoCard img={LandingImg2} title="Weekend Getaways" tag="Quick reset"       height="h-56" />
              <PhotoCard img={LandingImg3} title="Urban Escapes"   tag="New perspectives" height="h-56" />
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section
          ref={ctaRef}
          className="relative overflow-hidden text-white"
          style={{
            background: "#000000",
            ...revealStyle(ctaVisible),
          }}
        >
          {/* Teal orbs */}
          <div
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(24,58,55,0.25)", transform: "translateY(-50%)" }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(24,58,55,0.18)", transform: "translateY(50%)" }}
          />

          <div className="relative max-w-6xl mx-auto px-6 py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

              {/* Left text */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-4"
                  style={{ color: "#6ee7b7" }}
                >
                  Ready to explore?
                </p>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  Your next trip<br />starts here.
                </h2>
                <p className="mt-5 text-sm leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Join thousands of travelers who plan smarter, split easier,
                  and stress less with TravelHub.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate("/signup")}
                    className="px-8 py-3.5 rounded-xl font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
                    style={{ background: "#fbfbf2" }}
                  >
                    Get Started — It&rsquo;s Free
                  </button>
                  <button
                    onClick={() => navigate("/about")}
                    className="px-8 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: "rgba(24,58,55,0.45)", border: "1px solid rgba(24,58,55,0.8)" }}
                  >
                    Learn More
                  </button>
                </div>

                {/* Trust indicators */}
                <div className="mt-8 flex items-center gap-4 flex-wrap">
                  {["No credit card", "Free forever plan", "Instant setup"].map((txt) => (
                    <span key={txt} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span style={{ color: "#6ee7b7" }}>✓</span> {txt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right image collage */}
              <div className="hidden md:grid grid-cols-2 gap-3 h-72">
                <div className="rounded-2xl overflow-hidden row-span-2">
                  <img src={LandingImg4} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="rounded-2xl overflow-hidden">
                  <img src={LandingImg3} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="rounded-2xl overflow-hidden">
                  <img src={LandingImg1} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
