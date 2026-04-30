import { useState, useEffect, useCallback } from 'react';

// ── Trip card generator (Canvas) ──────────────────────────────────────────────

export function generateTripCard(tripName, stats, storyUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;   // Instagram Story width
  canvas.height = 1920;  // Instagram Story height
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#160f29');
  grad.addColorStop(1, '#183a37');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle top accent line
  const accent = ctx.createLinearGradient(0, 0, 1080, 0);
  accent.addColorStop(0, 'transparent');
  accent.addColorStop(0.5, '#c8a96e');
  accent.addColorStop(1, 'transparent');
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 200);
  ctx.lineTo(1080, 200);
  ctx.stroke();

  // ✈️ plane emoji
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.fillText('✈️', 540, 380);

  // Trip name
  ctx.fillStyle = '#fbfbf2';
  ctx.font = 'bold 80px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';

  // Word-wrap long trip names
  const words = tripName.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > 900 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 96;
  const startY = 560 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, 540, startY + i * lineHeight));

  // Stats row
  const statsY = startY + lines.length * lineHeight + 60;
  ctx.font = '52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  const parts = [];
  if (stats.total_days > 0) parts.push(`${stats.total_days} day${stats.total_days !== 1 ? 's' : ''}`);
  if (stats.total_photos > 0) parts.push(`${stats.total_photos} photo${stats.total_photos !== 1 ? 's' : ''}`);
  ctx.fillText(parts.join('  ·  '), 540, statsY);

  // Gold divider
  const divGrad = ctx.createLinearGradient(0, 0, 1080, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, '#c8a96e');
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(240, statsY + 60);
  ctx.lineTo(840, statsY + 60);
  ctx.stroke();

  // "memories for life" tagline
  ctx.font = 'italic 40px Georgia, serif';
  ctx.fillStyle = 'rgba(200,169,110,0.8)';
  ctx.fillText('memories for life', 540, statsY + 130);

  // TravelerHub watermark — host derived from the public story URL so each
  // deploy stamps its own domain instead of hardcoding ours.
  let watermark = 'TravelerHub';
  try {
    if (storyUrl) watermark = new URL(storyUrl).hostname;
  } catch { /* leave default */ }
  ctx.font = '36px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(watermark, 540, 1820);

  return canvas.toDataURL('image/png');
}

// ── ShareStoryModal ───────────────────────────────────────────────────────────

/**
 * Props:
 *   storyUrl  — public story URL, e.g. https://travelhub.fozhan.dev/story/public/TOKEN
 *   tripName  — e.g. "Our Bali Trip"
 *   stats     — { total_days, total_photos, total_spent }
 *   onClose   — called when modal should close
 */
export default function ShareStoryModal({ storyUrl, tripName, stats, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const shareText = `Just got back from ${tripName}! 🌍 ${stats.total_days} days, ${stats.total_photos} photos, memories for life. See our trip story →`;

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function showCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const handleNativeShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: `${tripName} — Trip Story`,
        text: shareText,
        url: storyUrl,
      }).catch(() => {}); // user cancelled — not an error
    } else {
      // Desktop fallback: copy full text + URL to clipboard
      navigator.clipboard.writeText(`${shareText} ${storyUrl}`).catch(() => {});
      showCopied();
    }
  }, [tripName, shareText, storyUrl]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(storyUrl).catch(() => {});
    showCopied();
  }, [storyUrl]);

  function handleDownloadCard() {
    try {
      const dataUrl = generateTripCard(tripName, stats, storyUrl);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${tripName.replace(/\s+/g, '_')}_trip_card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadReady(true);
      setTimeout(() => setDownloadReady(false), 2500);
    } catch (err) {
      console.error('[ShareStoryModal] card generation failed:', err);
    }
  }

  // Platform share buttons (non-native)
  const platformButtons = [
    {
      label: 'Facebook',
      icon: '📘',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storyUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      label: 'X / Twitter',
      icon: '🐦',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(storyUrl)}`,
    },
    {
      label: 'WhatsApp',
      icon: '💬',
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + storyUrl)}`,
    },
    {
      label: 'Telegram',
      icon: '✈️',
      href: `https://t.me/share/url?url=${encodeURIComponent(storyUrl)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  // ── Styles ────────────────────────────────────────────────────────────────

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '0 0 0 0',
  };

  const sheetStyle = {
    background: '#1a1130',
    border: '1px solid rgba(255,255,255,0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
    maxWidth: 560,
    padding: '28px 24px 40px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#fbfbf2',
    maxHeight: '92vh',
    overflowY: 'auto',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your story"
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={sheetStyle}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Share your story
          </h2>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          {tripName}
        </p>

        {/* ── Primary: Web Share API ─────────────────────────────────────── */}
        <button
          onClick={handleNativeShare}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            width: '100%',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(200,169,110,0.18) 0%, rgba(74,222,128,0.12) 100%)',
            border: '1px solid rgba(200,169,110,0.45)',
            borderRadius: 16,
            color: '#fbfbf2',
            cursor: 'pointer',
            textAlign: 'left',
            marginBottom: 20,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>📤</span>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {navigator.share ? 'Share (all apps)' : 'Copy story link'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {navigator.share
                ? 'Instagram, TikTok, Messages & more'
                : 'Copies the share text + link to clipboard'}
            </p>
          </div>
          {copied && !navigator.share && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#4ade80', fontWeight: 700 }}>
              ✓ Copied!
            </span>
          )}
        </button>

        {/* Instagram / TikTok note */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 24,
            fontSize: 12,
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Instagram Stories or TikTok?</strong>{' '}
          Tap "Share (all apps)" on your phone, or download the trip card below to post as a Story.
        </div>

        {/* ── Platform grid ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 12,
          }}
        >
          {platformButtons.map(({ label, icon, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12,
                color: '#fbfbf2',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              {label}
            </a>
          ))}
        </div>

        {/* ── Download trip card ─────────────────────────────────────────── */}
        <button
          onClick={handleDownloadCard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '13px 16px',
            background: downloadReady ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${downloadReady ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 12,
            color: downloadReady ? '#4ade80' : '#fbfbf2',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'left',
            marginBottom: 10,
            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!downloadReady) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            if (!downloadReady) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
        >
          <span style={{ fontSize: 20 }}>{downloadReady ? '✓' : '🖼️'}</span>
          {downloadReady ? 'Trip card saved!' : 'Download trip card'}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
            {downloadReady ? '' : '1080 × 1920 PNG'}
          </span>
        </button>

        {/* ── Copy link ──────────────────────────────────────────────────── */}
        <button
          onClick={handleCopyLink}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '13px 16px',
            background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 12,
            color: copied ? '#4ade80' : '#fbfbf2',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'left',
            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
        >
          <span style={{ fontSize: 20 }}>🔗</span>
          {copied ? '✓ Copied!' : 'Copy link'}
        </button>

      </div>
    </div>
  );
}
