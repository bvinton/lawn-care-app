import {
  getSupabase,
  getSupabaseConfigError,
  formatSupabaseSyncError,
} from '../lib/supabase';
import { LAWN_APP_SOURCE } from './lawnTasks';

export const MOW_TASK_NAME = 'Mow lawn';
export const WATER_TASK_NAME = 'Water lawn';

/**
 * @param {string | null | undefined} isoDate
 * @returns {string | null}
 */
function isoDateFromTimestamp(isoDate) {
  if (!isoDate) return null;
  return isoDate.slice(0, 10);
}

/**
 * @param {...(string | null | undefined)} dates
 * @returns {string | null}
 */
export function pickLatestIsoDate(...dates) {
  const valid = dates.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (valid.length === 0) return null;
  return valid.sort().at(-1) ?? null;
}

/**
 * @typedef {Object} LawnMaintenanceRow
 * @property {string} task_name
 * @property {string} due_date
 * @property {boolean} is_completed
 * @property {string | null} [updated_at]
 */

/**
 * @returns {Promise<LawnMaintenanceRow[]>}
 */
export async function fetchLawnMaintenanceRows() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('task_name, due_date, is_completed, updated_at')
    .eq('app_source', LAWN_APP_SOURCE)
    .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME]);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }

  return data ?? [];
}

/**
 * Infer last mow/water dates from Tasks app completions in Supabase.
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr YYYY-MM-DD
 */
export function inferMaintenanceDatesFromRows(rows, todayStr) {
  let lastMowedDate = null;
  let lastWateredDate = null;
  let mowFromTasksApp = false;
  let waterFromTasksApp = false;

  for (const row of rows) {
    const dueDate = row.due_date;
    const updatedDate = isoDateFromTimestamp(row.updated_at);

    if (row.task_name === MOW_TASK_NAME) {
      if (row.is_completed) {
        const candidate = pickLatestIsoDate(
          dueDate <= todayStr ? dueDate : null,
          updatedDate
        );
        if (candidate) {
          lastMowedDate = pickLatestIsoDate(lastMowedDate, candidate);
          mowFromTasksApp = true;
        }
      } else if (dueDate < todayStr && updatedDate && updatedDate >= dueDate) {
        // Tasks app records completion by setting due_date to completion day; row may
        // already be marked incomplete again after lawn sync recalculated the schedule.
        const candidate = pickLatestIsoDate(dueDate, updatedDate);
        if (candidate) {
          lastMowedDate = pickLatestIsoDate(lastMowedDate, candidate);
          mowFromTasksApp = true;
        }
      }
    }

    if (row.task_name === WATER_TASK_NAME) {
      if (row.is_completed && dueDate < todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate);
        if (candidate) {
          lastWateredDate = pickLatestIsoDate(lastWateredDate, candidate);
          waterFromTasksApp = true;
        }
      } else if (
        !row.is_completed &&
        dueDate < todayStr &&
        updatedDate &&
        updatedDate >= dueDate
      ) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate);
        if (candidate) {
          lastWateredDate = pickLatestIsoDate(lastWateredDate, candidate);
          waterFromTasksApp = true;
        }
      }
    }
  }

  return {
    lastMowedDate,
    lastWateredDate,
    mowFromTasksApp,
    waterFromTasksApp,
  };
}

/**
 * Merge local storage dates with Supabase inference (latest wins).
 * @param {string | null} localDate
 * @param {string | null} remoteDate
 */
export function mergeMaintenanceDate(localDate, remoteDate) {
  return pickLatestIsoDate(localDate, remoteDate);
}
