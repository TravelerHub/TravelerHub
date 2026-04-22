import { isNative } from './platform';

/**
 * Open camera to capture a photo.
 * Native: Capacitor Camera plugin (instant, no file picker)
 * Web: falls back to <input capture="environment">
 */
export async function capturePhoto() {
  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });
    // Convert dataUrl to a File object for the existing upload flow
    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    return new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
  }
  // Web: trigger file input programmatically
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => resolve(e.target.files[0]);
    input.onerror = reject;
    input.click();
  });
}
