import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, API_BASE, getToken } from '../services/api.js';
import ShareStoryModal from './ShareStoryModal.jsx';

// ── Category emoji map ────────────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  food: '🍽️',
  dining: '🍽️',
  restaurant: '🍽️',
  transport: '🚗',
  transportation: '🚗',
  flight: '✈️',
  lodging: '🏨',
  hotel: '🏨',
  accommodation: '🏨',
  activity: '🎟️',
  entertainment: '🎟️',
  shopping: '🛍️',
  health: '💊',
  other: '💳',
};

function getCategoryEmoji(category) {
  if (!category) return '💳';
  const key = category.toLowerCase().trim();
  return CATEGORY_EMOJI[key] || '💳';
}

// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ style }) {
  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s infinite',
        borderRadius: 8,
        ...style,
      }}
    />
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({ day, index }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Stagger fade-in by card index
    const t = setTimeout(() => setVisible(true), 80 + index * 60);
    return () => clearTimeout(t);
  }, [index]);

  const dateLabel = `${day.day_label} \u2014 ${formatDate(day.date)}`;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '28px 28px 24px',
        marginBottom: 20,
      }}
    >
      {/* Day label */}
      <p
        style={{
          color: '#4ade80',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        {dateLabel}
      </p>

      {/* Photo strip */}
      {day.photos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: day.expenses.length > 0 ? 20 : 0,
            scrollbarWidth: 'none',
          }}
        >
          {day.photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                flexShrink: 0,
                width: 220,
                height: 200,
                borderRadius: 14,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.06)',
                position: 'relative',
              }}
            >
              <img
                src={photo.public_url}
                alt={photo.caption || 'Trip photo'}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {photo.caption && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 10px 10px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
                  }}
                >
                  <p
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 11,
                      margin: 0,
                      lineHeight: 1.35,
                    }}
                  >
                    {photo.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {day.photos.length === 0 && day.expenses.length > 0 && (
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginBottom: 16 }}>
          No photos on this day
        </p>
      )}

      {/* Expense pills */}
      {day.expenses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {day.expenses.map((exp) => (
            <div
              key={exp.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 999,
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 14 }}>{getCategoryEmoji(exp.category)}</span>
              <span style={{ fontWeight: 500 }}>{exp.merchant}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
              <span style={{ color: '#4ade80', fontWeight: 600 }}>
                ${exp.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Day total */}
      {day.expenses.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Day total:{' '}
            <span style={{ color: '#4ade80', fontWeight: 700 }}>
              ${day.total_spent.toFixed(2)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * StoryMode — full-page shareable post-trip timeline.
 *
 * Props:
 *   tripId    — trip UUID. Falls back to :tripId URL param, then localStorage.
 *   isPublic  — when true, fetches via the no-auth public endpoint using :token param.
 *   token     — public share token (used when isPublic=true).
 *
 * Routes:
 *   /trips/:tripId/story          — authenticated view
 *   /story/public/:token          — unauthenticated public view
 */
export default function StoryMode({ tripId: tripIdProp, isPublic = false, token: tokenProp }) {
  const params = useParams();
  const tripId =
    tripIdProp ||
    params.tripId ||
    localStorage.getItem('active_group_id') ||
    localStorage.getItem('activeGroupId') ||
    '';
  const publicToken = tokenProp || params.token || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // Share Story state
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');

    let fetchPromise;
    if (isPublic) {
      if (!publicToken) {
        setError('Invalid share link.');
        setLoading(false);
        return;
      }
      // Public endpoint — no auth header needed
      fetchPromise = fetch(`${API_BASE}/public/story/${publicToken}`)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          return res.json();
        });
    } else {
      if (!tripId) {
        setError('No trip selected.');
        setLoading(false);
        return;
      }
      fetchPromise = apiFetch(`/trips/${tripId}/story`);
    }

    fetchPromise
      .then((res) => setData(res))
      .catch((err) => {
        console.error('[StoryMode] fetch error', err);
        setError('Failed to load story. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [tripId, isPublic, publicToken]);

  function handleShare() {
    window.print();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Could not copy link. Please copy the URL manually.');
    }
  }

  async function handleShareStory() {
    if (shareUrl) {
      // Already generated — open the modal straight away
      setShowShareModal(true);
      return;
    }
    setShareLoading(true);
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/story/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to generate share link');
      const result = await res.json();
      setShareUrl(result.public_url);
      setShowShareModal(true);
    } catch (err) {
      console.error('[StoryMode] share error:', err);
      alert('Could not generate a share link. Please try again.');
    } finally {
      setShareLoading(false);
    }
  }

  // ── Date range label ───────────────────────────────────────────────────────
  let dateRange = '';
  if (data?.timeline?.length) {
    const first = formatDateShort(data.timeline[0].date);
    const last = formatDateShort(data.timeline[data.timeline.length - 1].date);
    dateRange = first === last ? first : `${first} – ${last}`;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const pageStyle = {
    minHeight: '100vh',
    background: '#160f29',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#fbfbf2',
    overflowX: 'hidden',
  };

  // ── Error / no trip ────────────────────────────────────────────────────────

  if (!loading && (error || !tripId)) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>✈️</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No trip found</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            {error || 'Select a trip to view its story.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>
          <Skeleton style={{ height: 52, width: '60%', marginBottom: 12 }} />
          <Skeleton style={{ height: 20, width: '35%', marginBottom: 36 }} />
          <Skeleton style={{ height: 180, marginBottom: 16 }} />
          <Skeleton style={{ height: 180, marginBottom: 16 }} />
          <Skeleton style={{ height: 180 }} />
        </div>
      </div>
    );
  }

  const { trip, timeline, summary } = data;

  // ── Empty trip ─────────────────────────────────────────────────────────────

  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>📷</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {trip.name || 'This trip'}
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            No photos or expenses recorded yet. Start adding them and come back!
          </p>
        </div>
      </div>
    );
  }

  // ── Full render ────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* Print + shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media print {
          .story-no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
        }
        ::-webkit-scrollbar { height: 4px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 100px' }}>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div
          style={{
            paddingTop: 72,
            paddingBottom: 48,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 40,
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(32px, 6vw, 56px)',
              fontWeight: 800,
              color: '#fbfbf2',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: '0 0 12px',
            }}
          >
            {trip.name}
          </h1>

          {dateRange && (
            <p
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.45)',
                margin: '0 0 20px',
                fontWeight: 400,
              }}
            >
              {dateRange}
            </p>
          )}

          {trip.description && (
            <p
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.6)',
                margin: '0 0 28px',
                lineHeight: 1.6,
                maxWidth: 560,
              }}
            >
              {trip.description}
            </p>
          )}

          {/* Summary stats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {[
              summary.total_days > 0 && `${summary.total_days} day${summary.total_days !== 1 ? 's' : ''}`,
              summary.total_photos > 0 && `${summary.total_photos} photo${summary.total_photos !== 1 ? 's' : ''}`,
              summary.total_spent > 0 && `$${summary.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent`,
            ]
              .filter(Boolean)
              .map((stat, i, arr) => (
                <span key={stat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                    {stat}
                  </span>
                  {i < arr.length - 1 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>·</span>
                  )}
                </span>
              ))}

            {summary.top_categories.length > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>·</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {summary.top_categories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        fontSize: 12,
                        padding: '3px 10px',
                        background: 'rgba(74,222,128,0.12)',
                        border: '1px solid rgba(74,222,128,0.25)',
                        borderRadius: 999,
                        color: '#4ade80',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        <div>
          {timeline.map((day, idx) => (
            <DayCard key={day.date} day={day} index={idx} />
          ))}
        </div>

        {/* ── Share actions ────────────────────────────────────────────────── */}
        <div
          className="story-no-print"
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 48,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleShare}
            style={{
              padding: '14px 32px',
              background: '#fbfbf2',
              color: '#160f29',
              border: 'none',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Save as PDF
          </button>

          {/* Share Story button — public view uses the current page URL */}
          {isPublic && (
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                padding: '14px 32px',
                background: 'rgba(200,169,110,0.15)',
                color: '#c8a96e',
                border: '1px solid #c8a96e',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Share Story 📤
            </button>
          )}

          {/* Share Story button — only on authenticated view */}
          {!isPublic && (
            <button
              onClick={handleShareStory}
              disabled={shareLoading}
              style={{
                padding: '14px 32px',
                background: 'rgba(200,169,110,0.15)',
                color: '#c8a96e',
                border: '1px solid #c8a96e',
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: shareLoading ? 'default' : 'pointer',
                transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                letterSpacing: '0.01em',
                opacity: shareLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => { if (!shareLoading) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = shareLoading ? '0.7' : '1'; }}
            >
              {shareLoading ? 'Generating…' : 'Share Story 📤'}
            </button>
          )}

          <button
            onClick={handleCopyLink}
            style={{
              padding: '14px 32px',
              background: 'transparent',
              color: copied ? '#4ade80' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${copied ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
              letterSpacing: '0.01em',
            }}
          >
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Share Story modal */}
      {showShareModal && (
        <ShareStoryModal
          storyUrl={shareUrl || window.location.href}
          tripName={trip.name}
          stats={summary}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
