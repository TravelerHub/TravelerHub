export function haptic(type = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: 30, medium: 60, heavy: 100, success: [30, 50, 30] };
  navigator.vibrate(patterns[type] ?? 30);
}
