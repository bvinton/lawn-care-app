import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import {
  MOW_TASK_NAME,
  WATER_TASK_NAME,
  VERTICUT_TASK_NAME,
  isMissingLastCompletedColumnError,
  withoutLastCompletedDate,
  probeLastCompletedColumn,
  resetLastCompletedColumnProbe,
  pickLatestIsoDate,
  inferLastDoneFromMaintenanceRow,
} from './lawnMaintenanceSync';
import { GYPSUM_TASK_NAME } from './lawnTaskInboundSync';

const MAINTENANCE_TASK_NAMES = new Set([MOW_TASK_NAME, WATER_TASK_NAME, VERTICUT_TASK_NAME]);

export const LAWN_APP_SOURCE = 'lawn';

/**
 * @typedef {'pending' | 'urgent' | 'completed'} LawnTaskStatus
 */

/**
 * @typedef {Object} CompiledLawnTask
 * @property {string} id
 * @property {string} title
 * @property {string} dueDate
 * @property {LawnTaskStatus} status
 * @property {'lawn'} module
 * @property {string | null} [reason]
 * @property {string | null} [completedDate]
 */

/**
 * @typedef {Object} LawnTaskRow
 * @property {string} id
 * @property {string} app_source
 * @property {string} task_name
 * @property {string} due_date
 * @property {boolean} is_completed
 */

function requireSupabase() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  return supabase;
}

/**
 * @param {CompiledLawnTask} task
 * @returns {boolean}
 */
function isSyntheticMaintenanceComplete(task) {
  return (
    task.status === 'completed' &&
    typeof task.reason === 'string' &&
    /dormancy|winter|rain|not actively growing|nature providing|outside active season|drought|heat stress|paused to protect/i.test(
      task.reason
    )
  );
}

/**
 * @param {CompiledLawnTask} task
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null, lastVerticutDate?: string | null }} maintenance
 * @param {Array<{ due_date: string, is_completed: boolean, last_completed_date?: string | null }>} [existingRows]
 * @param {string} todayStr
 */
