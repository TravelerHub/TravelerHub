import { useState, useEffect } from "react";

// ── Lookup tables ─────────────────────────────────────────────────────────────

const COUNTRY_CURRENCY = {
  US:"USD", GB:"GBP", AU:"AUD", CA:"CAD", NZ:"NZD", JP:"JPY", CN:"CNY",
  KR:"KRW", IN:"INR", MX:"MXN", BR:"BRL", TH:"THB", VN:"VND", SG:"SGD",
  MY:"MYR", ID:"IDR", PH:"PHP", HK:"HKD", TW:"TWD", ZA:"ZAR", AE:"AED",
  SA:"SAR", TR:"TRY", CH:"CHF", SE:"SEK", NO:"NOK", DK:"DKK", PL:"PLN",
  AR:"ARS", CL:"CLP", CO:"COP", EG:"EGP", NG:"NGN", MA:"MAD", RU:"RUB",
  // Eurozone
  DE:"EUR", FR:"EUR", IT:"EUR", ES:"EUR", PT:"EUR", NL:"EUR", BE:"EUR",
  AT:"EUR", FI:"EUR", GR:"EUR", IE:"EUR", LU:"EUR", SK:"EUR", SI:"EUR",
  EE:"EUR", LV:"EUR", LT:"EUR", CY:"EUR", MT:"EUR",
};

const CURRENCY_SYMBOL = {
  USD:"$",   EUR:"€",    GBP:"£",  JPY:"¥",   CNY:"¥",   KRW:"₩",  INR:"₹",
  AUD:"A$",  CAD:"C$",  NZD:"NZ$",CHF:"Fr",   SEK:"kr",  NOK:"kr", DKK:"kr",
  THB:"฿",   VND:"₫",   PHP:"₱",  MYR:"RM",   IDR:"Rp",  SGD:"S$", HKD:"HK$",
  TWD:"NT$", ZAR:"R",   AED:"د.إ",SAR:"﷼",    TRY:"₺",   BRL:"R$", MXN:"$",
  PLN:"zł",  ARS:"$",   CLP:"$",  COP:"$",    EGP:"£",   NGN:"₦",  MAD:"د.م.",
  RUB:"₽",
};

const EMERGENCY_NUMBERS = {
  US:{ police:"911",   ambulance:"911",   fire:"911"   },
  GB:{ police:"999",   ambulance:"999",   fire:"999"   },
  AU:{ police:"000",   ambulance:"000",   fire:"000"   },
  CA:{ police:"911",   ambulance:"911",   fire:"911"   },
  NZ:{ police:"111",   ambulance:"111",   fire:"111"   },
  JP:{ police:"110",   ambulance:"119",   fire:"119"   },
  CN:{ police:"110",   ambulance:"120",   fire:"119"   },
  KR:{ police:"112",   ambulance:"119",   fire:"119"   },
  IN:{ police:"100",   ambulance:"102",   fire:"101"   },
  TH:{ police:"191",   ambulance:"1669",  fire:"199"   },
  SG:{ police:"999",   ambulance:"995",   fire:"995"   },
  PH:{ police:"117",   ambulance:"161",   fire:"160"   },
  VN:{ police:"113",   ambulance:"115",   fire:"114"   },
  MY:{ police:"999",   ambulance:"999",   fire:"994"   },
  ID:{ police:"110",   ambulance:"118",   fire:"113"   },
  MX:{ police:"911",   ambulance:"911",   fire:"911"   },
  BR:{ police:"190",   ambulance:"192",   fire:"193"   },
  AR:{ police:"911",   ambulance:"107",   fire:"100"   },
  ZA:{ police:"10111", ambulance:"10177", fire:"10177" },
  AE:{ police:"999",   ambulance:"998",   fire:"997"   },
  TR:{ police:"155",   ambulance:"112",   fire:"110"   },
  DEFAULT:{ police:"112", ambulance:"112", fire:"112"  },
};

