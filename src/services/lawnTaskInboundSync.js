import { SEASONS, makeStepKey } from '../data/LawnPackData';
import { MOW_TASK_NAME, WATER_TASK_NAME, pickLatestIsoDate } from './lawnMaintenanceSync';

export const GYPSUM_TASK_NAME = 'Apply Liquid Gypsum';
export const GYPSUM_LOG_KEY = 'lastGypsumDate';

/** @type {Map<string, string> | null} */
let taskNameToStepKey = null;

function getTaskNameToStepKeyMap() {
  if (!taskNameToStepKey) {
    taskNameToStepKey = new Map();
    for (const seasonKey of Object.keys(SEASONS)) {
      for (const step of SEASONS[seasonKey].steps) {
        taskNameToStepKey.set(step.label, makeStepKey(seasonKey, step.id));
      }
    }
  }
  return taskNameToStepKey;
}

/**
 * @typedef {Object} InboundTaskRow
 * @property {string} task_name
 * @property {string} due_date
 * @property {boolean} is_completed
 * @property {string | null} [last_completed_date]
 */

/**
 * Merge Tasks app / Supabase completions into lawn pack logs and maintenance dates.
 * @param {InboundTaskRow[]} rows
 * @param {string} todayStr
 * @param {Record<string, string>} userLogs
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null }} maintenance
 */
export function applyInboundTaskCompletions(rows, todayStr, userLogs, maintenance = {}) {
  const stepMap = getTaskNameToStepKeyMap();
  /** @type {Record<string, string>} */
  const nextLogs = { ...userLogs };
  let lastMowedDate = maintenance.lastMowedDate ?? null;
  let lastWateredDate = maintenance.lastWateredDate ?? null;
  let packStepsUpdated = 0;
  let maintenanceUpdated = false;

  for (const row of rows) {
    if (!row.is_completed) continue;

    const completionDate =
      row.last_completed_date ??
      (row.due_date && row.due_date <= todayStr ? row.due_date : null);
    if (!completionDate) continue;

    if (row.task_name === MOW_TASK_NAME) {
      const merged = pickLatestIsoDate(lastMowedDate, completionDate);
      if (merged !== lastMowedDate) {
        lastMowedDate = merged;
        maintenanceUpdated = true;
      }
      continue;
    }

    if (row.task_name === WATER_TASK_NAME) {
      const merged = pickLatestIsoDate(lastWateredDate, completionDate);
      if (merged !== lastWateredDate) {
        lastWateredDate = merged;
        maintenanceUpdated = true;
      }
      continue;
    }

    if (row.task_name === GYPSUM_TASK_NAME) {
      const merged = pickLatestIsoDate(nextLogs[GYPSUM_LOG_KEY], completionDate);
      if (merged && merged !== nextLogs[GYPSUM_LOG_KEY]) {
        nextLogs[GYPSUM_LOG_KEY] = merged;
        packStepsUpdated += 1;
      }
      continue;
    }

    const stepKey = stepMap.get(row.task_name);
    if (stepKey) {
      const merged = pickLatestIsoDate(nextLogs[stepKey], completionDate);
      if (merged && merged !== nextLogs[stepKey]) {
        nextLogs[stepKey] = merged;
        packStepsUpdated += 1;
      }
    }
  }

  return {
    userLogs: nextLogs,
    lastMowedDate,
    lastWateredDate,
    packStepsUpdated,
    maintenanceUpdated,
  };
}
