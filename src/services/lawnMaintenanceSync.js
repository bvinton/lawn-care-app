import {
  getSupabase,
  getSupabaseConfigError,
  formatSupabaseSyncError,
} from '../lib/supabase';
import { addDaysToDateString } from '../data/LawnPackData';
import { LAWN_APP_SOURCE } from './lawnTasks';

export const MOW_TASK_NAME = 'Mow lawn';
export const WATER_TASK_NAME = 'Water lawn';
export const VERTICUT_TASK_NAME = 'Verticutting';
export const WATERING_SESSION_NAMES = [
  'Water lawn (Morning)',
  'Water lawn (Midday)',
  'Water lawn (Evening)',
];

/** @type {boolean | null} */
let lastCompletedColumnAvailable = null;
/** @type {boolean | null} */
let skippedOnColumnAvailable = null;

export function resetLastCompletedColumnProbe() {
  lastCompletedColumnAvailable = null;
}

export function resetSkippedOnColumnProbe() {
  skippedOnColumnAvailable = null;
}

/** @param {unknown} error */
export function isMissingSkippedOnColumnError(error) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(/** @type {{ message: unknown }} */ (error).message)
        : String(error);
  return /skipped_on|42703|PGRST204|schema cache/i.test(message);
}

/** @param {Record<string, unknown>} payload */
export function withoutSkippedOn(payload) {
  const next = { ...payload };
  delete next.skipped_on;
  return next;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<boolean>}
 */
export async function probeSkippedOnColumn(supabase) {
  if (skippedOnColumnAvailable !== null) {
    return skippedOnColumnAvailable;
  }

  const { error } = await supabase
    .from('tasks')
    .select('skipped_on')
    .eq('app_source', LAWN_APP_SOURCE)
    .limit(1);

  skippedOnColumnAvailable = !error;
  return skippedOnColumnAvailable;
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
 * @property {string | null} [skipped_on]
 * @property {string | null} [updated_at]
 * @property {string | null} [created_at]
 */

const MAINTENANCE_SELECT_FULL =
  'task_name, due_date, is_completed, last_completed_date, skipped_on, created_at';
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
    .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME, 'Water lawn (Morning)', 'Water lawn (Midday)', 'Water lawn (Evening)', VERTICUT_TASK_NAME]);

  if (result.error && (result.error.code === '42703' || isMissingLastCompletedColumnError(result.error))) {
    result = await supabase
      .from('tasks')
      .select(MAINTENANCE_SELECT_FALLBACK)
      .eq('app_source', LAWN_APP_SOURCE)
      .in('task_name', [MOW_TASK_NAME, WATER_TASK_NAME, 'Water lawn (Morning)', 'Water lawn (Midday)', 'Water lawn (Evening)', VERTICUT_TASK_NAME]);
  }

  if (result.error) {
    throw new Error(formatSupabaseSyncError(result.error));
  }

  return result.data ?? [];
}

/**
 * Best-effort last-done date from one Supabase row (Tasks app or Lawn app).
 * @param {LawnMaintenanceRow} row
 * @param {string} todayStr YYYY-MM-DD
 * @returns {string | null}
 */
export function inferLastDoneFromMaintenanceRow(row, todayStr) {
  if (row.last_completed_date) {
    return row.last_completed_date;
  }

  const dueDate = row.due_date;
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return null;
  }

  // due_date on mow/water rows is the *next* due date — never treat it as last done when open.
  if (row.is_completed && dueDate <= todayStr) {
    return pickLatestIsoDate(dueDate, isoDateFromTimestamp(row.updated_at), isoDateFromTimestamp(row.created_at));
  }

  return null;
}

/**
 * Read shared last-done dates from Supabase (set by Tasks app or Lawn app).
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr YYYY-MM-DD
 */
