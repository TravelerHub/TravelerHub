/**
 * Detect whether we're running inside a Capacitor native shell
 * or as a regular web app. Use this to switch between native
 * plugins and web fallbacks.
 */
export const isNative = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.isNativePlatform?.() === true;
};

export const isIOS = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.getPlatform?.() === 'ios';
};

export const isAndroid = () => {
  return typeof window !== 'undefined' &&
    window.Capacitor?.getPlatform?.() === 'android';
};
