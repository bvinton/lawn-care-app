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
 * @property {string | null} [created_at]
 */

/**
 * One row per maintenance task (handles duplicate Supabase rows).
 * @param {LawnMaintenanceRow[]} rows
 * @returns {LawnMaintenanceRow[]}
 */
export function dedupeMaintenanceRows(rows) {
  /** @type {Map<string, LawnMaintenanceRow>} */
  const best = new Map();

  for (const row of rows) {
    const existing = best.get(row.task_name);
    if (!existing) {
      best.set(row.task_name, row);
      continue;
    }

    const preferThis =
      (row.is_completed && !existing.is_completed) ||
      (row.is_completed === existing.is_completed &&
        row.due_date > existing.due_date);

    if (preferThis) {
      best.set(row.task_name, row);
    }
  }

  return Array.from(best.values());
}

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

  // updated_at may not exist on older Supabase projects — try without it first.
  let result = await supabase
    .from('tasks')
    .select('task_name, due_date, is_completed, created_at')
    .eq('app_source', LAWN_APP_SOURCE)
    .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME]);

  if (result.error?.code === '42703') {
    result = await supabase
      .from('tasks')
      .select('task_name, due_date, is_completed')
      .eq('app_source', LAWN_APP_SOURCE)
      .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME]);
  }

  if (result.error) {
    throw new Error(formatSupabaseSyncError(result.error));
  }

  return result.data ?? [];
}

/**
 * Infer last mow/water dates from Tasks app completions in Supabase.
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr YYYY-MM-DD
 */
export function inferMaintenanceDatesFromRows(rows, todayStr) {
  let lastMowedDate = null;
  let pastWateredDate = null;
  let todayWateredDate = null;
  let mowFromTasksApp = false;
  let waterFromTasksApp = false;

  for (const row of rows) {
    const dueDate = row.due_date;
    const updatedDate = isoDateFromTimestamp(row.updated_at);
    const createdDate = isoDateFromTimestamp(row.created_at);

    if (row.task_name === MOW_TASK_NAME) {
      if (row.is_completed && dueDate <= todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate, createdDate);
        if (candidate) {
          lastMowedDate = pickLatestIsoDate(lastMowedDate, candidate);
          mowFromTasksApp = true;
        }
      } else if (!row.is_completed && dueDate < todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate);
        if (candidate) {
          lastMowedDate = pickLatestIsoDate(lastMowedDate, candidate);
          mowFromTasksApp = true;
        }
      }
    }

    if (row.task_name === WATER_TASK_NAME) {
      if (row.is_completed && dueDate <= todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate, createdDate);
        if (!candidate) continue;
        if (dueDate < todayStr) {
          pastWateredDate = pickLatestIsoDate(pastWateredDate, candidate);
        } else {
          todayWateredDate = pickLatestIsoDate(todayWateredDate, candidate);
        }
        waterFromTasksApp = true;
      } else if (!row.is_completed && dueDate < todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate);
        if (candidate) {
          pastWateredDate = pickLatestIsoDate(pastWateredDate, candidate);
          waterFromTasksApp = true;
        }
      }
    }
  }

  const lastWateredDate = pastWateredDate ?? todayWateredDate;

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
