import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"

import { RouterProvider } from "react-router-dom"
import router from "../router.jsx"

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
    <RouterProvider router={router}/>
  </StrictMode>,
)
