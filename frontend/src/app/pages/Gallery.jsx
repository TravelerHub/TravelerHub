import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../config";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";

export default function Gallery() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // TEMPORARY
  const tripId = localStorage.getItem("activeGroupId") || "default-trip-id";

  useEffect(() => {
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Replace with your actual FastAPI endpoint to get media for a trip
      const res = await fetch(`${API_BASE}/trips/${tripId}/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch photos:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── File Upload Handling ───────────────────────────────────────────────────
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError("");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file first.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/trips/${tripId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: Do NOT set Content-Type for FormData; the browser sets it automatically with the boundary
        },
        body: formData,
      });

      if (res.ok) {
        const newPhoto = await res.json();
        // Add the new photo to the top of the gallery grid immediately
        setPhotos((prev) => [newPhoto, ...prev]);
        closeUploadModal();
      } else {
        const err = await res.json();
        setUploadError(err.detail || "Upload failed.");
      }
    } catch (err) {
      console.error(err);
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadError("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>
      
      {/* ══ MAIN CONTENT ═════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-6" style={{ background: "#f3f4f6" }}>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6 px-1">
            <div>
              <button 
                onClick={() => navigate(-1)}
                className="text-sm font-medium hover:underline mb-1 flex items-center gap-1"
                style={{ color: "#5c6b73" }}
              >
                <span>←</span> Back to Dashboard
              </button>
              <h2 className="text-2xl font-bold" style={{ color: "#160f29" }}>Trip Gallery</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                Relive your favorite memories with the group.
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-800 active:scale-95 shadow-sm"
              style={{ background: "#183a37", color: "#fbfbf2" }}
            >
              + Upload Photo
            </button>
          </div>

          {/* Photo Grid */}
          {loading ? (
             <div className="flex justify-center items-center h-64">
               <p style={{ color: "#6b7280" }}>Loading gallery...</p>
             </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-2xl" style={{ border: "2px dashed #d1d5db", background: "rgba(0,0,0,0.02)" }}>
              <span className="text-4xl mb-3">📸</span>
              <p className="text-base font-medium" style={{ color: "#374151" }}>No photos yet</p>
              <p className="text-sm mt-1 mb-4" style={{ color: "#6b7280" }}>Be the first to share a memory from the trip!</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition hover:bg-gray-200"
                style={{ background: "#e5e7eb", color: "#111827" }}
              >
                Upload Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-1">
              {photos.map((photo, index) => (
                <div 
                  key={photo.id || index} 
                  className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm aspect-square"
                  style={{ background: "#e5e7eb" }}
                >
                  <img 
                    src={photo.public_url || photo.url} 
                    alt={`Trip memory ${index + 1}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <p className="text-xs font-medium text-white truncate">
                      {photo.uploaded_by_name || "Uploaded by a member"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ══ UPLOAD MODAL ════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="rounded-2xl shadow-2xl max-w-sm w-full p-6" style={{ background: "#fbfbf2" }}>
            <h3 className="text-xl font-bold mb-1" style={{ color: "#000000" }}>Upload Media</h3>
            <p className="text-sm mb-5" style={{ color: "#6b7280" }}>Share a photo with your trip group.</p>

            <form onSubmit={handleUpload} className="space-y-4">
              
              {/* File Drop/Select Area */}
              <div 
                className="relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors"
                style={{ 
                  borderColor: selectedFile ? "#183a37" : "#d1d5db", 
                  background: selectedFile ? "rgba(24,58,55,0.05)" : "#f3f4f6" 
                }}
              >
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="text-2xl mb-2">{selectedFile ? "✅" : "📁"}</span>
                <p className="text-sm font-medium text-center" style={{ color: "#111827" }}>
                  {selectedFile ? selectedFile.name : "Click or drag to select file"}
                </p>
                {!selectedFile && (
                  <p className="text-xs text-center mt-1" style={{ color: "#6b7280" }}>
                    Supports JPG, PNG, WEBP
                  </p>
                )}
              </div>

              {uploadError && <p className="text-sm text-red-500 text-center">{uploadError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#160f29", color: "#f9fafb" }}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition hover:bg-gray-200"
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #374151" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}