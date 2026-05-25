import { createClient } from '@supabase/supabase-js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

export function getSupabaseConfigError() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.';
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
    return `VITE_SUPABASE_URL looks invalid: "${supabaseUrl}". Use https://<project-ref>.supabase.co from Supabase Dashboard → Project Settings → API.`;
  }

  return null;
}

/** @param {unknown} error */
export function formatSupabaseSyncError(error) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(/** @type {{ message: unknown }} */ (error).message)
        : String(error);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '(not set)';

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return [
      'Cannot reach Supabase (network error).',
      `Configured URL: ${supabaseUrl}`,
      'Confirm the project ref in Supabase Dashboard → Project Settings → API, update .env.local, then restart npm run dev.',
      'Also check the project is not paused and your network allows supabase.co.',
    ].join(' ');
  }

  return message;
}
