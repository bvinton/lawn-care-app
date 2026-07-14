import { useEffect, useState } from 'react';
import { reloadForAppUpdate } from '../lib/appServiceWorker';

export default function AppUpdatePrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = () => setVisible(true);
    window.addEventListener('app-update-available', onUpdate);
    return () => window.removeEventListener('app-update-available', onUpdate);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-3 border-b border-green-800 bg-green-900 px-4 py-3 text-sm text-white shadow-lg"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <p className="font-medium">A new version of Lawn Pack is ready.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg px-2 py-1 text-green-200 active:bg-green-800"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => reloadForAppUpdate()}
          className="rounded-lg bg-white px-3 py-1.5 font-semibold text-green-900 active:bg-green-50"
        >
          Update
        </button>
      </div>
    </div>
  );
}
