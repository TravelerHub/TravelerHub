import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../config";
import { apiFetch, getToken, authHeaders } from "../../services/api.js";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { logActivity } from "../../components/ActivityFeed.jsx";
import EmptyState from "../../components/EmptyState.jsx";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function avatarColor(name) {
  const colors = ["#183a37", "#160f29", "#2d1b4e", "#1e3a5f", "#3b2f00", "#3b1f1f", "#1a3320"];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Gallery() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Active trip selection
  const [activeTrip, setActiveTrip] = useState(localStorage.getItem("active_group_id") || localStorage.getItem("activeGroupId") || "");

  const setActiveTripAndPersist = useCallback((tripId) => {
    setActiveTrip(tripId || "");
    if (tripId) {
      localStorage.setItem("active_group_id", String(tripId));
      localStorage.setItem("activeGroupId", String(tripId));
    }
  }, []);

  // Upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  // Lightbox
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  // Edit caption
  const [editingId, setEditingId] = useState(null);
  const [editCaption, setEditCaption] = useState("");

  // Social: likes, saves, share — track which item is in-flight
  const [likingId, setLikingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // View mode: 'grid' | 'grouped'
  const [viewMode, setViewMode] = useState('grid');

  // Grouped view data
  const [groupedData, setGroupedData] = useState([]);
  const [groupedLoading, setGroupedLoading] = useState(false);

  // Multi-select for batch sharing
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Comments for lightbox
  const [comments, setComments]       = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment]   = useState("");
  const [postingComment, setPosting]  = useState(false);

  // ── React Query: albums ───────────────────────────────────────────────────

  const { data: albumsData } = useQuery({
    queryKey: ["my-albums"],
    queryFn: () => apiFetch("/trips/my-albums"),
  });
  const albums = albumsData?.albums || [];

  // Auto-select first album when none is active
  useEffect(() => {
    if (!albums.length) {
      return;
    }

    const hasActive = albums.some((a) => a.trip_id === activeTrip);
    if (!activeTrip || !hasActive) {
      setActiveTripAndPersist(albums[0].trip_id);
    }
  }, [activeTrip, albums, setActiveTripAndPersist]);

  // ── React Query: photos for the active trip (infinite/paginated) ─────────

  const {
    data: photosInfiniteData,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["trip-media", activeTrip],
    queryFn: ({ pageParam }) =>
      apiFetch(`/trips/${activeTrip}/media?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!activeTrip,
  });
  const photos = photosInfiniteData?.pages.flatMap((p) => p.photos) ?? [];

  // ── useMutation: upload photo ─────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption, tripId }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption.trim()) formData.append("caption", caption.trim());
      const res = await fetch(`${API_BASE}/trips/${tripId}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (newPhoto) => {
      queryClient.invalidateQueries({ queryKey: ["trip-media", activeTrip] });
      queryClient.invalidateQueries({ queryKey: ["my-albums"] });
      logActivity(activeTrip, "added_photo", uploadCaption.trim() || "a photo");
      closeUpload();
    },
    onError: (err) => {
      setUploadError(err.message || "Network error");
    },
  });
  const uploading = uploadMutation.isPending;

  // ── useMutation: like toggle ──────────────────────────────────────────────

  const likeMutation = useMutation({
    mutationFn: ({ mediaId }) =>
      apiFetch(`/trips/${activeTrip}/media/${mediaId}/like`, { method: "POST" }),
    onSuccess: (data) => {
      if (data?.liked) logActivity(activeTrip, "liked_photo");
      queryClient.invalidateQueries({ queryKey: ["trip-media", activeTrip] });
    },
    onSettled: () => setLikingId(null),
  });

  // ── useMutation: save toggle ──────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: ({ mediaId }) =>
      apiFetch(`/trips/${activeTrip}/media/${mediaId}/save`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-media", activeTrip] });
    },
    onSettled: () => setSavingId(null),
  });

  // ── useMutation: delete photo ─────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: ({ mediaId }) =>
      apiFetch(`/trips/${activeTrip}/media/${mediaId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-media", activeTrip] });
      queryClient.invalidateQueries({ queryKey: ["my-albums"] });
      if (lightboxIdx >= 0) setLightboxIdx(-1);
    },
    onSettled: () => setDeletingId(null),
  });

  // ── Grouped photos fetch ──────────────────────────────────────────────────

  const fetchGroupedPhotos = useCallback(async () => {
    if (!activeTrip) { setGroupedData([]); return; }
    setGroupedLoading(true);
    try {
      const data = await apiFetch(`/trips/${activeTrip}/media/grouped`);
      setGroupedData(data.groups || []);
    } catch { setGroupedData([]); }
    finally { setGroupedLoading(false); }
  }, [activeTrip]);

  useEffect(() => {
    if (viewMode === 'grouped') fetchGroupedPhotos();
  }, [viewMode, fetchGroupedPhotos]);

  // ── Upload handlers ───────────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!activeTrip) {
      setUploadError("Select a group album before uploading");
      return;
    }
    if (!uploadFile) return;
    setUploadError("");
    uploadMutation.mutate({ file: uploadFile, caption: uploadCaption, tripId: activeTrip });
  };

  const closeUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadCaption("");
    setUploadError("");
  };

  // ── Caption editing ───────────────────────────────────────────────────────

  const startEdit = (photo) => {
    setEditingId(photo.id);
    setEditCaption(photo.caption || "");
  };

  const saveCaption = async () => {
    if (!editingId) return;
    try {
      await apiFetch(`/trips/${activeTrip}/media/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: editCaption }),
      });
      queryClient.invalidateQueries({ queryKey: ["trip-media", activeTrip] });
    } catch { /* silent */ }
    setEditingId(null);
    setEditCaption("");
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = (mediaId) => {
    setDeletingId(mediaId);
    deleteMutation.mutate({ mediaId });
  };

  // ── Like toggle ────────────────────────────────────────────────────────────

  const handleLike = (mediaId, e) => {
    if (e) e.stopPropagation();
    setLikingId(mediaId);
    likeMutation.mutate({ mediaId });
  };

  // ── Save/bookmark toggle ──────────────────────────────────────────────────

  const handleSave = (mediaId, e) => {
    if (e) e.stopPropagation();
    setSavingId(mediaId);
    saveMutation.mutate({ mediaId });
  };

  // ── Share (Web Share API + fallback) ──────────────────────────────────────

  const handleShare = async (photo, e) => {
    if (e) e.stopPropagation();
    const shareData = {
      title: photo.caption || "Trip Photo",
      text: `Check out this photo from our trip${photo.uploaded_by_name ? ` by ${photo.uploaded_by_name}` : ""}!`,
      url: photo.public_url,
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(photo.public_url);
      alert("Link copied to clipboard!");
    }
  };

  // ── Comments ──────────────────────────────────────────────────────────────

  const fetchComments = useCallback(async (mediaId) => {
    if (!mediaId) return;
    setCommentsLoading(true);
    setComments([]);
    try {
      const data = await apiFetch(`/media-comments/?media_id=${mediaId}`);
      setComments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setCommentsLoading(false); }
  }, []);

  // Fetch comments whenever the lightbox opens on a new photo
  useEffect(() => {
    if (lightboxIdx >= 0 && photos[lightboxIdx]) {
      fetchComments(photos[lightboxIdx].id);
      setNewComment("");
    } else {
      setComments([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIdx]);

  const postComment = async (e) => {
    e?.preventDefault();
    if (!newComment.trim() || !lightboxPhoto) return;
    setPosting(true);
    try {
      const c = await apiFetch("/media-comments/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: lightboxPhoto.id, trip_id: activeTrip, body: newComment.trim() }),
      });
      setComments((prev) => [...prev, c]);
      setNewComment("");
      logActivity(activeTrip, "commented_photo", lightboxPhoto?.caption || "a photo");
    } catch { /* silent */ }
    finally { setPosting(false); }
  };

  const deleteComment = async (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await apiFetch(`/media-comments/${commentId}`, { method: "DELETE" });
    } catch { /* already removed */ }
  };

  // ── Multi-select batch share ──────────────────────────────────────────────

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchShare = async () => {
    const selected = photos.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const urls = selected.map((p) => p.public_url);
    const text = `Check out ${selected.length} photo${selected.length > 1 ? "s" : ""} from our trip!\n\n${urls.join("\n")}`;

    if (navigator.share) {
      try {
        // Try sharing with files if supported
        const blobs = await Promise.all(
          selected.slice(0, 10).map(async (p) => {
            try {
              const r = await fetch(p.public_url);
              const blob = await r.blob();
              return new File([blob], `trip-photo-${p.id.slice(0, 8)}.jpg`, { type: blob.type });
            } catch { return null; }
          })
        );
        const files = blobs.filter(Boolean);

        if (files.length > 0 && navigator.canShare?.({ files })) {
          await navigator.share({ text: `${selected.length} photos from our trip!`, files });
        } else {
          await navigator.share({ title: "Trip Photos", text });
        }
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      alert(`${selected.length} photo link${selected.length > 1 ? "s" : ""} copied to clipboard!`);
    }
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // ── Lightbox nav ──────────────────────────────────────────────────────────

  const lightboxPhoto = lightboxIdx >= 0 && lightboxIdx < photos.length ? photos[lightboxIdx] : null;

  const lightboxPrev = () => setLightboxIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
  const lightboxNext = () => setLightboxIdx((i) => (i < photos.length - 1 ? i + 1 : 0));

  useEffect(() => {
    if (lightboxIdx < 0) return;
    const handler = (e) => {
      if (e.key === "Escape") setLightboxIdx(-1);
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Active album info ─────────────────────────────────────────────────────

  const activeAlbum = albums.find((a) => a.trip_id === activeTrip);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto">

          {/* ── Hero header ──────────────────────────────────────────────── */}
          <div className="relative px-8 pt-8 pb-6" style={{ background: "linear-gradient(135deg, #160f29 0%, #183a37 100%)" }}>
            <div className="flex items-end justify-between">
              <div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-xs font-medium mb-2 flex items-center gap-1 opacity-60 hover:opacity-100 transition"
                  style={{ color: "#fbfbf2" }}
                >
                  <span>&larr;</span> Dashboard
                </button>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#fbfbf2" }}>
                  Trip Gallery
                </h1>
                <p className="text-sm mt-1 opacity-60" style={{ color: "#fbfbf2" }}>
                  {activeAlbum
                    ? `${activeAlbum.trip_name} \u00B7 ${activeAlbum.photo_count} photo${activeAlbum.photo_count !== 1 ? "s" : ""}`
                    : "Share memories with your group"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectMode ? (
                  <>
                    <span className="text-xs font-medium" style={{ color: "rgba(251,251,242,0.6)" }}>
                      {selectedIds.size} selected
                    </span>
                    <button
                      onClick={handleBatchShare}
                      disabled={selectedIds.size === 0}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-40"
                      style={{ background: "#fbfbf2", color: "#160f29" }}
                    >
                      Share {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                    </button>
                    <button
                      onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium transition"
                      style={{ color: "rgba(251,251,242,0.7)", border: "1px solid rgba(251,251,242,0.2)" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* View mode toggle */}
                    <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(251,251,242,0.2)" }}>
                      <button
                        onClick={() => setViewMode('grid')}
                        className="px-4 py-2.5 text-sm font-medium transition"
                        style={{
                          background: viewMode === 'grid' ? "#183a37" : "transparent",
                          color: viewMode === 'grid' ? "#fbfbf2" : "rgba(251,251,242,0.6)",
                        }}
                      >
                        Grid
                      </button>
                      <button
                        onClick={() => setViewMode('grouped')}
                        className="px-4 py-2.5 text-sm font-medium transition"
                        style={{
                          background: viewMode === 'grouped' ? "#183a37" : "transparent",
                          color: viewMode === 'grouped' ? "#fbfbf2" : "rgba(251,251,242,0.6)",
                        }}
                      >
                        Grouped
                      </button>
                    </div>
                    {photos.length > 0 && (
                      <button
                        onClick={() => setSelectMode(true)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition"
                        style={{ color: "rgba(251,251,242,0.7)", border: "1px solid rgba(251,251,242,0.2)" }}
                      >
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-6 py-3 rounded-2xl text-sm font-semibold transition active:scale-95"
                      style={{ background: "#fbfbf2", color: "#160f29", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
                    >
                      + Share Photo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Album tabs ──────────────────────────────────────────────── */}
            {albums.length > 1 && (
              <div className="flex gap-2 mt-5 overflow-x-auto pb-1 no-scrollbar">
                {albums.map((album) => (
                  <button
                    key={album.trip_id}
                    onClick={() => setActiveTripAndPersist(album.trip_id)}
                    className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition"
                    style={
                      activeTrip === album.trip_id
                        ? { background: "rgba(251,251,242,0.2)", color: "#fbfbf2", backdropFilter: "blur(8px)" }
                        : { background: "rgba(251,251,242,0.06)", color: "rgba(251,251,242,0.5)" }
                    }
                  >
                    {album.trip_name}
                    <span className="ml-1.5 opacity-60">{album.photo_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Grouped view ─────────────────────────────────────────────── */}
          {viewMode === 'grouped' && (
            <div className="px-8 py-6">
              {groupedLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
                </div>
              ) : groupedData.length === 0 ? (
                <EmptyState
                  icon="📸"
                  title="No photos yet"
                  subtitle="Upload your first memory from this trip."
                  action={{ label: "Upload Photo", onClick: () => setShowUpload(true) }}
                />
              ) : (
                <div className="space-y-8">
                  {groupedData.map((group) => (
                    <div key={group.group_id}>
                      {/* Group label header */}
                      <h2 className="text-base font-bold mb-3" style={{ color: "#160f29" }}>
                        {group.label}
                        <span className="ml-2 text-xs font-normal" style={{ color: "#9ca3af" }}>
                          {group.photos.length} photo{group.photos.length !== 1 ? "s" : ""}
                        </span>
                      </h2>

                      {/* Horizontal scroll row of thumbnails */}
                      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {group.photos.map((photo) => {
                          // Find the global index for lightbox navigation
                          const globalIdx = photos.findIndex((p) => p.id === photo.id);
                          return (
                            <div
                              key={photo.id}
                              className="relative shrink-0 rounded-2xl overflow-hidden cursor-pointer group"
                              style={{ width: 200, height: 160, background: "#e5e7eb" }}
                              onClick={() => globalIdx >= 0 ? setLightboxIdx(globalIdx) : null}
                            >
                              <img
                                src={photo.thumbnail_url || photo.public_url}
                                alt={photo.caption || "Trip photo"}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                              {/* Gradient + caption on hover */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                              {photo.caption && (
                                <p className="absolute bottom-2 left-2 right-2 text-[11px] text-white/90 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                  {photo.caption}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Photo grid ───────────────────────────────────────────────── */}
          {viewMode === 'grid' && (
          <div className="px-8 py-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              </div>
            ) : photos.length === 0 ? (
              <EmptyState
                icon="📸"
                title="No photos yet"
                subtitle="Upload your first memory from this trip."
                action={{ label: "Upload Photo", onClick: () => setShowUpload(true) }}
              />
            ) : (
              <>
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4" style={{ columnGap: "1rem" }}>
                {photos.map((photo, idx) => {
                  const bgColor = avatarColor(photo.uploaded_by_name);
                  const isSelected = selectedIds.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className="group relative break-inside-avoid rounded-2xl overflow-hidden cursor-pointer"
                      style={{ background: "#e5e7eb", outline: isSelected ? "3px solid #183a37" : "none", outlineOffset: -3 }}
                      onClick={() => selectMode ? toggleSelect(photo.id) : setLightboxIdx(idx)}
                    >
                      <img
                        src={photo.thumbnail_url || photo.public_url}
                        alt={photo.caption || "Trip photo"}
                        className="w-full block transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />

                      {/* Select checkbox */}
                      {selectMode && (
                        <div className="absolute top-3 left-3 z-10">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center border-2 transition"
                            style={{
                              background: isSelected ? "#183a37" : "rgba(0,0,0,0.3)",
                              borderColor: isSelected ? "#183a37" : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {isSelected && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quick action buttons (top-right, visible on hover) */}
                      {!selectMode && (
                        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                          <button
                            onClick={(e) => handleLike(photo.id, e)}
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                            title={photo.liked_by_me ? "Unlike" : "Like"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={photo.liked_by_me ? "#ef4444" : "none"} stroke={photo.liked_by_me ? "#ef4444" : "white"} strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleSave(photo.id, e)}
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                            title={photo.saved_by_me ? "Unsave" : "Save"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={photo.saved_by_me ? "white" : "none"} stroke="white" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleShare(photo, e)}
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                            title="Share"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                      {/* Bottom info bar on hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: bgColor, color: "#fbfbf2" }}
                            >
                              {(photo.uploaded_by_name || "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {photo.uploaded_by_name || "Group Member"}
                              </p>
                              <p className="text-[10px] text-white/50">{timeAgo(photo.created_at)}</p>
                            </div>
                          </div>
                          {(photo.like_count || 0) > 0 && (
                            <span className="text-[10px] text-white/60 shrink-0">
                              {photo.like_count} {photo.like_count === 1 ? "like" : "likes"}
                            </span>
                          )}
                        </div>
                        {photo.caption && (
                          <p className="text-xs text-white/80 mt-1.5 line-clamp-2">{photo.caption}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-8 py-3 rounded-2xl text-sm font-semibold transition active:scale-95 disabled:opacity-40"
                    style={{ background: "#160f29", color: "#fbfbf2" }}
                  >
                    {isFetchingNextPage ? "Loading..." : "Load more photos"}
                  </button>
                </div>
              )}
              </>
            )}
          </div>
          )}
        </main>
      </div>

      {/* ═══ LIGHTBOX ════════════════════════════════════════════════════════ */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}
          onClick={() => setLightboxIdx(-1)}
        >
          {/* Close */}
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition z-10"
            onClick={() => setLightboxIdx(-1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <div className="max-w-5xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.display_url || lightboxPhoto.public_url}
              alt={lightboxPhoto.caption || ""}
              className="max-h-[70vh] max-w-full object-contain rounded-lg"
              loading="lazy"
              decoding="async"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            />

            {/* Info bar below image */}
            <div className="w-full max-w-2xl mt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: avatarColor(lightboxPhoto.uploaded_by_name), color: "#fbfbf2" }}
                  >
                    {(lightboxPhoto.uploaded_by_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {lightboxPhoto.uploaded_by_name || "Group Member"}
                    </p>
                    <p className="text-xs text-white/40">{timeAgo(lightboxPhoto.created_at)}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(lightboxPhoto.id)}
                    disabled={likingId === lightboxPhoto.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-white/10"
                    style={{ color: lightboxPhoto.liked_by_me ? "#ef4444" : "rgba(255,255,255,0.6)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxPhoto.liked_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {(lightboxPhoto.like_count || 0) > 0 ? lightboxPhoto.like_count : "Like"}
                  </button>

                  {/* Save */}
                  <button
                    onClick={() => handleSave(lightboxPhoto.id)}
                    disabled={savingId === lightboxPhoto.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-white/10"
                    style={{ color: lightboxPhoto.saved_by_me ? "#fbbf24" : "rgba(255,255,255,0.6)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxPhoto.saved_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                    {lightboxPhoto.saved_by_me ? "Saved" : "Save"}
                  </button>

                  {/* Share */}
                  <button
                    onClick={(e) => handleShare(lightboxPhoto, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    Share
                  </button>

                  <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.15)" }} />

                  <button
                    onClick={() => startEdit(lightboxPhoto)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(lightboxPhoto.id)}
                    disabled={deletingId === lightboxPhoto.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition"
                  >
                    {deletingId === lightboxPhoto.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>

              {/* Caption display / edit */}
              {editingId === lightboxPhoto.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    autoFocus
                    placeholder="Add a caption..."
                    className="flex-1 px-3 py-2 rounded-xl text-sm bg-white/10 text-white border border-white/10 outline-none focus:border-white/30"
                    onKeyDown={(e) => { if (e.key === "Enter") saveCaption(); if (e.key === "Escape") setEditingId(null); }}
                  />
                  <button onClick={saveCaption} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white">Cancel</button>
                </div>
              ) : lightboxPhoto.caption ? (
                <p className="text-sm text-white/70 mt-2">{lightboxPhoto.caption}</p>
              ) : null}

              {/* Comments section */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Comments {comments.length > 0 && `(${comments.length})`}
                </p>

                {commentsLoading && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</p>
                )}

                {!commentsLoading && comments.length === 0 && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Be the first to comment.</p>
                )}

                <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                  {comments.map((c) => {
                    const u = c.users;
                    const name = u?.full_name || u?.username || "Member";
                    return (
                      <div key={c.id} className="flex items-start gap-2 group">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                          style={{ background: avatarColor(name), color: "#fbfbf2" }}
                        >
                          {name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white/80">{name} </span>
                          <span className="text-xs text-white/60">{c.body}</span>
                        </div>
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-white/0 group-hover:text-white/30 hover:!text-red-400 transition text-xs shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={postComment} className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment…"
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white/10 text-white border border-white/10 outline-none focus:border-white/30 placeholder:text-white/30"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !newComment.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/20 text-white hover:bg-white/30 disabled:opacity-40 transition"
                  >
                    {postingComment ? "…" : "Post"}
                  </button>
                </form>
              </div>

              {/* Counter */}
              <p className="text-xs text-white/30 mt-3 text-center">
                {lightboxIdx + 1} / {photos.length}
              </p>
            </div>
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ═══ UPLOAD MODAL ════════════════════════════════════════════════════ */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={closeUpload}
        >
          <div
            className="w-full rounded-3xl overflow-hidden"
            style={{ maxWidth: 480, background: "#fff", boxShadow: "0 32px 80px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-0 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#160f29" }}>Share a Photo</h2>
              <button onClick={closeUpload} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition" style={{ color: "#9ca3af" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* Drop zone / preview */}
              <div
                className="relative rounded-2xl overflow-hidden transition-all cursor-pointer"
                style={{
                  border: uploadPreview ? "none" : "2px dashed #d1d5db",
                  background: uploadPreview ? "#000" : "#fafafa",
                  minHeight: uploadPreview ? 0 : 200,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="w-full max-h-72 object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#f3f4f6" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "#374151" }}>Click to select a photo</p>
                    <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>JPG, PNG, WEBP up to 10MB</p>
                  </div>
                )}
              </div>

              {/* Caption input */}
              <input
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
              />

              {uploadError && <p className="text-xs text-center" style={{ color: "#dc2626" }}>{uploadError}</p>}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeUpload}
                  disabled={uploading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition"
                  style={{ background: "#f3f4f6", color: "#5c6b73" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                  style={{ background: "#160f29", color: "#fbfbf2" }}
                >
                  {uploading ? "Sharing..." : "Share"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
