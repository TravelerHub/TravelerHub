import { isNative } from './platform';

export async function getNetworkStatus() {
  if (isNative()) {
    const { Network } = await import('@capacitor/network');
    return Network.getStatus();
  }
  return { connected: navigator.onLine, connectionType: 'unknown' };
}

export async function addNetworkListener(callback) {
  if (isNative()) {
    const { Network } = await import('@capacitor/network');
    const handle = await Network.addListener('networkStatusChange', callback);
    return () => handle.remove();
  }
  const onOnline = () => callback({ connected: true });
  const onOffline = () => callback({ connected: false });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
