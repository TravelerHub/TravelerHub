import { isNative } from './platform';

/**
 * Subscribe to push notifications.
 * On native: uses Capacitor PushNotifications plugin (FCM/APNs)
 * On web: uses Web Push API with VAPID
 */
export async function subscribeToPush() {
  if (isNative()) {
    return subscribeNative();
  }
  return subscribeWeb();
}

async function subscribeNative() {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') return null;

  await PushNotifications.register();

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Native token:', token.value);
      resolve({ type: 'native', token: token.value });
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
      resolve(null);
    });
  });
}

async function subscribeWeb() {
  if (!('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
  if (!VAPID_PUBLIC_KEY) return null;
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return { type: 'web', subscription: sub };
  } catch { return null; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
