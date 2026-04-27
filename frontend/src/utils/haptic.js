import { isNative } from './platform';

let HapticsPlugin = null;
let warnedNoVibrate = false;

async function getHaptics() {
  if (!HapticsPlugin && isNative()) {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    HapticsPlugin = { Haptics, ImpactStyle, NotificationType };
  }
  return HapticsPlugin;
}

// CSS keyframes injected once: a quick scale-down "tap" animation that we
// can fire on the active element when no real vibration API exists. Reads
// as visible feedback for desktop users / phones with no vibrator (iPhones
// in PWA-from-Safari context, etc.).
function ensureVisualKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('haptic-fallback-style')) return;
  const style = document.createElement('style');
  style.id = 'haptic-fallback-style';
  style.textContent = `
    @keyframes hapticTap {
      0%   { transform: scale(1); }
      50%  { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
    .haptic-tap { animation: hapticTap 160ms ease-out; }
  `;
  document.head.appendChild(style);
}

function visualFallback() {
  if (typeof document === 'undefined') return;
  ensureVisualKeyframes();
  const target = document.activeElement;
  if (!target || target === document.body || target === document.documentElement) return;
  target.classList.remove('haptic-tap');
  // Force reflow so the animation restarts even if it just played.
  // eslint-disable-next-line no-unused-expressions
  target.offsetWidth;
  target.classList.add('haptic-tap');
  setTimeout(() => target.classList.remove('haptic-tap'), 200);
}

export async function haptic(type = 'light') {
  if (isNative()) {
    const h = await getHaptics();
    if (!h) return;
    const { Haptics, ImpactStyle, NotificationType } = h;
    switch (type) {
      case 'light':   return Haptics.impact({ style: ImpactStyle.Light });
      case 'medium':  return Haptics.impact({ style: ImpactStyle.Medium });
      case 'heavy':   return Haptics.impact({ style: ImpactStyle.Heavy });
      case 'success': return Haptics.notification({ type: NotificationType.Success });
      case 'warning': return Haptics.notification({ type: NotificationType.Warning });
      case 'error':   return Haptics.notification({ type: NotificationType.Error });
      default:        return Haptics.impact({ style: ImpactStyle.Light });
    }
  }
  // Web fallback — Vibration API where available, visual scale-pulse otherwise.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    const patterns = { light: 30, medium: 60, heavy: 100, success: [30, 50, 30] };
    navigator.vibrate(patterns[type] ?? 30);
    return;
  }
  if (!warnedNoVibrate && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[haptic] Vibration API unavailable — using visual scale-pulse fallback.');
    warnedNoVibrate = true;
  }
  visualFallback();
}
