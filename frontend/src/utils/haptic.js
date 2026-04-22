import { isNative } from './platform';

let HapticsPlugin = null;

async function getHaptics() {
  if (!HapticsPlugin && isNative()) {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    HapticsPlugin = { Haptics, ImpactStyle, NotificationType };
  }
  return HapticsPlugin;
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
  // Web fallback
  if (!navigator.vibrate) return;
  const patterns = { light: 30, medium: 60, heavy: 100, success: [30, 50, 30] };
  navigator.vibrate(patterns[type] ?? 30);
}
