import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * A new deploy installs in the background; the app only switches to it when you tap Reload
 * (or next time it is opened), so it never reloads in the middle of a match.
 */
export function UpdateBanner({ visible }: { visible: boolean }) {
  // Always mounted so the service worker registers (and the app works offline) whatever screen opens first.
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!visible) return null;
  if (needRefresh) {
    return (
      <div className="banner" role="status">
        A new version is ready.
        <button type="button" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="banner" role="status">
        Ready to work offline.
        <button type="button" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    );
  }
  return null;
}
