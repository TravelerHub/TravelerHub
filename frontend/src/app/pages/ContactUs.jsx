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
const CONTACT_CHANNELS = [
  {
    emoji: "📧",
    title: "Email Us",
    desc: "For general inquiries and support questions.",
    value: "support@travelhub.app",
    action: "mailto:support@travelhub.app",
    actionLabel: "Send an email",
  },
  {
    emoji: "🐛",
    title: "Bug Reports",
    desc: "Found something broken? Let us know directly.",
    value: "bugs@travelhub.app",
    action: "mailto:bugs@travelhub.app",
    actionLabel: "Report a bug",
  },
  {
    emoji: "🎓",
    title: "Academic Inquiries",
    desc: "CSULB CECS 491 — reach out about the project.",
    value: "cecs491@csulb.edu",
    action: "mailto:cecs491@csulb.edu",
    actionLabel: "Contact the team",
  },
];

const FAQS = [
  {
    q: "Is TravelHub free to use?",
    a: "Yes — TravelHub is completely free. Create an account, start a trip group, and invite your crew at no cost.",
  },
  {
    q: "How many people can be in a trip group?",
    a: "There's no hard limit on group size. TravelHub is designed to scale from a duo weekend trip to a large family reunion.",
  },
  {
    q: "Is my data and chat private?",
    a: "All group chat messages are end-to-end encrypted using TweetNaCl. Your conversations are private and cannot be read by anyone outside your group.",
  },
  {
    q: "Can I use TravelHub on mobile?",
    a: "TravelHub is a responsive web app and works great in any mobile browser. A dedicated mobile app is on the roadmap.",
  },
  {
    q: "How does expense splitting work?",
    a: "Add expenses manually or scan a receipt with the AI scanner. TravelHub calculates each person's share and tracks who has paid.",
  },
  {
    q: "I found a bug — how do I report it?",
    a: "Email bugs@travelhub.app or use the Feedback page. Include steps to reproduce and we'll get on it quickly.",
  },
];

