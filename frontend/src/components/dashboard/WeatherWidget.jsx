import { useState, useEffect } from "react";

// Open-Meteo WMO weather interpretation codes
const WMO_MAP = {
  0:  { icon: "☀️",  desc: "Clear sky"      },
  1:  { icon: "🌤️", desc: "Mainly clear"    },
  2:  { icon: "⛅",  desc: "Partly cloudy"  },
  3:  { icon: "☁️",  desc: "Overcast"       },
  45: { icon: "🌫️", desc: "Foggy"           },
  48: { icon: "🌫️", desc: "Icy fog"         },
  51: { icon: "🌦️", desc: "Light drizzle"   },
  53: { icon: "🌦️", desc: "Drizzle"         },
  55: { icon: "🌦️", desc: "Heavy drizzle"   },
  61: { icon: "🌧️", desc: "Light rain"      },
  63: { icon: "🌧️", desc: "Rain"            },
  65: { icon: "🌧️", desc: "Heavy rain"      },
  71: { icon: "🌨️", desc: "Light snow"      },
  73: { icon: "❄️",  desc: "Snow"            },
  75: { icon: "❄️",  desc: "Heavy snow"      },
  80: { icon: "🌦️", desc: "Showers"         },
  95: { icon: "⛈️",  desc: "Thunderstorm"   },
  99: { icon: "⛈️",  desc: "Severe storm"   },
};

function getWeatherInfo(code) {
  if (WMO_MAP[code]) return WMO_MAP[code];
  if (code <= 3)  return { icon: "⛅",  desc: "Partly cloudy" };
  if (code <= 48) return { icon: "🌫️", desc: "Foggy"          };
  if (code <= 67) return { icon: "🌧️", desc: "Rain"           };
  if (code <= 77) return { icon: "❄️",  desc: "Snow"           };
  if (code <= 82) return { icon: "🌦️", desc: "Showers"        };
  return { icon: "⛈️", desc: "Storm" };
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [city,    setCity]    = useState("");
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lng } = coords;
          const [weatherRes, geoRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
              `&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m` +
              `&temperature_unit=fahrenheit&wind_speed_unit=mph`
            ),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`),
          ]);
          const wData = await weatherRes.json();
          const gData = await geoRes.json();
          setWeather(wData.current);
          setCity(
            gData?.address?.city   ||
            gData?.address?.town   ||
            gData?.address?.county ||
            gData?.address?.state  ||
            "Your Location"
          );
        } catch {
          // silently fail — widget degrades gracefully
        } finally {
          setLoading(false);
        }
      },
      () => { setDenied(true); setLoading(false); }
    );
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <span className="text-xs animate-pulse" style={{ color: "#9ca3af" }}>Fetching weather…</span>
      </div>
    );
  }

  if (denied || !weather) {
    return (
      <div className="h-full flex items-center justify-center gap-4 px-5 py-3">
        <span className="text-3xl">🌍</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#111827" }}>Weather Unavailable</p>
          <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>Enable location access to see local weather</p>
        </div>
      </div>
    );
  }

  const info = getWeatherInfo(weather.weathercode);
  const temp = Math.round(weather.temperature_2m);
  const wind = Math.round(weather.windspeed_10m);
  const hum  = weather.relative_humidity_2m;
  const now  = new Date();

  return (
    <div className="h-full flex items-center gap-6 px-5 py-3">
      {/* Icon + temp */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-4xl">{info.icon}</span>
        <div>
          <p className="text-3xl font-bold leading-none" style={{ color: "#111827" }}>{temp}°F</p>
          <p className="text-xs mt-1" style={{ color: "#6b7280" }}>{info.desc}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-10 w-px shrink-0" style={{ background: "rgba(0,0,0,0.1)" }} />

      {/* City + stats */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>📍 {city}</p>
        <div className="flex gap-4 mt-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "#6b7280" }}>💨 {wind} mph</span>
          <span className="text-xs" style={{ color: "#6b7280" }}>💧 {hum}% humidity</span>
        </div>
      </div>

      {/* Day / date */}
      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#9ca3af" }}>
          {now.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}