const LOCAL_PHRASES = {
  JP:[
    { phrase:"Sumimasen",    meaning:"Excuse me"          },
    { phrase:"Arigatou",     meaning:"Thank you"          },
    { phrase:"Tasukete!",    meaning:"Help!"              },
    { phrase:"Doko desu ka?",meaning:"Where is it?"       },
  ],
  CN:[
    { phrase:"Duìbuqǐ",    meaning:"Excuse me"   },
    { phrase:"Xièxie",     meaning:"Thank you"   },
    { phrase:"Jiùmìng!",   meaning:"Help!"       },
    { phrase:"Zài nǎlǐ?",  meaning:"Where is...?"},
  ],
  KR:[
    { phrase:"Sillyehamnida",  meaning:"Excuse me"    },
    { phrase:"Gamsahamnida",   meaning:"Thank you"    },
    { phrase:"Saram sallyo!",  meaning:"Help!"        },
    { phrase:"Eodie isseoyo?", meaning:"Where is...?" },
  ],
  TH:[
    { phrase:"Khob khun",    meaning:"Thank you"          },
    { phrase:"Chuay duay!",  meaning:"Help!"              },
    { phrase:"Yuu thi nai?", meaning:"Where is it?"       },
    { phrase:"Mai khao chai",meaning:"I don't understand" },
  ],
  VN:[
    { phrase:"Xin lỗi",   meaning:"Excuse me"   },
    { phrase:"Cảm ơn",    meaning:"Thank you"   },
    { phrase:"Cứu tôi!",  meaning:"Help!"       },
    { phrase:"Ở đâu?",    meaning:"Where is...?"},
  ],
  FR:[
    { phrase:"Excusez-moi", meaning:"Excuse me"    },
    { phrase:"Merci",       meaning:"Thank you"    },
    { phrase:"Au secours!", meaning:"Help!"        },
    { phrase:"Où est...?",  meaning:"Where is...?" },
  ],
  DE:[
    { phrase:"Entschuldigung", meaning:"Excuse me"    },
    { phrase:"Danke",          meaning:"Thank you"    },
    { phrase:"Hilfe!",         meaning:"Help!"        },
    { phrase:"Wo ist...?",     meaning:"Where is...?" },
  ],
  IT:[
    { phrase:"Scusa",     meaning:"Excuse me"    },
    { phrase:"Grazie",    meaning:"Thank you"    },
    { phrase:"Aiuto!",    meaning:"Help!"        },
    { phrase:"Dov'è...?", meaning:"Where is...?" },
  ],
  ES:[
    { phrase:"Disculpe",     meaning:"Excuse me"    },
    { phrase:"Gracias",      meaning:"Thank you"    },
    { phrase:"¡Ayuda!",      meaning:"Help!"        },
    { phrase:"¿Dónde está?", meaning:"Where is...?" },
  ],
  PT:[
    { phrase:"Com licença", meaning:"Excuse me"    },
    { phrase:"Obrigado",    meaning:"Thank you"    },
    { phrase:"Socorro!",    meaning:"Help!"        },
    { phrase:"Onde fica?",  meaning:"Where is...?" },
  ],
  AR:[
    { phrase:"Afwan",    meaning:"Excuse me"    },
    { phrase:"Shukran",  meaning:"Thank you"    },
    { phrase:"El-ha'!",  meaning:"Help!"        },
    { phrase:"Feen...?", meaning:"Where is...?" },
  ],
  TR:[
    { phrase:"Pardon",      meaning:"Excuse me"    },
    { phrase:"Teşekkürler", meaning:"Thank you"    },
    { phrase:"İmdat!",      meaning:"Help!"        },
    { phrase:"Nerede...?",  meaning:"Where is...?" },
  ],
  AE:[
    { phrase:"Afwan",     meaning:"Excuse me"    },
    { phrase:"Shukran",   meaning:"Thank you"    },
    { phrase:"Saa'idni!", meaning:"Help!"        },
    { phrase:"Feen...?",  meaning:"Where is...?" },
  ],
  DEFAULT:[
    { phrase:"Excuse me", meaning:"Get attention"     },
    { phrase:"Thank you", meaning:"Express gratitude" },
    { phrase:"Help!",     meaning:"Emergency"         },
    { phrase:"Where is?", meaning:"Ask directions"    },
  ],
};

