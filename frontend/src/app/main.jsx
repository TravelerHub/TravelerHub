import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"

import { RouterProvider } from "react-router-dom"
import router from "../router.jsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Capacitor } from "@capacitor/core"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// Global session-expiry handler. Authenticated requests dispatch
// `auth:expired` from the API wrappers when the server returns 401, so we
// clear credentials and route to /login instead of rendering broken pages.
// Debounced via a flag so a burst of parallel 401s only triggers one redirect.
if (typeof window !== "undefined") {
  let redirecting = false
  window.addEventListener("auth:expired", () => {
    if (redirecting) return
    redirecting = true
    try {
      localStorage.removeItem("token")
      sessionStorage.removeItem("token")
      localStorage.removeItem("user")
    } catch { /* storage unavailable */ }
    queryClient.clear()
    if (window.location.pathname !== "/login") {
      window.location.assign("/login")
    } else {
      redirecting = false
    }
  })
}

// Register service worker for offline support + PWA install
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // When a new SW is waiting, activate it immediately
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Global live region for screen reader announcements */}
      <div
        id="live-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <RouterProvider router={router}/>
    </QueryClientProvider>
  </StrictMode>,
)

// On native (iOS/Android via Capacitor), dismiss the splash screen now that
// React has rendered. Guarded so the dynamic import is never evaluated on
// the web build, where @capacitor/splash-screen isn't a hard dependency.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
    .catch(() => {})
}
