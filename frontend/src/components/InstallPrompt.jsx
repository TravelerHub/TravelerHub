import { useEffect, useRef, useState } from 'react';

const DISMISSED_KEY = 'travelerhub_install_dismissed_until';
const DISMISS_DAYS = 7;

export default function InstallPrompt() {
  const deferredPromptRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    deferredPromptRef.current = null;
    setVisible(false);
  };

  const handleDismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9997] flex items-center justify-between gap-3 px-4 py-3 bg-[#183a37] text-white shadow-2xl"
      style={{ paddingBottom: 'calc(0.75rem + var(--sab, 0px))' }}
    >
      <p className="text-sm font-medium leading-snug flex-1">
        Add TravelerHub to your home screen for the full experience
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-white text-[#183a37] text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
