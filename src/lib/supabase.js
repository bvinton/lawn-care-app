import { createClient } from '@supabase/supabase-js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let browserClient = null;

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let serverClient = null;

function isServerRuntime() {
  return typeof window === 'undefined';
}

/**
 * Initialise Supabase for Vercel /api routes (service role when set).
 */
export function initServerSupabase() {
  if (serverClient) {
    return serverClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_* fallbacks) on the server.',
    );
  }

  serverClient = createClient(supabaseUrl, supabaseKey);
  return serverClient;
}

export function getSupabase() {
  if (isServerRuntime()) {
    try {
      return initServerSupabase();
    } catch {
      return null;
    }
  }

  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

/**
 * @param {{ server?: boolean }} [options]
 */
export function getSupabaseConfigError(options = {}) {
  const supabaseUrl = isServerRuntime() || options.server
    ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    : import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = isServerRuntime() || options.server
    ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (options.server || isServerRuntime()) {
      return 'Missing server Supabase env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_* fallbacks).';
    }
    if (import.meta.env.PROD) {
      return 'Missing Supabase credentials on this deployment. In Vercel → Project → Settings → Environment Variables, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Production, then redeploy.';
    }
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

/** UUID for server-side task writes when using the service role (no auth session). */
export function getTasksOwnerUserId() {
  return process.env.TASKS_OWNER_USER_ID || null;
}

/**
 * Resolve user_id for task rows — authenticated browser session or server env fallback.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function resolveTaskUserId(supabase) {
  if (isServerRuntime()) {
    return getTasksOwnerUserId();
  }

  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Attach user_id to a task payload when available.
 * @param {Record<string, unknown>} row
 * @param {string | null | undefined} userId
 */
export function withTaskUserId(row, userId) {
  if (!userId) {
    return row;
  }
  return { ...row, user_id: userId };
}
