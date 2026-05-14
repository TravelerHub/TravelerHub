import LoadingSpinner from './LoadingSpinner.jsx';

/**
 * Shared Suspense fallback used while lazy route chunks load.
 * Renders the existing LoadingSpinner centered fullscreen.
 */
export default function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <LoadingSpinner size="lg" />
    </div>
  );
}