// Maps country code → phrase set key
const COUNTRY_LANG = {
  JP:"JP", CN:"CN", KR:"KR", TH:"TH", VN:"VN",
  FR:"FR", DE:"DE", IT:"IT", ES:"ES", MX:"ES", AR:"ES", CL:"ES", CO:"ES",
  PT:"PT", BR:"PT", TR:"TR", AE:"AE", SA:"AR", EG:"AR", MA:"AR",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocalInfoWidget() {
  const [countryCode, setCountryCode] = useState(null);
  const [currCode,    setCurrCode]    = useState(null);
  const [rate,        setRate]        = useState(null);
  const [localTime,   setLocalTime]   = useState(new Date());
  const [timezone,    setTimezone]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      // 1. Timezone from IP via worldtimeapi (free, no key)
      try {
        const tzRes  = await fetch("https://worldtimeapi.org/api/ip");
        const tzData = await tzRes.json();
        if (!cancelled) {
          setTimezone(tzData.timezone);
          setLocalTime(new Date(tzData.datetime));
        }
      } catch { /* silent */ }

      // 2. Country from GPS + Nominatim reverse-geocode
      if (!navigator.geolocation) { setLoading(false); return; }
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
            );
            const gData = await geoRes.json();
            const cc = gData?.address?.country_code?.toUpperCase();
            if (!cancelled && cc) {
              setCountryCode(cc);
              const curr = COUNTRY_CURRENCY[cc] || "USD";
              setCurrCode(curr);
              // 3. Exchange rate from open.er-api (free, no key)
              if (curr !== "USD") {
                const rateRes  = await fetch("https://open.er-api.com/v6/latest/USD");
                const rateData = await rateRes.json();
                if (!cancelled) setRate(rateData?.rates?.[curr] ?? null);
              }
            }
          } catch { /* silent */ }
          if (!cancelled) setLoading(false);
        },
        () => { if (!cancelled) setLoading(false); }
      );
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // Keep the clock ticking every minute
  useEffect(() => {
    const id = setInterval(() => setLocalTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const emergency = EMERGENCY_NUMBERS[countryCode] || EMERGENCY_NUMBERS.DEFAULT;
  const langKey   = COUNTRY_LANG[countryCode]      || "DEFAULT";
  const phrases   = LOCAL_PHRASES[langKey]          || LOCAL_PHRASES.DEFAULT;
  const symbol    = CURRENCY_SYMBOL[currCode]       || currCode || "$";

  const timeStr = timezone
    ? localTime.toLocaleTimeString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: true })
    : localTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const tzLabel = timezone
    ? timezone.split("/").pop().replace(/_/g, " ")
    : Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs animate-pulse" style={{ color: "#9ca3af" }}>Detecting location…</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">

      {/* Local Time */}
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <span className="text-base shrink-0 mt-0.5">🕐</span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#9ca3af" }}>Local Time</p>
          <p className="text-sm font-bold" style={{ color: "#111827" }}>{timeStr}</p>
          <p className="text-[10px]" style={{ color: "#6b7280" }}>{tzLabel}</p>
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <span className="text-base shrink-0 mt-0.5">💱</span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#9ca3af" }}>Exchange Rate</p>
          {currCode && currCode !== "USD" && rate ? (
            <p className="text-sm font-bold" style={{ color: "#111827" }}>
              1 USD = {symbol}{rate.toFixed(2)} {currCode}
            </p>
          ) : (
            <p className="text-sm font-bold" style={{ color: "#111827" }}>
              {countryCode ? "USD is local currency" : "Enable location"}
            </p>
          )}
        </div>
      </div>

      {/* Emergency Numbers */}
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <span className="text-base shrink-0 mt-0.5">🚨</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#9ca3af" }}>Emergency</p>
          <div className="flex gap-4 flex-wrap">
            <span className="text-xs" style={{ color: "#111827" }}>🚔 {emergency.police}</span>
            <span className="text-xs" style={{ color: "#111827" }}>🚑 {emergency.ambulance}</span>
            <span className="text-xs" style={{ color: "#111827" }}>🚒 {emergency.fire}</span>
          </div>
        </div>
      </div>

      {/* Basic Phrases */}
      <div className="flex-1 min-h-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: "#9ca3af" }}>💬 Basic Phrases</p>
        <div className="flex flex-col gap-1">
          {phrases.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)" }}
            >
              <span className="text-xs font-semibold shrink-0" style={{ color: "#111827" }}>&ldquo;{p.phrase}&rdquo;</span>
              <span className="text-[10px]" style={{ color: "#9ca3af" }}>→ {p.meaning}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