function buildMaintenanceSyncRow(task, maintenance, existingRows, todayStr) {
  const localLast =
    task.title === MOW_TASK_NAME
      ? maintenance.lastMowedDate
      : task.title === WATER_TASK_NAME
        ? maintenance.lastWateredDate
        : task.title === VERTICUT_TASK_NAME
          ? maintenance.lastVerticutDate
          : null;

  let lastCompleted = localLast ?? null;
  for (const existing of existingRows ?? []) {
    lastCompleted = pickLatestIsoDate(
      lastCompleted,
      existing.last_completed_date ?? null,
      inferLastDoneFromMaintenanceRow(
        {
          task_name: task.title,
          due_date: existing.due_date,
          is_completed: existing.is_completed,
          last_completed_date: existing.last_completed_date ?? null,
        },
        todayStr
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const row = {
    app_source: LAWN_APP_SOURCE,
    task_name: task.title,
    due_date: task.dueDate,
  };

  if (lastCompleted) {
    row.last_completed_date = lastCompleted;
  }

  row.is_completed = isSyntheticMaintenanceComplete(task);

  return row;
}

/**
 * @param {CompiledLawnTask} task
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null, lastVerticutDate?: string | null }} maintenance
 */
/**
 * @param {CompiledLawnTask} task
 * @param {Array<{ is_completed?: boolean, last_completed_date?: string | null }>} [existingRows]
 * @param {boolean} canUseLastCompleted
 */
function buildPackSyncRow(task, existingRows, canUseLastCompleted) {
  const existing = existingRows?.[0];
  /** @type {Record<string, unknown>} */
  const row = {
    app_source: LAWN_APP_SOURCE,
    task_name: task.title,
    due_date: task.dueDate,
  };

  if (task.status === 'completed') {
    row.is_completed = true;
    if (canUseLastCompleted) {
      row.last_completed_date =
        task.completedDate ?? existing?.last_completed_date ?? task.dueDate;
    }
    return row;
  }

  if (existing?.is_completed) {
    row.is_completed = true;
    if (canUseLastCompleted && existing.last_completed_date) {
      row.last_completed_date = existing.last_completed_date;
    }
    return row;
  }

  row.is_completed = false;
  return row;
}

function compiledTaskToRow(task, maintenance = {}) {
  /** @type {Record<string, unknown>} */
  const row = {
    app_source: LAWN_APP_SOURCE,
    task_name: task.title,
    due_date: task.dueDate,
    is_completed: task.status === 'completed',
  };

  if (task.status === 'completed' && task.completedDate) {
    row.last_completed_date = task.completedDate;
  }

  if (task.title === MOW_TASK_NAME && maintenance.lastMowedDate) {
    row.last_completed_date = maintenance.lastMowedDate;
  }
  if (task.title === WATER_TASK_NAME && maintenance.lastWateredDate) {
    row.last_completed_date = maintenance.lastWateredDate;
  }
  if (task.title === VERTICUT_TASK_NAME && maintenance.lastVerticutDate) {
    row.last_completed_date = maintenance.lastVerticutDate;
  }
  if (task.title === GYPSUM_TASK_NAME && task.completedDate) {
    row.last_completed_date = task.completedDate;
  }

  return row;
}

/**
 * Create or update every compiled lawn task in Supabase.
 * @param {CompiledLawnTask[]} compiledTasks
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null }} [maintenance]
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} body
 * @param {string} taskTitle
 * @param {Record<string, unknown>} fullPayload
 */
async function applyTaskWrite(supabase, body, taskTitle, fullPayload) {
  let { error } = await supabase.from('tasks').insert(body);

  if (error && isMissingLastCompletedColumnError(error)) {
    resetLastCompletedColumnProbe();
    body = withoutLastCompletedDate(fullPayload);
    ({ error } = await supabase.from('tasks').insert(body));
  }

  if (error) {
    throw new Error(`Insert failed for "${taskTitle}": ${formatSupabaseSyncError(error)}`);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {CompiledLawnTask} task
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null, lastVerticutDate?: string | null }} maintenance
 * @param {string} todayStr
 */
async function writeTaskPayload(supabase, task, maintenance, todayStr) {
  const taskTitle = task.title;
  const isMaintenance = MAINTENANCE_TASK_NAMES.has(taskTitle);
  let existingResult = await supabase
    .from('tasks')
    .select('id, due_date, is_completed, last_completed_date')
    .eq('app_source', LAWN_APP_SOURCE)
    .eq('task_name', taskTitle)
    .order('id', { ascending: true });

  if (existingResult.error && isMissingLastCompletedColumnError(existingResult.error)) {
    existingResult = await supabase
      .from('tasks')
      .select('id, due_date, is_completed')
      .eq('app_source', LAWN_APP_SOURCE)
      .eq('task_name', taskTitle)
      .order('id', { ascending: true });
  }

  if (existingResult.error) {
    throw new Error(
      `Lookup failed for "${taskTitle}": ${formatSupabaseSyncError(existingResult.error)}`
    );
  }

  const existing = existingResult.data;
  const canUseLastCompleted = await probeLastCompletedColumn(supabase);

  let payload = isMaintenance
    ? buildMaintenanceSyncRow(task, maintenance, existing ?? [], todayStr)
    : buildPackSyncRow(task, existing ?? [], canUseLastCompleted);

  let body = canUseLastCompleted ? payload : withoutLastCompletedDate(payload);

  if (existing && existing.length > 0) {
    const [primary, ...duplicates] = existing;

    let { error } = await supabase.from('tasks').update(body).eq('id', primary.id);

    if (error && isMissingLastCompletedColumnError(error)) {
      resetLastCompletedColumnProbe();
      body = withoutLastCompletedDate(payload);
      ({ error } = await supabase.from('tasks').update(body).eq('id', primary.id));
    }

    if (error) {
      throw new Error(`Update failed for "${taskTitle}": ${formatSupabaseSyncError(error)}`);
    }

    for (const duplicate of duplicates) {
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', duplicate.id);
      if (deleteError) {
        console.warn(`[Lawn Care] Could not remove duplicate "${taskTitle}" row:`, deleteError);
      }
    }
    return;
  }

  await applyTaskWrite(supabase, body, taskTitle, payload);
}

/** @returns {Promise<boolean>} */
export async function isLastCompletedColumnAvailable() {
  return probeLastCompletedColumn(requireSupabase());
}

export async function syncLawnTasksToSupabase(compiledTasks, maintenance = {}, todayStr) {
  const supabase = requireSupabase();
  const today =
    todayStr ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

  for (const task of compiledTasks) {
    await writeTaskPayload(supabase, task, maintenance, today);
  }

  try {
    await deleteStaleLawnTasks(compiledTasks);
  } catch (error) {
    console.warn('[Lawn Care] Stale task cleanup skipped:', error);
  }
}

/** @returns {Promise<Map<string, string>>} */
async function fetchLawnTaskIdsByName() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, task_name')
    .eq('app_source', LAWN_APP_SOURCE);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }

  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const row of data ?? []) {
    if (!byName.has(row.task_name)) {
      byName.set(row.task_name, row.id);
    }
  }
  return byName;
}

