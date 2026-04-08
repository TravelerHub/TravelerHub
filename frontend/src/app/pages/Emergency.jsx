import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";

// ── Color palette (matches Dashboard / Booking)
// #000000  sidebar bg
// #f3f4f6  page bg
// #ffffff  card bg
// #160f29  deep dark headings
// #6b7280  secondary text
// #374151  borders
// #dc2626  emergency red
// #f59e0b  warning amber

// ── Emergency numbers dataset ─────────────────────────────────────────────────
const EMERGENCY_DB = [
  { country: "United States",     flag: "🇺🇸", police: "911",  ambulance: "911",  fire: "911",  other: "211 (social services)" },
  { country: "United Kingdom",    flag: "🇬🇧", police: "999",  ambulance: "999",  fire: "999",  other: "112 (EU standard)"     },
  { country: "Australia",         flag: "🇦🇺", police: "000",  ambulance: "000",  fire: "000",  other: "112 (mobile)"          },
  { country: "Canada",            flag: "🇨🇦", police: "911",  ambulance: "911",  fire: "911",  other: "811 (health line)"     },
  { country: "Germany",           flag: "🇩🇪", police: "110",  ambulance: "112",  fire: "112",  other: "116 117 (doctor)"      },
  { country: "France",            flag: "🇫🇷", police: "17",   ambulance: "15",   fire: "18",   other: "112 (EU standard)"     },
  { country: "Japan",             flag: "🇯🇵", police: "110",  ambulance: "119",  fire: "119",  other: "189 (child abuse)"     },
  { country: "South Korea",       flag: "🇰🇷", police: "112",  ambulance: "119",  fire: "119",  other: "1339 (medical info)"   },
  { country: "China",             flag: "🇨🇳", police: "110",  ambulance: "120",  fire: "119",  other: "122 (traffic)"         },
  { country: "India",             flag: "🇮🇳", police: "100",  ambulance: "108",  fire: "101",  other: "112 (national)"        },
  { country: "Brazil",            flag: "🇧🇷", police: "190",  ambulance: "192",  fire: "193",  other: "191 (highway patrol)"  },
  { country: "Mexico",            flag: "🇲🇽", police: "911",  ambulance: "911",  fire: "911",  other: "800 (consumer)"        },
  { country: "Italy",             flag: "🇮🇹", police: "113",  ambulance: "118",  fire: "115",  other: "112 (EU standard)"     },
  { country: "Spain",             flag: "🇪🇸", police: "091",  ambulance: "112",  fire: "080",  other: "016 (domestic abuse)"  },
  { country: "Netherlands",       flag: "🇳🇱", police: "0900-8844", ambulance: "112", fire: "112", other: "112 (EU standard)" },
  { country: "Sweden",            flag: "🇸🇪", police: "112",  ambulance: "112",  fire: "112",  other: "1177 (nurse)"          },
  { country: "Norway",            flag: "🇳🇴", police: "112",  ambulance: "113",  fire: "110",  other: "116 117 (doctor)"      },
  { country: "Switzerland",       flag: "🇨🇭", police: "117",  ambulance: "144",  fire: "118",  other: "145 (poison)"          },
  { country: "New Zealand",       flag: "🇳🇿", police: "111",  ambulance: "111",  fire: "111",  other: "105 (non-urgent)"      },
  { country: "Singapore",         flag: "🇸🇬", police: "999",  ambulance: "995",  fire: "995",  other: "1800-255-0000"         },
  { country: "Thailand",          flag: "🇹🇭", police: "191",  ambulance: "1669", fire: "199",  other: "1155 (tourist police)" },
  { country: "Philippines",       flag: "🇵🇭", police: "117",  ambulance: "911",  fire: "911",  other: "143 (DSWD)"            },
  { country: "Indonesia",         flag: "🇮🇩", police: "110",  ambulance: "118",  fire: "113",  other: "119 (emergency)"       },
  { country: "UAE",               flag: "🇦🇪", police: "999",  ambulance: "998",  fire: "997",  other: "996 (coast guard)"     },
  { country: "South Africa",      flag: "🇿🇦", police: "10111", ambulance: "10177", fire: "10177", other: "112 (mobile)"       },
  { country: "Argentina",         flag: "🇦🇷", police: "101",  ambulance: "107",  fire: "100",  other: "137 (violence)"        },
  { country: "Turkey",            flag: "🇹🇷", police: "155",  ambulance: "112",  fire: "110",  other: "177 (forest fire)"     },
  { country: "Russia",            flag: "🇷🇺", police: "102",  ambulance: "103",  fire: "101",  other: "112 (unified)"         },
  { country: "Portugal",          flag: "🇵🇹", police: "112",  ambulance: "112",  fire: "112",  other: "116 000 (missing kids)" },
  { country: "Greece",            flag: "🇬🇷", police: "100",  ambulance: "166",  fire: "199",  other: "108 (coast guard)"     },
];

