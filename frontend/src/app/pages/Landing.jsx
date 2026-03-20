import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

import HeroImage  from "../../assets/images/homepage_img.jpg";
import LandingImg1 from "../../assets/images/travelPic1.jpg";
import LandingImg2 from "../../assets/images/travelPic2.jpg";
import LandingImg3 from "../../assets/images/travelPic7.jpg";
import LandingImg4 from "../../assets/images/travelPic4.jpg";
import LandingImg5 from "../../assets/images/travelPic5.jpg";
import LandingImg6 from "../../assets/images/travelPic6.jpg";

// Scroll-reveal hook — fires once when element enters viewport
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, visible];
}

// Inline reveal style — avoids duplicating the same object everywhere
function revealStyle(visible, delay = 0) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  };
}

const FEATURES = [
  { icon: "✈️", title: "Book in one place",    desc: "Flights, hotels, cars — managed without switching apps." },
  { icon: "👥", title: "Plan as a group",       desc: "Vote on destinations, split decisions, move faster together." },
  { icon: "💬", title: "Chat & decide",         desc: "Encrypted group chat built right into your trip." },
  { icon: "💸", title: "Split expenses",        desc: "Track costs and settle up without the awkward math." },
  { icon: "🗺️", title: "Navigate together",    desc: "Real-time maps and saved routes for the whole group." },
  { icon: "📸", title: "Capture memories",      desc: "Shared photos and receipts — automatically organized." },
];

const DESTINATIONS = [
  { title: "Coastal escapes",   tag: "Sun + water",      image: LandingImg3 },
  { title: "City nights",       tag: "Food + lights",    image: LandingImg1 },
  { title: "Mountain mornings", tag: "Hikes + views",    image: LandingImg5 },
  { title: "Hidden gems",       tag: "Local favorites",  image: LandingImg6 },
  { title: "Weekend getaways",  tag: "Quick reset",      image: LandingImg2 },
  { title: "Big adventures",    tag: "Go all in",        image: LandingImg4 },
];

