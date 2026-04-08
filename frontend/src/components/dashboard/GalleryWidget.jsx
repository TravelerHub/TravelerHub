import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../config";

export default function GalleryWidget() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tripId = localStorage.getItem("active_group_id") || localStorage.getItem("activeGroupId");
    if (!tripId) { setLoading(false); return; }

    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/trips/${tripId}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPhotos(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
          {loading ? "Loading..." : photos.length > 0 ? `${photos.length} recent photos` : "No photos yet"}
        </p>
        <button
          onClick={() => navigate("/gallery")}
          className="text-[10px] px-2 py-0.5 rounded-full font-medium transition hover:bg-black/10"
          style={{ background: "#f3f4f6", color: "#111827" }}
        >
          + Upload
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {photos.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 rounded-xl" style={{ border: "1px dashed rgba(0,0,0,0.15)", background: "rgba(0,0,0,0.01)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-[10px]" style={{ color: "#6b7280" }}>Share your first memory</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 h-full content-start">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => navigate("/gallery")}
                className="group relative rounded-xl overflow-hidden cursor-pointer bg-gray-100 aspect-square"
                style={{ border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <img
                  src={photo.public_url || photo.url}
                  alt={photo.caption || "Trip photo"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/gallery")}
        className="mt-3 shrink-0 text-xs font-medium hover:underline text-left"
        style={{ color: "#374151" }}
      >
        Open full gallery &rarr;
      </button>
    </div>
  );
}