export function inferMaintenanceDatesFromRows(rows, todayStr) {
  let lastMowedDate = null;
  let lastWateredDate = null;
  let lastVerticutDate = null;

  // When running 3-session watering (seed establishment), completing one session must
  // not advance the shared lastWateredDate — that would push all sessions to tomorrow.
  // Only treat a day as fully watered once all 3 sessions report the same completion date.
  const sessionRows = rows.filter(r => WATERING_SESSION_NAMES.includes(r.task_name));
  if (sessionRows.length > 0) {
    /** @type {Map<string, Set<string>>} */
    const completionsByDate = new Map();
    for (const row of sessionRows) {
      const inferred = inferLastDoneFromMaintenanceRow(row, todayStr);
      if (!inferred) continue;
      if (!completionsByDate.has(inferred)) completionsByDate.set(inferred, new Set());
      completionsByDate.get(inferred)?.add(row.task_name);
    }
    for (const [date, names] of completionsByDate) {
      if (WATERING_SESSION_NAMES.every(n => names.has(n))) {
        lastWateredDate = pickLatestIsoDate(lastWateredDate, date);
      }
    }
  }

  for (const row of rows) {
    const inferred = inferLastDoneFromMaintenanceRow(row, todayStr);
    if (!inferred) continue;

    if (row.task_name === MOW_TASK_NAME) {
      lastMowedDate = pickLatestIsoDate(lastMowedDate, inferred);
    } else if (row.task_name === WATER_TASK_NAME) {
      // Legacy single-session row — count it directly.
      lastWateredDate = pickLatestIsoDate(lastWateredDate, inferred);
    } else if (row.task_name === VERTICUT_TASK_NAME) {
      lastVerticutDate = pickLatestIsoDate(lastVerticutDate, inferred);
    }
    // Water lawn (Morning/Midday/Evening) are handled via the session block above.
  }

  return { lastMowedDate, lastWateredDate, lastVerticutDate };
}

/**
 * Whether a session row is resolved for its current due cycle (done or skipped).
 * @param {LawnMaintenanceRow} row
 * @param {string} todayStr
 */
function isWateringSessionResolved(row, todayStr) {
  const dueDate = row.due_date;
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;

  if (row.skipped_on && row.skipped_on >= dueDate) {
    return true;
  }

  const inferred = inferLastDoneFromMaintenanceRow(row, todayStr);
  return Boolean(inferred && inferred >= dueDate);
}

/**
 * Progress for seed watering sessions sharing the oldest unresolved due date.
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr
 * @returns {{ dueDate: string, done: number, skipped: number, pending: number } | null}
 */
export function inferWateringDayProgress(rows, todayStr) {
  const sessionRows = rows.filter((r) => WATERING_SESSION_NAMES.includes(r.task_name));
  if (sessionRows.length === 0) return null;

  const dueDates = [...new Set(sessionRows.map((r) => r.due_date).filter(Boolean))].sort();
  for (const dueDate of dueDates) {
    const forDay = sessionRows.filter((r) => r.due_date === dueDate);
    if (forDay.length === 0) continue;

    let done = 0;
    let skipped = 0;
    let pending = 0;

    for (const row of forDay) {
      if (row.skipped_on && row.skipped_on >= dueDate) {
        skipped += 1;
      } else if (isWateringSessionResolved(row, todayStr) && !row.skipped_on) {
        done += 1;
      } else {
        const inferred = inferLastDoneFromMaintenanceRow(row, todayStr);
        if (inferred && inferred >= dueDate) {
          done += 1;
        } else {
          pending += 1;
        }
      }
    }

    if (pending > 0) {
      return { dueDate, done, skipped, pending };
    }
  }

  return null;
}

/**
 * Advance seed watering due date past fully resolved overdue days.
 * @param {string | null} wateringNextDueIso
 * @param {LawnMaintenanceRow[]} rows
 * @param {string} todayStr
 * @returns {string | null}
 */
export function resolveSeedWateringNextDueIso(wateringNextDueIso, rows, todayStr) {
  const sessionRows = rows.filter((r) => WATERING_SESSION_NAMES.includes(r.task_name));
  if (sessionRows.length === 0) {
    return wateringNextDueIso;
  }

  let nextDue = wateringNextDueIso ?? todayStr;
  const dueDates = [...new Set(sessionRows.map((r) => r.due_date).filter(Boolean))].sort();

  for (const dueDate of dueDates) {
    if (dueDate > todayStr) continue;

    const forDay = sessionRows.filter((r) => r.due_date === dueDate);
    if (forDay.length === 0) continue;

    const allResolved = forDay.every((row) => isWateringSessionResolved(row, todayStr));
    if (!allResolved) {
      return pickLatestIsoDate(nextDue, dueDate) ?? dueDate;
    }

    const dayAfter = addDaysToDateString(dueDate, 1);
    nextDue = pickLatestIsoDate(nextDue, dayAfter) ?? dayAfter;
  }

  return nextDue;
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
