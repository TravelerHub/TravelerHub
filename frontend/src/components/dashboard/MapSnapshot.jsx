import { useState, useEffect } from "react";

const DEFAULT_COORDS = { lat: 33.7701, lng: -118.1937 }; // Long Beach, CA

export default function MapSnapshot() {
  const [coords,  setCoords]  = useState(null);
  const [loading, setLoading] = useState(true);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(DEFAULT_COORDS);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoords({ lat: coords.latitude, lng: coords.longitude });
        setLoading(false);
      },
      () => {
        setCoords(DEFAULT_COORDS);
        setLoading(false);
      }
    );
  }, []);

  if (loading || !coords || !token) {
    return (
      <div className="h-full flex items-center justify-center rounded-2xl" style={{ background: "#e5e7eb" }}>
        <span className="text-xs" style={{ color: "#9ca3af" }}>Loading map…</span>
      </div>
    );
  }

  const mapUrl =
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${coords.lng},${coords.lat},11,0/600x220@2x?access_token=${token}`;

  return (
    <div className="h-full relative overflow-hidden rounded-b-2xl">
      <img
        src={mapUrl}
        alt="Map snapshot"
        className="w-full h-full object-cover"
        style={{ display: "block" }}
      />
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
        style={{ background: "rgba(0,0,0,0.65)", color: "#f9fafb", backdropFilter: "blur(4px)" }}
      >
        <span>📍</span>
        <span>Current Area</span>
      </div>
    </div>
  );
}
