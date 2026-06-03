import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { pickLatestIsoDate } from './lawnMaintenanceSync';

export const LAWN_STATE_ID = 'default';

/**
 * @typedef {Object} LawnScheduleSnapshot
 * @property {string | null} [lastMowedDate]
 * @property {string | null} [lastWateredDate]
 * @property {string | null} [mowingNextDueIso]
 * @property {string | null} [wateringNextDueIso]
 * @property {number} [forecastedRainSum]
 * @property {number | null} [currentSoilTemp]
 * @property {boolean} [isNatureProvidingFullSoak]
 * @property {Record<string, Record<string, string>>} [pendingDates]
 * @property {string} [savedAt]
 */

/**
 * @returns {Promise<{ userLogs: Record<string, string>, scheduleSnapshot: LawnScheduleSnapshot | null } | null>}
 */
export async function fetchLawnAppStateFromSupabase() {
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
    .select('user_logs, schedule_snapshot, weather_snapshot')
    .eq('id', LAWN_STATE_ID)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || /lawn_app_state|schema cache/i.test(error.message)) {
      return null;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  /** @type {Record<string, string>} */
  const userLogs = {};
  if (data?.user_logs && typeof data.user_logs === 'object') {
    for (const [key, value] of Object.entries(data.user_logs)) {
      if (typeof value === 'string') {
        userLogs[key] = value;
      }
    }
  }

  const scheduleSnapshot =
    data?.schedule_snapshot && typeof data.schedule_snapshot === 'object'
      ? /** @type {LawnScheduleSnapshot} */ (data.schedule_snapshot)
      : null;

  const weatherSnapshot =
    data?.weather_snapshot && typeof data.weather_snapshot === 'object'
      ? /** @type {import('./lawnWeather.js').LawnWeatherSnapshot} */ (data.weather_snapshot)
      : null;

  return { userLogs, scheduleSnapshot, weatherSnapshot };
}

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchLawnUserLogsFromSupabase() {
  const state = await fetchLawnAppStateFromSupabase();
  if (!state) return null;
  return state.userLogs;
}

/**
 * @param {Record<string, string>} userLogs
 * @param {LawnScheduleSnapshot | null} [scheduleSnapshot]
 * @returns {Promise<boolean>} false if table missing
 */
export async function saveLawnAppStateToSupabase(userLogs, scheduleSnapshot = null) {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    id: LAWN_STATE_ID,
    user_logs: userLogs,
    updated_at: new Date().toISOString(),
  };

  if (scheduleSnapshot) {
    payload.schedule_snapshot = {
      ...scheduleSnapshot,
      savedAt: new Date().toISOString(),
    };
  }

  const { error } = await supabase.from('lawn_app_state').upsert(payload, { onConflict: 'id' });

  if (error) {
    if (error.code === 'PGRST205' || /lawn_app_state|schema cache/i.test(error.message)) {
      return false;
    }
    if (/schedule_snapshot|42703|PGRST204/i.test(error.message)) {
      const { error: fallbackError } = await supabase.from('lawn_app_state').upsert(
        {
          id: LAWN_STATE_ID,
          user_logs: userLogs,
          updated_at: payload.updated_at,
        },
        { onConflict: 'id' }
      );
      if (fallbackError) {
        throw new Error(formatSupabaseSyncError(fallbackError));
      }
      return true;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  return true;
}

/**
 * @param {Record<string, string>} userLogs
 * @returns {Promise<boolean>}
 */
export async function saveLawnUserLogsToSupabase(userLogs) {
  return saveLawnAppStateToSupabase(userLogs, null);
}

/**
 * @param {LawnScheduleSnapshot} snapshot
 * @param {Record<string, string>} userLogs
 * @returns {Promise<boolean>}
 */
export async function saveLawnScheduleSnapshot(snapshot, userLogs) {
  return saveLawnAppStateToSupabase(userLogs, snapshot);
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
  return 'Run supabase/lawn_app_state.sql, lawn_schedule_snapshot.sql, and lawn_weather_snapshot.sql in the Supabase SQL Editor so lawn progress, weather, and schedules sync with the Tasks app.';
}
