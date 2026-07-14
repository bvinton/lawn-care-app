import { registerSW } from 'virtual:pwa-register';

/** @type {((reloadPage?: boolean) => Promise<void>) | undefined} */
let applyUpdate;

export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new Event('app-update-available'));
    },
  });
}

export function reloadForAppUpdate() {
  void applyUpdate?.(true);
}
