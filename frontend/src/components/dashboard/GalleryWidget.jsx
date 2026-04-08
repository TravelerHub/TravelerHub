import { useNavigate } from "react-router-dom";

// Placeholder data — to be replaced when hooked up to Supabase storage
const MOCK_PHOTOS = [
  { id: 1, url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=300&q=80", alt: "Mountain hike" },
  { id: 2, url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=300&q=80", alt: "Paris sunset" },
  { id: 3, url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80", alt: "Beach day" },
  { id: 4, url: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=300&q=80", alt: "City streets" },
];

export default function GalleryWidget({ photos = MOCK_PHOTOS }) {
  const navigate = useNavigate();
  const displayPhotos = photos.slice(0, 4); // Only show up to 4 photos in the widget
  
  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
          {photos.length > 0 ? `${photos.length} recent photos` : "No photos yet"}
        </p>
        <button 
          onClick={() => navigate("/gallery")}
          className="text-[10px] px-2 py-0.5 rounded-full font-medium transition hover:bg-black/10"
          style={{ background: "#f3f4f6", color: "#111827" }}
        >
          + Upload
        </button>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-hidden">
        {displayPhotos.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center gap-2 rounded-xl" style={{ border: "1px dashed rgba(0,0,0,0.15)", background: "rgba(0,0,0,0.01)" }}>
             <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
             </svg>
             <p className="text-[10px]" style={{ color: "#6b7280" }}>Share your first memory</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 h-full content-start">
            {displayPhotos.map((photo) => (
              <div 
                key={photo.id}
                onClick={() => navigate("/gallery")}
                className="group relative rounded-xl overflow-hidden cursor-pointer bg-gray-100 aspect-square"
                style={{ border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <img 
                  src={photo.url} 
                  alt={photo.alt} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                {/* Subtle dark overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Link */}
      <button
        onClick={() => navigate("/gallery")}
        className="mt-3 shrink-0 text-xs font-medium hover:underline text-left"
        style={{ color: "#374151" }}
      >
        Open full gallery →
      </button>
    </div>
  );
}