/** @returns {Promise<LawnTaskRow[]>} */
export async function fetchLawnTasksFromSupabase() {
  return fetchLawnTasksForInboundSync();
}

/** @returns {Promise<LawnTaskRow[]>} */
export async function fetchLawnTasksForInboundSync() {
  const supabase = requireSupabase();

  let result = await supabase
    .from('tasks')
    .select('id, app_source, task_name, due_date, is_completed, last_completed_date')
    .eq('app_source', LAWN_APP_SOURCE)
    .order('due_date', { ascending: true });

  if (result.error && isMissingLastCompletedColumnError(result.error)) {
    result = await supabase
      .from('tasks')
      .select('id, app_source, task_name, due_date, is_completed')
      .eq('app_source', LAWN_APP_SOURCE)
      .order('due_date', { ascending: true });
  }

  if (result.error) {
    throw new Error(formatSupabaseSyncError(result.error));
  }

  return result.data ?? [];
}

/**
 * Clear completion in Supabase when a step is cleared in the Lawn app.
 * @param {string} taskName
 */
export async function clearLawnTaskCompletion(taskName) {
  const supabase = requireSupabase();
  const canUseLastCompleted = await probeLastCompletedColumn(supabase);

  /** @type {Record<string, unknown>} */
  let body = { is_completed: false };
  if (canUseLastCompleted) {
    body.last_completed_date = null;
  }

  let { error } = await supabase
    .from('tasks')
    .update(body)
    .eq('app_source', LAWN_APP_SOURCE)
    .eq('task_name', taskName);

  if (error && isMissingLastCompletedColumnError(error)) {
    body = { is_completed: false };
    ({ error } = await supabase
      .from('tasks')
      .update(body)
      .eq('app_source', LAWN_APP_SOURCE)
      .eq('task_name', taskName));
  }

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }
}

/**
 * Toggle a lawn task's completed state in Supabase.
 * @param {string} taskId
 * @param {boolean} isCompleted
 */
export async function toggleLawnTask(taskId, isCompleted) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('tasks')
    .update({
      is_completed: isCompleted,
    })
    .eq('id', taskId)
    .eq('app_source', LAWN_APP_SOURCE);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }
}

/**
 * Toggle a lawn task by its display name.
 * @param {string} taskName
 * @param {boolean} isCompleted
 */
export async function toggleLawnTaskByName(taskName, isCompleted) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('tasks')
    .update({
      is_completed: isCompleted,
    })
    .eq('app_source', LAWN_APP_SOURCE)
    .eq('task_name', taskName);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }
}

/**
 * Remove a lawn task row from Supabase.
 * @param {string} taskId
 */
export async function deleteLawnTask(taskId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('app_source', LAWN_APP_SOURCE);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }
}

/**
 * Remove a lawn task by its display name.
 * @param {string} taskName
 */
export async function deleteLawnTaskByName(taskName) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('app_source', LAWN_APP_SOURCE)
    .eq('task_name', taskName);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }
}

/**
 * Remove lawn tasks that are no longer part of the compiled export.
 * @param {CompiledLawnTask[]} compiledTasks
 */
export async function deleteStaleLawnTasks(compiledTasks) {
  const activeNames = new Set(compiledTasks.map((task) => task.title));
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, task_name, is_completed')
    .eq('app_source', LAWN_APP_SOURCE);

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }

  for (const row of data ?? []) {
    if (activeNames.has(row.task_name)) continue;
    // Keep completed rows for Done-tab history even if compile export changes.
    if (row.is_completed) continue;
    await deleteLawnTask(row.id);
  }
}
