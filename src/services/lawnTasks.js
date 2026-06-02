import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { MOW_TASK_NAME, WATER_TASK_NAME } from './lawnMaintenanceSync';

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
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null }} maintenance
 */
function compiledTaskToRow(task, maintenance = {}) {
  /** @type {Record<string, unknown>} */
  const row = {
    app_source: LAWN_APP_SOURCE,
    task_name: task.title,
    due_date: task.dueDate,
    is_completed: task.status === 'completed',
  };

  if (task.title === MOW_TASK_NAME && maintenance.lastMowedDate) {
    row.last_completed_date = maintenance.lastMowedDate;
  }
  if (task.title === WATER_TASK_NAME && maintenance.lastWateredDate) {
    row.last_completed_date = maintenance.lastWateredDate;
  }

  return row;
}

/**
 * Create or update every compiled lawn task in Supabase.
 * @param {CompiledLawnTask[]} compiledTasks
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null }} [maintenance]
 */
export async function syncLawnTasksToSupabase(compiledTasks, maintenance = {}) {
  const supabase = requireSupabase();

  for (const task of compiledTasks) {
    const payload = compiledTaskToRow(task, maintenance);
    const { data: existing, error: findError } = await supabase
      .from('tasks')
      .select('id')
      .eq('app_source', LAWN_APP_SOURCE)
      .eq('task_name', task.title);

    if (findError) {
      throw new Error(`Lookup failed for "${task.title}": ${formatSupabaseSyncError(findError)}`);
    }

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('app_source', LAWN_APP_SOURCE)
        .eq('task_name', task.title);

      if (error) {
        throw new Error(`Update failed for "${task.title}": ${formatSupabaseSyncError(error)}`);
      }
      continue;
    }

    const { error } = await supabase.from('tasks').insert(payload);

    if (error) {
      throw new Error(`Insert failed for "${task.title}": ${formatSupabaseSyncError(error)}`);
    }
  }

  try {
    await deleteStaleLawnTasks(compiledTasks);
  } catch (error) {
    console.warn('[Lawn Care] Stale task cleanup skipped:', error);
  }
}

/** @returns {Promise<LawnTaskRow[]>} */
export async function fetchLawnTasksFromSupabase() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, app_source, task_name, due_date, is_completed')
    .eq('app_source', LAWN_APP_SOURCE)
    .order('due_date', { ascending: true });

  if (error) {
    throw new Error(formatSupabaseSyncError(error));
  }

  return data ?? [];
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
  const existingByName = await fetchLawnTaskIdsByName();

  for (const [taskName, taskId] of existingByName.entries()) {
    if (!activeNames.has(taskName)) {
      await deleteLawnTask(taskId);
    }
  }
}
