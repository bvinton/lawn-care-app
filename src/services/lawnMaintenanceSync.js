import {
  getSupabase,
  getSupabaseConfigError,
  formatSupabaseSyncError,
} from '../lib/supabase';
import { LAWN_APP_SOURCE } from './lawnTasks';

export const MOW_TASK_NAME = 'Mow lawn';
export const WATER_TASK_NAME = 'Water lawn';

/** @type {boolean | null} */
let lastCompletedColumnAvailable = null;

export function resetLastCompletedColumnProbe() {
  lastCompletedColumnAvailable = null;
}

/** @param {unknown} error */
export function isMissingLastCompletedColumnError(error) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(/** @type {{ message: unknown }} */ (error).message)
        : String(error);
  return /last_completed_date|42703|PGRST204|schema cache/i.test(message);
}

/** @param {Record<string, unknown>} payload */
export function withoutLastCompletedDate(payload) {
  const next = { ...payload };
  delete next.last_completed_date;
  return next;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<boolean>}
 */
export async function probeLastCompletedColumn(supabase) {
  if (lastCompletedColumnAvailable !== null) {
    return lastCompletedColumnAvailable;
  }

  const { error } = await supabase
    .from('tasks')
    .select('last_completed_date')
    .eq('app_source', LAWN_APP_SOURCE)
    .limit(1);

  lastCompletedColumnAvailable = !error;
  return lastCompletedColumnAvailable;
}

export function getLastCompletedColumnHint() {
  return 'Run supabase/maintenance_link.sql in the Supabase SQL Editor to link Tasks app completions with this app.';
}

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
 * @property {string | null} [last_completed_date]
 * @property {string | null} [updated_at]
 * @property {string | null} [created_at]
 */

const MAINTENANCE_SELECT_FULL =
  'task_name, due_date, is_completed, last_completed_date, created_at';
const MAINTENANCE_SELECT_FALLBACK = 'task_name, due_date, is_completed, created_at';

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

  let result = await supabase
    .from('tasks')
    .select(MAINTENANCE_SELECT_FULL)
    .eq('app_source', LAWN_APP_SOURCE)
    .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME]);

  if (result.error?.code === '42703') {
    result = await supabase
      .from('tasks')
      .select(MAINTENANCE_SELECT_FALLBACK)
      .eq('app_source', LAWN_APP_SOURCE)
      .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME]);
  }

  if (result.error) {
    throw new Error(formatSupabaseSyncError(result.error));
  }

  return result.data ?? [];
}

/**
 * Read shared last-done dates from Supabase (set by Tasks app or Lawn app).
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr YYYY-MM-DD
 */
export function inferMaintenanceDatesFromRows(rows, todayStr) {
  let lastMowedDate = null;
  let lastWateredDate = null;
  let mowFromTasksApp = false;
  let waterFromTasksApp = false;

  for (const row of rows) {
    if (row.last_completed_date) {
      if (row.task_name === MOW_TASK_NAME) {
        lastMowedDate = pickLatestIsoDate(lastMowedDate, row.last_completed_date);
        mowFromTasksApp = true;
        continue;
      }
      if (row.task_name === WATER_TASK_NAME) {
        lastWateredDate = pickLatestIsoDate(lastWateredDate, row.last_completed_date);
        waterFromTasksApp = true;
        continue;
      }
    }

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
      if (row.is_completed && dueDate < todayStr) {
        const candidate = pickLatestIsoDate(dueDate, updatedDate, createdDate);
        if (candidate) {
          lastWateredDate = pickLatestIsoDate(lastWateredDate, candidate);
          waterFromTasksApp = true;
        }
      } else if (!row.is_completed && dueDate < todayStr) {
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
 * @param {string | null} localDate
 * @param {string | null} remoteDate
 */
export function mergeMaintenanceDate(localDate, remoteDate) {
  return pickLatestIsoDate(localDate, remoteDate);
}

/**
 * Pull last mow/water from shared Supabase (e.g. after completing in Tasks app).
 * @param {string} todayStr
 */
export async function pullMaintenanceDatesFromSupabase(todayStr) {
  const rows = await fetchLawnMaintenanceRows();
  return inferMaintenanceDatesFromRows(rows, todayStr);
}
