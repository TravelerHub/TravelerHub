import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../config";
import { apiFetch, getToken, authHeaders } from "../../services/api.js";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { logActivity } from "../../components/ActivityFeed.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";
import ContributorStrip from "../../components/gallery/ContributorStrip.jsx";
import { CameraSmile, LockHeart, AlertSpark } from "../../components/icons/StateIcons.jsx";

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
  const [toast, setToast] = useState("");
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  // Social: likes, saves, share — track which item is in-flight
  const [likingId, setLikingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // View mode: 'grid' | 'grouped'
  const [viewMode, setViewMode] = useState('grid');

  // Focus traps for modals
  const lightboxRef = useFocusTrap(lightboxIdx >= 0);
  const uploadModalRef = useFocusTrap(showUpload);

  // Grouped view data
  const [groupedData, setGroupedData] = useState([]);
  const [groupedLoading, setGroupedLoading] = useState(false);

  // Multi-select for batch sharing
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter the grid to one contributor (Stories ribbon). null = everyone.
  const [contributorFilter, setContributorFilter] = useState(null);

  // Tracks the photo id currently animating a double-tap heart (Instagram-style)
  const [heartingId, setHeartingId] = useState(null);
  const tapMapRef = useRef(new Map());

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

  // Auto-select first album when none is active. Also recover from a stale
  // localStorage trip_id (left the trip / removed) by snapping to the first
  // album the user is still a member of, instead of letting the photos query
  // 403 forever.
  useEffect(() => {
    if (albums.length === 0) return;
    const stillMember = activeTrip && albums.some((a) => a.trip_id === activeTrip);
    if (!stillMember) {
      const firstId = albums[0].trip_id;
      setActiveTrip(firstId);
      try {
        localStorage.setItem("active_group_id", firstId);
        localStorage.setItem("activeGroupId", firstId);
      } catch { /* localStorage unavailable */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumsData]);

  // ── React Query: photos for the active trip (infinite/paginated) ─────────

  const {
    data: photosInfiniteData,
    isLoading: loading,
    isError: photosError,
    error: photosErrorObj,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["trip-media", activeTrip],
    queryFn: ({ pageParam }) =>
      apiFetch(`/trips/${activeTrip}/media?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!activeTrip,
    retry: (failureCount, err) => err?.status >= 500 && failureCount < 2,
  });
  const photos = photosInfiniteData?.pages.flatMap((p) => p.photos) ?? [];
  const photosForbidden = photosError && photosErrorObj?.status === 403;

  // Filtered grid view (per the active Stories-strip selection)
  const visiblePhotos = useMemo(() => {
    if (!contributorFilter) return photos;
    return photos.filter((p) => {
      const id = p.uploaded_by || p.uploaded_by_id || p.uploader_id || p.uploaded_by_name;
      return id === contributorFilter;
    });
  }, [photos, contributorFilter]);

  // ── useMutation: upload photo ─────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption, tripId }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption.trim()) formData.append("caption", caption.trim());
      const url = `${API_BASE}/trips/${tripId}/upload`;
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });
      } catch (networkErr) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        // fetch() throws TypeError ("Failed to fetch") for: CORS preflight
        // rejection, mixed content, DNS failure, server unreachable, or an
        // upstream proxy killing the connection (e.g. nginx
        // client_max_body_size). Log full diagnostics so the actual cause is
        // visible in DevTools instead of a generic "Failed to fetch".
        // eslint-disable-next-line no-console
        console.error("[upload] network failure", {
          url,
          fileSize: file.size,
          fileName: file.name,
          fileType: file.type,
          origin: typeof window !== "undefined" ? window.location.origin : "?",
          error: networkErr,
        });
        throw new Error(
          `Couldn't reach ${API_BASE} (${sizeMB} MB photo). ` +
          `Check the Network tab in DevTools — most likely cause is CORS, ` +
          `a wrong API URL, or an upstream proxy rejecting the upload.`
        );
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${res.status})`);
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

  const [groupedError, setGroupedError] = useState(null);

  const fetchGroupedPhotos = useCallback(async () => {
    if (!activeTrip) { setGroupedData([]); return; }
    setGroupedLoading(true);
    setGroupedError(null);
    try {
      const data = await apiFetch(`/trips/${activeTrip}/media/grouped`);
      setGroupedData(data.groups || []);
    } catch (err) {
      setGroupedData([]);
      setGroupedError(err);
    } finally {
      setGroupedLoading(false);
    }
  }, [activeTrip]);

  useEffect(() => {
    if (viewMode === 'grouped') fetchGroupedPhotos();
  }, [viewMode, fetchGroupedPhotos]);

  // ── Upload handlers ───────────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation to give instant feedback before hitting the server
    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — matches server limit
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Only image files are allowed (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("File is too large. Maximum size is 20 MB.");
      return;
    }

    setUploadFile(file);
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    if (!activeTrip) {
      setUploadError("No trip selected. Please select a trip album first.");
      return;
    }
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

  // Double-tap a tile to like (Instagram-style). On the second tap within
  // 280 ms we trigger like + the floating-heart animation, then suppress the
  // open-lightbox click that this gesture would normally have caused.
  const handleTilePointer = (photo) => {
    if (selectMode) return false; // selectMode owns taps
    const now = Date.now();
    const map = tapMapRef.current;
    const last = map.get(photo.id) || 0;
    if (now - last < 280) {
      map.delete(photo.id);
      if (!photo.liked_by_me) handleLike(photo.id);
      setHeartingId(photo.id);
      setTimeout(() => setHeartingId((cur) => (cur === photo.id ? null : cur)), 700);
      return true; // suppress single-tap action
    }
    map.set(photo.id, now);
    return false;
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
      showToast("Link copied");
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
      showToast(`${selected.length} link${selected.length > 1 ? "s" : ""} copied`);
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

        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">

          {/* ── Hero header ──────────────────────────────────────────────── */}
          <div className="relative px-5 sm:px-8 pt-5 pb-4 sm:pt-6 sm:pb-5" style={{ background: "linear-gradient(135deg, #160f29 0%, #183a37 100%)" }}>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-xs font-medium mb-1.5 flex items-center gap-1 opacity-60 hover:opacity-100 transition"
                  style={{ color: "#fbfbf2" }}
                >
                  <span>&larr;</span> Dashboard
                </button>
                <h1
                  className="text-xl sm:text-2xl font-bold leading-tight truncate"
                  style={{ color: "#fbfbf2" }}
                >
                  {activeAlbum?.trip_name || "Trip Gallery"}
                </h1>
                <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "rgba(251,251,242,0.7)" }}>
                  <span>
                    <strong style={{ color: "#fbfbf2" }}>{activeAlbum?.photo_count ?? photos.length}</strong>{" "}
                    photo{(activeAlbum?.photo_count ?? photos.length) === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden="true">{"·"}</span>
                  <span>
                    <strong style={{ color: "#fbfbf2" }}>
                      {new Set(photos.map((p) => p.uploaded_by || p.uploaded_by_id || p.uploader_id || p.uploaded_by_name).filter(Boolean)).size}
                    </strong>{" "}
                    contributor{new Set(photos.map((p) => p.uploaded_by || p.uploaded_by_id || p.uploader_id || p.uploaded_by_name).filter(Boolean)).size === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0 max-w-full">
                {selectMode ? (
                  <>
                    <span className="text-xs font-medium whitespace-nowrap" style={{ color: "rgba(251,251,242,0.6)" }}>
                      {selectedIds.size} selected
                    </span>
                    <button
                      onClick={handleBatchShare}
                      disabled={selectedIds.size === 0}
                      className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition active:scale-95 disabled:opacity-40"
                      style={{ background: "#fbfbf2", color: "#160f29" }}
                    >
                      Share {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                    </button>
                    <button
                      onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition"
                      style={{ color: "rgba(251,251,242,0.7)", border: "1px solid rgba(251,251,242,0.2)" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* View mode toggle — tighter on mobile */}
                    <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid rgba(251,251,242,0.2)" }}>
                      <button
                        onClick={() => setViewMode('grid')}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition"
                        style={{
                          background: viewMode === 'grid' ? "#183a37" : "transparent",
                          color: viewMode === 'grid' ? "#fbfbf2" : "rgba(251,251,242,0.6)",
                        }}
                      >
                        Grid
                      </button>
                      <button
                        onClick={() => setViewMode('grouped')}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition"
                        style={{
                          background: viewMode === 'grouped' ? "#183a37" : "transparent",
                          color: viewMode === 'grouped' ? "#fbfbf2" : "rgba(251,251,242,0.6)",
                        }}
                      >
                        Group
                      </button>
                    </div>
                    {/* Select button — desktop only; on mobile, long-press a tile if you want batch select */}
                    {photos.length > 0 && (
                      <button
                        onClick={() => setSelectMode(true)}
                        className="hidden sm:inline-flex px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition"
                        style={{ color: "rgba(251,251,242,0.7)", border: "1px solid rgba(251,251,242,0.2)" }}
                      >
                        Select
                      </button>
                    )}
                    {/* Share photo — gold accent, single-line, plus icon. Renders icon-only on the smallest screens. */}
                    <button
                      onClick={() => setShowUpload(true)}
                      aria-label="Share photo"
                      className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition active:scale-95"
                      style={{ background: "#c8a96e", color: "#160f29", boxShadow: "0 4px 16px rgba(200,169,110,0.25)" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="hidden xs:inline sm:inline">Share Photo</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Album tabs ──────────────────────────────────────────────── */}
            {albums.length > 0 && (
              <div className="flex items-center gap-2 mt-5 overflow-x-auto pb-1 no-scrollbar">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest opacity-60 mr-1">
                  Album
                </span>
                {albums.map((album) => (
                  <button
                    key={album.trip_id}
                    onClick={() => setActiveTrip(album.trip_id)}
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

            {/* ── Stories ribbon: contributors ──────────────────────────────── */}
            {viewMode === 'grid' && photos.length > 0 && (
              <ContributorStrip
                photos={photos}
                selectedContributorId={contributorFilter}
                onSelect={setContributorFilter}
              />
            )}
          </div>

          {/* ── Grouped view ─────────────────────────────────────────────── */}
          {viewMode === 'grouped' && (
            <div className="px-8 py-6">
              {groupedLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
                </div>
              ) : groupedError ? (
                <EmptyState
                  icon={groupedError.status === 403 ? <LockHeart /> : <AlertSpark />}
                  tone={groupedError.status === 403 ? "lock" : "warning"}
                  title={groupedError.status === 403 ? "You're not a member of this trip" : "Couldn't group photos"}
                  subtitle={
                    groupedError.status === 403
                      ? "Pick another album from the bar above, or ask the trip creator to add you."
                      : (groupedError.message || "Try the Grid view instead — grouping needs at least a few photos with location data.")
                  }
                  action={{ label: "Switch to Grid", onClick: () => setViewMode('grid') }}
                />
              ) : groupedData.length === 0 ? (
                <EmptyState
                  icon={<CameraSmile />}
                  tone="celebrate"
                  title="No groups yet"
                  subtitle="Photos cluster into stops once a few are shared. Add some to see them grouped."
                  action={{ label: "Share Photo", onClick: () => setShowUpload(true) }}
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
            ) : photosError ? (
              <EmptyState
                icon={photosForbidden ? <LockHeart /> : <AlertSpark />}
                tone={photosForbidden ? "lock" : "warning"}
                title={photosForbidden ? "You're not a member of this trip" : "Couldn't load photos"}
                subtitle={
                  photosForbidden
                    ? "Pick another album from the bar above, or ask the trip creator to add you."
                    : (photosErrorObj?.message || "Something went wrong loading this album.")
                }
                action={
                  albums.length > 1
                    ? { label: "Switch album", onClick: () => setActiveTrip(albums[0].trip_id) }
                    : null
                }
              />
            ) : photos.length === 0 ? (
              <EmptyState
                icon={<CameraSmile />}
                tone="celebrate"
                title="Nothing here yet — go make memories"
                subtitle="When you or anyone in this trip shares a photo, it lands here. Be the first."
                action={{ label: "Share your first photo", onClick: () => setShowUpload(true) }}
              />
            ) : (
              <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-1.5">
                {visiblePhotos.map((photo) => {
                  const idx = photos.indexOf(photo);
                  const bgColor = avatarColor(photo.uploaded_by_name);
                  const isSelected = selectedIds.has(photo.id);
                  // "NEW" badge if uploaded within the last 24 h
                  const ageMs = Date.now() - new Date(photo.created_at).getTime();
                  const isNew = !Number.isNaN(ageMs) && ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
                  const isHearting = heartingId === photo.id;
                  return (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden cursor-pointer rounded-md sm:rounded-lg"
                      style={{ background: "#e5e7eb", outline: isSelected ? "3px solid #c8a96e" : "none", outlineOffset: -3 }}
                      onClick={() => {
                        if (selectMode) { toggleSelect(photo.id); return; }
                        const consumed = handleTilePointer(photo);
                        if (!consumed) setLightboxIdx(idx);
                      }}
                    >
                      <img
                        src={photo.thumbnail_url || photo.public_url}
                        alt={photo.caption || "Trip photo"}
                        className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />

                      {/* "NEW" badge — fresh upload */}
                      {isNew && !selectMode && (
                        <span
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: "#c8a96e", color: "#160f29", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                        >
                          New
                        </span>
                      )}

                      {/* Floating heart on double-tap (Instagram-style) */}
                      {isHearting && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="#ef4444" className="heart-anim drop-shadow-lg">
                            <path d="M12 21s-7-4.5-7-11a4.5 4.5 0 018-2 4.5 4.5 0 018 2c0 6.5-7 11-7 11h-2z" />
                          </svg>
                        </span>
                      )}

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
                            aria-label={photo.liked_by_me ? "Unlike photo" : "Like photo"}
                            aria-pressed={!!photo.liked_by_me}
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                          >
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={photo.liked_by_me ? "#ef4444" : "none"} stroke={photo.liked_by_me ? "#ef4444" : "white"} strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleSave(photo.id, e)}
                            aria-label={photo.saved_by_me ? "Unsave photo" : "Save photo"}
                            aria-pressed={!!photo.saved_by_me}
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                          >
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={photo.saved_by_me ? "white" : "none"} stroke="white" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleShare(photo, e)}
                            aria-label="Share photo"
                            className="w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition hover:scale-110"
                            style={{ background: "rgba(0,0,0,0.4)" }}
                          >
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Persistent gradient + counts at the bottom (visible on
                          touch where there's no hover). Like count is always
                          shown if > 0; avatar + name slide up on hover. */}
                      <div
                        className="absolute inset-x-0 bottom-0 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.0) 75%)",
                          paddingTop: 24,
                        }}
                      >
                        {/* Always-visible counts row */}
                        {((photo.like_count || 0) > 0 || (photo.comment_count || 0) > 0) && (
                          <div className="flex items-center gap-3 px-2 pb-1.5 text-white/95 text-[11px] font-semibold drop-shadow">
                            {(photo.like_count || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={photo.liked_by_me ? "#ef4444" : "currentColor"} aria-hidden="true">
                                  <path d="M12 21s-7-4.5-7-11a4.5 4.5 0 018-2 4.5 4.5 0 018 2c0 6.5-7 11-7 11h-2z" />
                                </svg>
                                {photo.like_count}
                              </span>
                            )}
                            {(photo.comment_count || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
                                </svg>
                                {photo.comment_count}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover-revealed uploader strip */}
                        <div className="px-2 pb-2 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: bgColor, color: "#fbfbf2" }}
                            >
                              {(photo.uploaded_by_name || "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-white truncate leading-tight">
                                {photo.uploaded_by_name || "Group Member"}
                              </p>
                              <p className="text-[9px] text-white/55 leading-tight">{timeAgo(photo.created_at)}</p>
                            </div>
                          </div>
                          {photo.caption && (
                            <p className="text-[10px] text-white/85 mt-1 line-clamp-1">{photo.caption}</p>
                          )}
                        </div>
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

      {/* ═══ TOAST ═══════════════════════════════════════════════════════════ */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-soft-lg"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            background: "#160f29",
            color: "#fbfbf2",
          }}
          role="status"
        >
          {toast}
        </div>
      )}

      {/* ═══ LIGHTBOX ════════════════════════════════════════════════════════ */}
      {lightboxPhoto && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.caption ? `Photo: ${lightboxPhoto.caption}` : "Photo lightbox"}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}
          onClick={() => setLightboxIdx(-1)}
        >
          {/* Close */}
          <button
            aria-label="Close photo viewer"
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition z-10"
            onClick={() => setLightboxIdx(-1)}
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    aria-label={lightboxPhoto.liked_by_me ? "Unlike photo" : "Like photo"}
                    aria-pressed={!!lightboxPhoto.liked_by_me}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-white/10"
                    style={{ color: lightboxPhoto.liked_by_me ? "#ef4444" : "rgba(255,255,255,0.6)" }}
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxPhoto.liked_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {(lightboxPhoto.like_count || 0) > 0 ? lightboxPhoto.like_count : "Like"}
                  </button>

                  {/* Save */}
                  <button
                    onClick={() => handleSave(lightboxPhoto.id)}
                    disabled={savingId === lightboxPhoto.id}
                    aria-label={lightboxPhoto.saved_by_me ? "Unsave photo" : "Save photo"}
                    aria-pressed={!!lightboxPhoto.saved_by_me}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:bg-white/10"
                    style={{ color: lightboxPhoto.saved_by_me ? "#fbbf24" : "rgba(255,255,255,0.6)" }}
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={lightboxPhoto.saved_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                    {lightboxPhoto.saved_by_me ? "Saved" : "Save"}
                  </button>

                  {/* Share */}
                  <button
                    onClick={(e) => handleShare(lightboxPhoto, e)}
                    aria-label="Share photo"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
                  <label htmlFor="edit-caption" className="sr-only">Edit caption</label>
                  <input
                    id="edit-caption"
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
                          aria-label="Delete comment"
                          className="text-white/0 group-hover:text-white/30 hover:!text-red-400 transition text-xs shrink-0"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={postComment} className="flex gap-2">
                  <label htmlFor="new-comment" className="sr-only">Add a comment</label>
                  <input
                    id="new-comment"
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
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ═══ UPLOAD MODAL ════════════════════════════════════════════════════ */}
      {showUpload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={closeUpload}
        >
          <div
            ref={uploadModalRef}
            className="w-full rounded-2xl overflow-y-auto"
            style={{ maxWidth: 480, maxHeight: "90vh", background: "#fff", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-0 flex items-center justify-between">
              <h2 id="upload-modal-title" className="text-lg font-bold" style={{ color: "#160f29" }}>Share a Photo</h2>
              <button onClick={closeUpload} aria-label="Close upload dialog" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition" style={{ color: "#9ca3af" }}>
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <img src={uploadPreview} alt="Preview" loading="lazy" decoding="async" className="w-full max-h-72 object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#f3f4f6" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "#374151" }}>Click to select a photo</p>
                    <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>JPG, PNG, WEBP up to 20MB</p>
                  </div>
                )}
              </div>

              {/* Caption input */}
              <label htmlFor="upload-caption" className="sr-only">Caption (optional)</label>
              <input
                id="upload-caption"
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