function Landing() {
  const navigate = useNavigate();

  // Hero text animates in slightly after mount
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const [statsRef,    statsVisible]    = useScrollReveal();
  const [featRef,     featVisible]     = useScrollReveal();
  const [quoteRef,    quoteVisible]    = useScrollReveal();
  const [gridRef,     gridVisible]     = useScrollReveal();
  const [ctaRef,      ctaVisible]      = useScrollReveal();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar_Landing />

      <main className="flex flex-col">

        {/* ── HERO ────────────────────────────────────── */}
        <section className="relative min-h-[92vh] flex items-center justify-center text-white overflow-hidden">

          {/* Ken-Burns background image */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${HeroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "kenBurns 22s ease-in-out infinite alternate",
            }}
          />

          {/* Gradient overlay — dark at bottom for legibility */}
          <div className="absolute inset-0 bg-linear-to-b from-black/25 via-black/40 to-black/80" />

          {/* Floating ambient orbs */}
          <div
            className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"
            style={{ animation: "floatOrb 9s ease-in-out infinite" }}
          />
          <div
            className="absolute bottom-1/3 right-1/5 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none"
            style={{ animation: "floatOrb 14s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute top-1/2 right-1/3 w-52 h-52 rounded-full bg-indigo-400/10 blur-2xl pointer-events-none"
            style={{ animation: "floatOrb 7s ease-in-out infinite 2s" }}
          />

          {/* Hero content */}
          <div className="relative max-w-6xl w-full mx-auto px-6">
            <div style={revealStyle(heroReady, 0.15)}>
             
              <h1 className="landing-header text-right">Go Where</h1>
              <h1 className="landing-header text-right">You Choose.</h1>
            </div>

            <p
              className="mt-6 text-white/75 text-lg text-right max-w-md ml-auto leading-relaxed"
              style={revealStyle(heroReady, 0.45)}
            >
              Plan trips with your group — destinations, bookings, expenses,
              and memories all in one place.
            </p>

            <div
              className="mt-8 flex justify-end gap-3"
              style={revealStyle(heroReady, 0.7)}
            >
              <button
                onClick={() => navigate("/signup")}
                className="px-8 py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-indigo-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Start Planning
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-8 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all duration-200"
              >
                Log In
              </button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1.5 text-white/50 pointer-events-none"
            style={{ animation: "scrollBounce 2.2s ease-in-out infinite" }}
          >
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        {/* ── STATS STRIP ─────────────────────────────── */}
        <section
          ref={statsRef}
          className="bg-black border-b border-white/10"
          style={revealStyle(statsVisible)}
        >
          <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-3 gap-6 text-center">
            {[
              { num: "500+",  label: "Trips Planned" },
              { num: "50+",   label: "Destinations" },
              { num: "10k+",  label: "Happy Travelers" },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="text-3xl md:text-4xl font-bold text-white">{num}</p>
                <p className="text-white/45 text-xs mt-1.5 tracking-widest uppercase">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────── */}
        <section className="bg-black text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">

            {/* Heading */}
            <div ref={featRef} style={revealStyle(featVisible)} className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold">
                Everything your trip needs.
              </h2>
              <p className="mt-4 text-white/55 max-w-xl mx-auto leading-relaxed">
                From the first idea to the last receipt — built for groups
                who want to travel better.
              </p>
            </div>

            {/* Feature cards — stagger reveal */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                  style={revealStyle(featVisible, i * 0.08)}
                >
                  <span className="text-2xl">{f.icon}</span>
                  <p className="mt-3 font-semibold text-white">{f.title}</p>
                  <p className="mt-2 text-sm text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Feature image banner */}
            <div
              className="mt-16 relative rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              style={revealStyle(featVisible, 0.5)}
            >
              <img
                src={LandingImg2}
                alt="Travel preview"
                className="w-full h-[380px] object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <p className="text-2xl font-bold">Build memories, not spreadsheets.</p>
                <p className="text-white/65 text-sm mt-2">
                  A clean, simple space to plan the trip you actually want.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── QUOTE ───────────────────────────────────── */}
        <section className="bg-white" ref={quoteRef}>
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div
              className="rounded-3xl bg-black text-white p-10 md:p-14 relative overflow-hidden"
              style={revealStyle(quoteVisible)}
            >
              {/* Ambient glow decorations */}
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-indigo-600/15 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-indigo-400/10 blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

              <p className="text-indigo-400 text-xs font-medium tracking-widest uppercase">
                Travel quote
              </p>
              <p className="mt-5 text-4xl md:text-5xl font-bold leading-tight">
                "Collect moments,<br />not things."
              </p>
              <p className="mt-6 text-white/60 max-w-2xl leading-relaxed">
                Your next adventure doesn't start at the airport — it starts with a plan.
                TravelHub helps you turn inspiration into a trip everyone can enjoy.
              </p>
            </div>
          </div>
        </section>

        {/* ── PHOTO GRID ──────────────────────────────── */}
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-6 pb-20">

            <div
              ref={gridRef}
              className="flex items-end justify-between gap-6"
              style={revealStyle(gridVisible)}
            >
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-black">
                  Find your next vibe
                </h2>
                <p className="mt-3 text-black/55 max-w-xl">
                  Beaches, cities, mountains — start with inspiration and turn it into a plan.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="hidden md:inline-flex px-6 py-3 rounded-xl bg-black text-white font-semibold hover:bg-indigo-600 transition-all duration-200"
              >
                Explore →
              </button>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {DESTINATIONS.map((card, i) => (
                <div
                  key={card.title}
                  className="group rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
                  style={revealStyle(gridVisible, i * 0.09)}
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {/* base gradient */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                    {/* hover indigo tint */}
                    <div className="absolute inset-0 bg-indigo-900/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* text — title always visible, tag slides in on hover */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-white font-bold text-xl translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        {card.title}
                      </p>
                      <p className="text-white/75 text-sm mt-1 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
                        {card.tag}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────── */}
        <section
          ref={ctaRef}
          className="bg-black text-white relative overflow-hidden"
          style={revealStyle(ctaVisible)}
        >
          {/* Background orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-indigo-500/8 blur-3xl translate-y-1/2 pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
            <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-4">
              Ready to explore?
            </p>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Your next trip starts here.
            </h2>
            <p className="mt-5 text-white/55 text-lg max-w-xl mx-auto leading-relaxed">
              Join thousands of travelers who plan smarter, split easier,
              and stress less with TravelHub.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate("/signup")}
                className="px-10 py-4 rounded-xl bg-white text-black font-semibold text-lg hover:bg-indigo-50 transition-all duration-200 hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                Get Started — It's Free
              </button>
              <button
                onClick={() => navigate("/about")}
                className="px-10 py-4 rounded-xl border border-white/20 text-white font-semibold text-lg hover:bg-white/10 transition-all duration-200"
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

export default Landing;
