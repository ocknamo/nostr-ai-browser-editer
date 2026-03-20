/**
 * Service Worker lifecycle management and VFS synchronization.
 * Registers the preview Service Worker and communicates VFS state via BroadcastChannel.
 */

const SW_SCRIPT = '/preview-sw.js';
const CHANNEL_NAME = 'preview-vfs';

let channel: BroadcastChannel | null = null;

/**
 * Register the preview Service Worker and open the BroadcastChannel.
 * Safe to call multiple times - re-uses an existing registration when available.
 * Throws if the browser does not support Service Workers.
 */
export async function registerPreviewSW(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.');
  }

  console.log('[sw-manager] registering SW:', SW_SCRIPT);
  channel = new BroadcastChannel(CHANNEL_NAME);

  const registration = await navigator.serviceWorker.register(SW_SCRIPT, {
    // Scope / means the SW can intercept /preview/* requests
    scope: '/',
  });

  console.log('[sw-manager] SW registration state - installing:', !!registration.installing, 'waiting:', !!registration.waiting, 'active:', !!registration.active);

  // Wait for the SW to become active before returning so callers can immediately
  // send VFS data without messages being dropped.
  if (registration.installing) {
    console.log('[sw-manager] waiting for SW to activate (installing)');
    await waitForState(registration.installing, 'activated');
  } else if (registration.waiting) {
    console.log('[sw-manager] waiting for SW to activate (waiting)');
    await waitForState(registration.waiting, 'activated');
  } else {
    console.log('[sw-manager] SW already active');
  }

  console.log('[sw-manager] SW active, scope:', registration.scope);
  return registration;
}

/**
 * Send the full VFS snapshot to the Service Worker.
 * Call this after the initial repository load to populate the SW's file store.
 */
export function syncVFSToSW(snapshot: Record<string, string>): void {
  if (!channel) {
    console.warn('[sw-manager] BroadcastChannel not open. Call registerPreviewSW() first.');
    return;
  }
  console.log('[sw-manager] posting vfs-init with', Object.keys(snapshot).length, 'files');
  channel.postMessage({ type: 'vfs-init', files: snapshot });
}

/**
 * Send an incremental VFS update to the Service Worker.
 * Used during polling-based updates to apply only the changed files.
 */
export function updateSWFiles(
  updated: Record<string, string>,
  deleted: string[],
): void {
  if (!channel) {
    console.warn('[sw-manager] BroadcastChannel not open. Call registerPreviewSW() first.');
    return;
  }
  channel.postMessage({ type: 'vfs-update', updated, deleted });
}

/** Promise that resolves when a ServiceWorker reaches the target state. */
function waitForState(worker: ServiceWorker, targetState: ServiceWorkerState): Promise<void> {
  return new Promise((resolve) => {
    if (worker.state === targetState) {
      resolve();
      return;
    }
    const onStateChange = () => {
      if (worker.state === targetState) {
        worker.removeEventListener('statechange', onStateChange);
        resolve();
      }
    };
    worker.addEventListener('statechange', onStateChange);
  });
}