const SUBJECTS = ["General Question", "Technical Support", "Bug Report", "Partnership", "Feature Request", "Other"];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ContactUs() {
  const navigate = useNavigate();

  const [heroRef,    heroVisible]    = useScrollReveal(0.05);
  const [channelRef, channelVisible] = useScrollReveal(0.1);
  const [formRef,    formVisible]    = useScrollReveal(0.1);
  const [faqRef,     faqVisible]     = useScrollReveal(0.08);

  // Form state
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [subject,   setSubject]   = useState("General Question");
  const [message,   setMessage]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim())    { setError("Please enter your name.");    return; }
    if (!email.trim())   { setError("Please enter your email.");   return; }
    if (!message.trim()) { setError("Please write your message."); return; }
    setError("");
    setLoading(true);
    // Simulate async submit — wire to your backend endpoint here
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setName("");
    setEmail("");
    setSubject("General Question");
    setMessage("");
    setError("");
  };

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
          Get in Touch
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold leading-tight mb-5 max-w-2xl"
          style={{ ...reveal(heroVisible, 0.1), color: "#fbfbf2" }}
        >
          We'd love to{" "}
          <span style={{ color: "#183a37" }}>hear from you</span>
        </h1>
        <p
          className="text-base max-w-lg leading-relaxed"
          style={{ ...reveal(heroVisible, 0.2), color: "#5c6b73" }}
        >
          Whether you have a question, ran into a bug, or just want to say hello
          — our team is reachable and responsive.
        </p>
      </section>

      {/* ── CONTACT CHANNELS ─────────────────────────────────────────────────── */}
      <section ref={channelRef} className="px-6 py-16" style={{ background: "#f0f0e8" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CONTACT_CHANNELS.map(({ emoji, title, desc, value, action, actionLabel }, i) => (
            <div
              key={title}
              className="rounded-2xl border p-6 flex flex-col gap-3"
              style={{ ...reveal(channelVisible, 0.08 * i), background: "#fbfbf2", borderColor: "#d1d1c7" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "#e8e8e0" }}
              >
                {emoji}
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#160f29" }}>{title}</p>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "#5c6b73" }}>{desc}</p>
                <p className="text-xs font-medium mb-3" style={{ color: "#160f29" }}>{value}</p>
              </div>
              <a
                href={action}
                className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-70"
                style={{ color: "#183a37" }}
              >
                {actionLabel}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORM + FAQ ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* ── Contact Form ── */}
          <div ref={formRef}>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ ...reveal(formVisible, 0), color: "#183a37" }}
            >
              Send a Message
            </p>
            <h2
              className="text-2xl font-bold mb-8"
              style={{ ...reveal(formVisible, 0.1), color: "#160f29" }}
            >
              Drop us a line
            </h2>

            {submitted ? (
              <div
                className="rounded-2xl border p-10 text-center"
                style={{ background: "#fff", borderColor: "#d1d1c7" }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-5"
                  style={{ background: "#f0f0e8" }}
                >
                  ✅
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#160f29" }}>Message sent!</h3>
                <p className="text-sm mb-7" style={{ color: "#5c6b73" }}>
                  We'll get back to you within 1–2 business days.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-80"
                    style={{ background: "#183a37" }}
                  >
                    Send Another
                  </button>
                  <button
                    onClick={() => navigate("/")}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80 border"
                    style={{ borderColor: "#d1d1c7", color: "#160f29" }}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: "#d1d1c7" }}
              >
                {/* Dark header */}
                <div className="px-7 py-5 border-b" style={{ background: "#160f29", borderColor: "#374151" }}>
                  <p className="text-sm font-bold" style={{ color: "#fbfbf2" }}>Contact Form</p>
                  <p className="text-xs mt-0.5" style={{ color: "#5c6b73" }}>
                    Fields marked <span style={{ color: "#ef4444" }}>*</span> are required
                  </p>
                </div>

                <div className="px-7 py-7 space-y-5" style={{ background: "#fff" }}>

                  {/* Name + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#160f29" }}>
                        Name <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                        style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#160f29" }}>
                        Email <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                        style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#160f29" }}>
                      Subject <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSubject(s)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                          style={{
                            background: subject === s ? "#183a37" : "#f0f0e8",
                            color:      subject === s ? "#fbfbf2" : "#5c6b73",
                            border:     subject === s ? "1px solid #183a37" : "1px solid #d1d1c7",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "#160f29" }}>
                      Message <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition resize-none"
                      style={{ background: "#f0f0e8", color: "#160f29", border: "1px solid #d1d1c7" }}
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      {error}
                    </p>
                  )}

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
                        Sending…
                      </span>
                    ) : "Send Message"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── FAQ ── */}
          <div ref={faqRef}>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ ...reveal(faqVisible, 0), color: "#183a37" }}
            >
              FAQ
            </p>
            <h2
              className="text-2xl font-bold mb-8"
              style={{ ...reveal(faqVisible, 0.1), color: "#160f29" }}
            >
              Common questions
            </h2>

            <div className="space-y-3">
              {FAQS.map(({ q, a }, i) => (
                <div
                  key={q}
                  className="rounded-2xl border overflow-hidden"
                  style={{ ...reveal(faqVisible, 0.06 * i), borderColor: "#d1d1c7" }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left transition hover:bg-black/2"
                    style={{ background: "#fff" }}
                  >
                    <span className="text-sm font-semibold pr-4" style={{ color: "#160f29" }}>{q}</span>
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform"
                      style={{
                        background: openFaq === i ? "#183a37" : "#e8e8e0",
                        transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={openFaq === i ? "#fbfbf2" : "#5c6b73"} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </button>

                  {openFaq === i && (
                    <div
                      className="px-5 pb-5 pt-1 border-t"
                      style={{ background: "#fafafa", borderColor: "#e8e8e0" }}
                    >
                      <p className="text-sm leading-relaxed" style={{ color: "#5c6b73" }}>{a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs mt-6" style={{ color: "#5c6b73" }}>
              Still have questions?{" "}
              <button
                onClick={() => navigate("/feedback")}
                className="underline underline-offset-2 transition hover:opacity-70"
                style={{ color: "#183a37" }}
              >
                Leave us feedback
              </button>{" "}
              or email us directly.
            </p>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
