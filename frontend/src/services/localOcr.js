/**
 * Local OCR — runs entirely on the user's device. No images leave the
 * browser. Used by the Booking "Import" flow and (eventually) the
 * Expenses receipt scanner to replace the cloud-AI Vision endpoint.
 *
 * Implementation:
 *   - Lazy-load tesseract.js. The English language pack is ~3 MB so we
 *     only download it on first use, after the user explicitly chooses
 *     to import an image.
 *
 * Future hook: Capacitor `@capacitor-mlkit/text-recognition` would be
 * faster and more accurate on iOS / Android. The plugin isn't installed
 * yet (it'd add native build dependencies), so we keep a single path
 * that works the same on web and inside the Capacitor WebView. When the
 * plugin lands, add an MLKit branch in `recognizeText()` guarded by
 * `Capacitor.isNativePlatform()`.
 *
 * `recognizeText(file, { onProgress })` returns the recognized text as a
 * single string with line breaks. Any failure returns the empty string;
 * the caller can fall back to a paste-text input.
 */

let _tesseractWorker = null;

async function _getTesseractWorker(onProgress) {
  if (_tesseractWorker) return _tesseractWorker;
  // Dynamic import — ~3 MB, only fetched when the user actually scans.
  const Tesseract = await import("tesseract.js");
  _tesseractWorker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (typeof onProgress === "function" && m.status === "recognizing text") {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
  return _tesseractWorker;
}

async function _recognizeWeb(file, onProgress) {
  const worker = await _getTesseractWorker(onProgress);
  const result = await worker.recognize(file);
  return (result?.data?.text || "").trim();
}

/**
 * Run OCR on an image file (File / Blob).
 *
 * @param {File | Blob} file
 * @param {{ onProgress?: (pct: number) => void }} [options]
 * @returns {Promise<{ text: string, source: "tesseract" | "none" }>}
 */
export async function recognizeText(file, options = {}) {
  if (!file) return { text: "", source: "none" };
  const { onProgress } = options;
  try {
    const text = await _recognizeWeb(file, onProgress);
    return { text, source: "tesseract" };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[localOcr] Tesseract failed:", err);
    return { text: "", source: "none" };
  }
}

/**
 * Free the lazy-loaded Tesseract worker. Call from a route's
 * cleanup effect when the user is unlikely to scan again on this page.
 */
export async function terminateOcr() {
  if (_tesseractWorker) {
    try {
      await _tesseractWorker.terminate();
    } catch {
      // best-effort
    }
    _tesseractWorker = null;
  }
}
