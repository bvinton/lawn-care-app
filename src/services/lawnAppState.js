import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { pickLatestIsoDate } from './lawnMaintenanceSync';

export const LAWN_STATE_ID = 'default';

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchLawnUserLogsFromSupabase() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  const { data, error } = await supabase
    .from('lawn_app_state')
    .select('user_logs')
    .eq('id', LAWN_STATE_ID)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || /lawn_app_state|schema cache/i.test(error.message)) {
      return null;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  if (!data?.user_logs || typeof data.user_logs !== 'object') {
    return {};
  }

  /** @type {Record<string, unknown>} */
  const raw = data.user_logs;
  /** @type {Record<string, string>} */
  const logs = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      logs[key] = value;
    }
  }
  return logs;
}

/**
 * @param {Record<string, string>} userLogs
 * @returns {Promise<boolean>} false if table missing
 */
export async function saveLawnUserLogsToSupabase(userLogs) {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  const payload = {
    id: LAWN_STATE_ID,
    user_logs: userLogs,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('lawn_app_state').upsert(payload, { onConflict: 'id' });

  if (error) {
    if (error.code === 'PGRST205' || /lawn_app_state|schema cache/i.test(error.message)) {
      return false;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  return true;
}

/**
 * Merge remote Supabase logs with this device's localStorage copy (latest dates win).
 * @param {Record<string, string>} remote
 * @param {Record<string, string>} local
 */
export function mergeLawnUserLogs(remote, local) {
  /** @type {Record<string, string>} */
  const merged = { ...remote };

  for (const [key, localValue] of Object.entries(local)) {
    const remoteValue = merged[key];
    if (!remoteValue) {
      merged[key] = localValue;
      continue;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(localValue) && /^\d{4}-\d{2}-\d{2}$/.test(remoteValue)) {
      merged[key] = pickLatestIsoDate(remoteValue, localValue) ?? localValue;
      continue;
    }

    if (key === 'petLockoutUntil') {
      const localMs = new Date(localValue).getTime();
      const remoteMs = new Date(remoteValue).getTime();
      merged[key] =
        !Number.isNaN(localMs) && !Number.isNaN(remoteMs)
          ? localMs > remoteMs
            ? localValue
            : remoteValue
          : localValue;
      continue;
    }

    merged[key] = localValue;
  }

  return merged;
}

export function getLawnAppStateSetupHint() {
  return 'Run supabase/lawn_app_state.sql in the Supabase SQL Editor so lawn pack progress (Weedol, steps, etc.) is saved to the cloud.';
}