// ── localStorage keys ─────────────────────────────────────────────────────────
const CONTACTS_KEY = "emergency_contacts";
const MEDICAL_KEY  = "emergency_medical";

const loadContacts = () => JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]");
const loadMedical  = () => JSON.parse(localStorage.getItem(MEDICAL_KEY)  || "{}");

const uid = () => `ec_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const RELATION_OPTIONS = ["Spouse", "Parent", "Child", "Sibling", "Friend", "Doctor", "Other"];
const BLOOD_TYPES      = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"];

// ── Component ─────────────────────────────────────────────────────────────────
export default function Emergency() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [countrySearch,  setCountrySearch]  = useState("");
  const [pinnedCountry,  setPinnedCountry]  = useState(null);   // { country, ... }
  const [contacts,       setContacts]       = useState(loadContacts);
  const [medical,        setMedical]        = useState(loadMedical);
  const [location,       setLocation]       = useState(null);
  const [locError,       setLocError]       = useState("");
  const [locLoading,     setLocLoading]     = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [sosFlash,       setSosFlash]       = useState(false);

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm,     setContactForm]     = useState({ name: "", phone: "", relation: "Friend" });
  const [editContactId,   setEditContactId]   = useState(null);

  // Medical edit
  const [editMedical, setEditMedical] = useState(false);
  const [medicalDraft, setMedicalDraft] = useState({});

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem(MEDICAL_KEY,  JSON.stringify(medical));  }, [medical]);

  // ── Geolocation ────────────────────────────────────────────────────────────
  const getLocation = () => {
    if (!navigator.geolocation) { setLocError("Geolocation not supported."); return; }
    setLocLoading(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) });
        setLocLoading(false);
      },
      () => { setLocError("Could not get location. Check browser permissions."); setLocLoading(false); }
    );
  };

  const copyLocation = () => {
    if (!location) return;
    navigator.clipboard.writeText(`${location.lat}, ${location.lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openMaps = () => {
    if (!location) return;
    window.open(`https://maps.google.com/?q=${location.lat},${location.lng}`, "_blank", "noopener");
  };

  // ── SOS flash ──────────────────────────────────────────────────────────────
  const triggerSOS = () => {
    setSosFlash(true);
    setTimeout(() => setSosFlash(false), 600);
  };

  // ── Contact CRUD ───────────────────────────────────────────────────────────
  const saveContact = () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    if (editContactId) {
      setContacts((prev) => prev.map((c) => c.id === editContactId ? { ...c, ...contactForm } : c));
      setEditContactId(null);
    } else {
      setContacts((prev) => [...prev, { id: uid(), ...contactForm }]);
    }
    setContactForm({ name: "", phone: "", relation: "Friend" });
    setShowContactForm(false);
  };

  const deleteContact = (id) => setContacts((prev) => prev.filter((c) => c.id !== id));

  const startEditContact = (c) => {
    setContactForm({ name: c.name, phone: c.phone, relation: c.relation });
    setEditContactId(c.id);
    setShowContactForm(true);
  };

  // ── Medical card ───────────────────────────────────────────────────────────
  const startEditMedical = () => { setMedicalDraft({ ...medical }); setEditMedical(true); };
  const saveMedical = () => { setMedical(medicalDraft); setEditMedical(false); };

  // ── Filtered countries ─────────────────────────────────────────────────────
  const filteredCountries = EMERGENCY_DB.filter((c) =>
    c.country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: sosFlash ? "#dc2626" : "#f3f4f6", transition: "background 0.15s" }}
    >
      {/* ══ SIDEBAR ═════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background: "#000000" }}>
        <div className="px-5 pt-6 pb-5 border-b shrink-0" style={{ borderColor: "#374151" }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>
            Safety
          </p>
          <p className="font-bold text-lg leading-tight text-white">Emergency</p>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.path === "/emergency";
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition hover:bg-white/10"
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  color:      isActive ? "#000000" : "#9ca3af",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar quick-dial */}
        <div className="px-3 pb-5 space-y-2">
          <p className="px-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#4b5563" }}>
            Quick Dial
          </p>
          {contacts.slice(0, 3).map((c) => (
            <a
              key={c.id}
              href={`tel:${c.phone}`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition hover:bg-white/10"
              style={{ color: "#d1d5db", background: "#111827" }}
            >
              <span className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate flex-1">{c.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: "#6b7280" }}>📞</span>
            </a>
          ))}
          {contacts.length === 0 && (
            <p className="px-1 text-[10px]" style={{ color: "#4b5563" }}>No contacts saved</p>
          )}
        </div>
      </aside>

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-4" style={{ background: "#f3f4f6" }}>

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "#160f29" }}>
               Emergency Hub
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                Emergency numbers, contacts, and medical info — always at hand.
              </p>
            </div>
          </div>

          {/* ── Three-column body ────────────────────────────────────────── */}
          <div className="flex gap-4 items-start">

            {/* ── COL 1: SOS + Location ─────────────────────────────────── */}
            <div className="w-60 shrink-0 flex flex-col gap-4">

              {/* SOS Button */}
              <div
                className="rounded-2xl p-5 flex flex-col items-center gap-4 text-center"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <button
                  onClick={triggerSOS}
                  className="w-28 h-28 rounded-full flex flex-col items-center justify-center font-black text-white text-2xl transition-all duration-150 active:scale-95 shadow-lg hover:shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    boxShadow:  "0 0 0 6px rgba(220,38,38,0.15), 0 4px 24px rgba(220,38,38,0.35)",
                  }}
                  title="Tap to flash SOS alert"
                >
                  {/* <span style={{ fontSize: 32, lineHeight: 1 }}>🆘</span> */}
                  <span className="text-sm font-bold mt-1 tracking-widest">SOS</span>
                </button>
                <p className="text-[11px]" style={{ color: "#9ca3af" }}>
                  Tap to flash the screen. Use your device's emergency call for real emergencies.
                </p>

                {/* Quick action rows */}
                <div className="w-full space-y-2">
                  <a
                    href="tel:911"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 active:scale-95"
                    style={{ background: "#dc2626", color: "#ffffff" }}
                  >
                    📞 Call 911 (US)
                  </a>
                  <a
                    href="tel:112"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-95"
                    style={{ background: "#374151", color: "#ffffff" }}
                  >
                    📞 Call 112 (Intl)
                  </a>
                </div>
              </div>

              {/* Location card */}
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                  My Location
                </p>

                {location ? (
                  <>
                    <div
                      className="rounded-xl px-3 py-2.5 text-sm font-mono break-all"
                      style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#160f29" }}
                    >
                      {location.lat}, {location.lng}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={copyLocation}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition hover:bg-gray-700"
                        style={{ background: "#000000", color: "#ffffff" }}
                      >
                        {copied ? "✓ Copied!" : "📋 Copy"}
                      </button>
                      <button
                        onClick={openMaps}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                        style={{ background: "#183a37", color: "#ffffff" }}
                      >
                        🗺️ Maps
                      </button>
                    </div>
                    <button
                      onClick={getLocation}
                      className="text-[10px] font-medium hover:underline"
                      style={{ color: "#9ca3af" }}
                    >
                      Refresh location
                    </button>
                  </>
                ) : (
                  <>
                    {locError && (
                      <p className="text-xs px-3 py-2 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
                        {locError}
                      </p>
                    )}
                    <button
                      onClick={getLocation}
                      disabled={locLoading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-700 disabled:opacity-50"
                      style={{ background: "#000000", color: "#ffffff" }}
                    >
                      {locLoading ? "Getting location…" : "📍 Get My Location"}
                    </button>
                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>
                      Share your coordinates with emergency services.
                    </p>
                  </>
                )}
              </div>

              {/* Navigate to nearest hospital */}
              <div
                className="rounded-2xl p-4 flex flex-col gap-2"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#374151" }}>
                  Find Nearby
                </p>
                {[
                  { label: "🏥 Hospital",      q: "hospital near me"         },
                  { label: "👮 Police Station", q: "police station near me"   },
                  { label: "💊 Pharmacy",       q: "pharmacy near me"         },
                  { label: "🔥 Fire Station",   q: "fire station near me"     },
                ].map((item) => (
                  <a
                    key={item.q}
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(item.q)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition hover:bg-black/5"
                    style={{ border: "1px solid #e5e7eb", color: "#374151" }}
                  >
                    {item.label}
                    <span className="ml-auto text-[10px]" style={{ color: "#9ca3af" }}>→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* ── COL 2: Emergency numbers ──────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Pinned country */}
              {pinnedCountry && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "#000000", border: "1px solid #374151" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{pinnedCountry.flag}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{pinnedCountry.country}</p>
                        <p className="text-[10px]" style={{ color: "#9ca3af" }}>Pinned country</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPinnedCountry(null)}
                      className="text-xs hover:underline"
                      style={{ color: "#6b7280" }}
                    >
                      Unpin
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "🚔 Police",    number: pinnedCountry.police    },
                      { label: "🚑 Ambulance", number: pinnedCountry.ambulance },
                      { label: "🚒 Fire",      number: pinnedCountry.fire      },
                      { label: "ℹ️ Other",     number: pinnedCountry.other     },
                    ].map((s) => (
                      <a
                        key={s.label}
                        href={`tel:${s.number}`}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition hover:opacity-80"
                        style={{ background: "#111827" }}
                      >
                        <span className="text-sm">{s.label.split(" ")[0]}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{s.number}</p>
                          <p className="text-[10px]" style={{ color: "#6b7280" }}>
                            {s.label.split(" ").slice(1).join(" ")}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Search + country list */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: "#f3f4f6" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                    Emergency Numbers by Country
                  </p>
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                    </svg>
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country…"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                      style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#111827" }}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                  {/* Table header */}
                  <div
                    className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-widest sticky top-0"
                    style={{ background: "#f9fafb", color: "#9ca3af", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.4fr auto" }}
                  >
                    <span>Country</span>
                    <span>🚔 Police</span>
                    <span>🚑 Ambulance</span>
                    <span>🚒 Fire</span>
                    <span>ℹ️ Other</span>
                    <span />
                  </div>

                  {filteredCountries.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm" style={{ color: "#9ca3af" }}>No results for "{countrySearch}"</p>
                    </div>
                  ) : (
                    filteredCountries.map((c) => (
                      <div
                        key={c.country}
                        className="group grid items-center px-4 py-3 transition hover:bg-gray-50 border-b"
                        style={{ borderColor: "#f3f4f6", gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1.4fr auto" }}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "#160f29" }}>
                          <span className="text-lg">{c.flag}</span>
                          {c.country}
                        </span>
                        <a href={`tel:${c.police}`}    className="text-sm font-bold hover:underline" style={{ color: "#dc2626" }}>{c.police}</a>
                        <a href={`tel:${c.ambulance}`} className="text-sm font-bold hover:underline" style={{ color: "#dc2626" }}>{c.ambulance}</a>
                        <a href={`tel:${c.fire}`}      className="text-sm font-bold hover:underline" style={{ color: "#dc2626" }}>{c.fire}</a>
                        <span className="text-xs" style={{ color: "#6b7280" }}>{c.other}</span>
                        <button
                          onClick={() => setPinnedCountry(c)}
                          className="ml-2 text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition font-medium"
                          style={{ background: "#000000", color: "#ffffff" }}
                        >
                          Pin
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── COL 3: Contacts + Medical ─────────────────────────────── */}
            <div className="w-72 shrink-0 flex flex-col gap-4">

              {/* Emergency Contacts */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#f3f4f6" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                    Emergency Contacts
                  </p>
                  <button
                    onClick={() => { setShowContactForm(true); setEditContactId(null); setContactForm({ name: "", phone: "", relation: "Friend" }); }}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold transition hover:bg-gray-700"
                    style={{ background: "#000000", color: "#ffffff" }}
                  >
                    + Add
                  </button>
                </div>

                {/* Add / edit form */}
                {showContactForm && (
                  <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "#f3f4f6", background: "#f9fafb" }}>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "#ffffff", border: "1px solid #e5e7eb", color: "#111827" }}
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "#ffffff", border: "1px solid #e5e7eb", color: "#111827" }}
                    />
                    <select
                      value={contactForm.relation}
                      onChange={(e) => setContactForm((p) => ({ ...p, relation: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "#ffffff", border: "1px solid #e5e7eb", color: "#374151" }}
                    >
                      {RELATION_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={saveContact}
                        disabled={!contactForm.name.trim() || !contactForm.phone.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition hover:bg-gray-700 disabled:opacity-40"
                        style={{ background: "#000000", color: "#ffffff" }}
                      >
                        {editContactId ? "Save changes" : "Add contact"}
                      </button>
                      <button
                        onClick={() => { setShowContactForm(false); setEditContactId(null); }}
                        className="px-3 py-2 rounded-xl text-xs transition hover:bg-gray-100"
                        style={{ color: "#6b7280" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {contacts.length === 0 && !showContactForm ? (
                  <div className="py-8 text-center flex flex-col items-center gap-2">
                    <span className="text-3xl">👥</span>
                    <p className="text-xs" style={{ color: "#9ca3af" }}>No contacts yet.</p>
                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>Add family or friends for quick access.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#f9fafb" }}>
                    {contacts.map((c) => (
                      <div key={c.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                          style={{ background: "#374151" }}
                        >
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#160f29" }}>{c.name}</p>
                          <p className="text-xs" style={{ color: "#6b7280" }}>{c.relation} · {c.phone}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={`tel:${c.phone}`}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-green-50"
                            title={`Call ${c.name}`}
                          >
                            <span className="text-sm">📞</span>
                          </a>
                          <button
                            onClick={() => startEditContact(c)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-gray-100"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteContact(c.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition hover:bg-red-50"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Medical Info Card */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#f3f4f6" }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: "#fffbeb" }}
                    >
                      🩺
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#374151" }}>
                      Medical Info
                    </p>
                  </div>
                  <button
                    onClick={editMedical ? saveMedical : startEditMedical}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold transition hover:bg-gray-700"
                    style={{ background: editMedical ? "#183a37" : "#000000", color: "#ffffff" }}
                  >
                    {editMedical ? "Save" : "Edit"}
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {editMedical ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Blood Type</label>
                        <select
                          value={medicalDraft.bloodType || ""}
                          onChange={(e) => setMedicalDraft((p) => ({ ...p, bloodType: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}
                        >
                          <option value="">Unknown</option>
                          {BLOOD_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Allergies</label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Penicillin, Peanuts"
                          value={medicalDraft.allergies || ""}
                          onChange={(e) => setMedicalDraft((p) => ({ ...p, allergies: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Medications</label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Metformin 500mg"
                          value={medicalDraft.medications || ""}
                          onChange={(e) => setMedicalDraft((p) => ({ ...p, medications: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Conditions</label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Diabetes Type 2, Asthma"
                          value={medicalDraft.conditions || ""}
                          onChange={(e) => setMedicalDraft((p) => ({ ...p, conditions: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Doctor / Hospital</label>
                        <input
                          type="text"
                          placeholder="Name & phone"
                          value={medicalDraft.doctor || ""}
                          onChange={(e) => setMedicalDraft((p) => ({ ...p, doctor: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151" }}
                        />
                      </div>
                      <button
                        onClick={() => setEditMedical(false)}
                        className="w-full py-2 rounded-xl text-xs font-medium transition hover:bg-gray-100"
                        style={{ color: "#6b7280" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {[
                        { icon: "🩸", label: "Blood Type",  value: medical.bloodType  },
                        { icon: "⚠️",  label: "Allergies",   value: medical.allergies  },
                        { icon: "💊",  label: "Medications", value: medical.medications },
                        { icon: "🫀",  label: "Conditions",  value: medical.conditions  },
                        { icon: "🏥",  label: "Doctor",      value: medical.doctor     },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
                        >
                          <span className="text-base shrink-0 mt-0.5">{row.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9ca3af" }}>
                              {row.label}
                            </p>
                            <p className="text-sm mt-0.5 wrap-break-word" style={{ color: row.value ? "#160f29" : "#d1d5db" }}>
                              {row.value || "Not set"}
                            </p>
                          </div>
                        </div>
                      ))}

                      {!Object.values(medical).some(Boolean) && (
                        <p className="text-[10px] text-center mt-1" style={{ color: "#9ca3af" }}>
                          Fill in your medical info so first responders can help you faster.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Safety tips */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#92400e" }}>
                  💡 Safety Tips
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Screenshot this page before going offline.",
                    "112 works from any phone, even locked.",
                    "Share your location with a trusted contact daily.",
                    "Keep travel insurance docs accessible.",
                    "Know the local emergency number before you arrive.",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-xs" style={{ color: "#78350f" }}>
                      <span className="shrink-0 mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
