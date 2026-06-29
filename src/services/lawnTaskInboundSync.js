import { SEASONS, makeStepKey } from '../data/LawnPackData';
import {
  MOW_TASK_NAME,
  WATER_TASK_NAME,
  VERTICUT_TASK_NAME,
  WATERING_SESSION_NAMES,
  pickLatestIsoDate,
} from './lawnMaintenanceSync';

export const GYPSUM_TASK_NAME = 'Apply Liquid Gypsum';
export const GYPSUM_LOG_KEY = 'lastGypsumDate';
export const GYPSUM_POSTPONE_KEY = 'gypsumPostponedUntil';
export const TASK_SKIPS_LOG_KEY = 'taskSkips';

/** @type {Array<{ label: string, days: number }>} */
export const GYPSUM_POSTPONE_OPTIONS = [
  { label: '4 weeks', days: 28 },
  { label: '3 months', days: 91 },
  { label: '6 months', days: 182 },
];

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
    taskNameToStepKey.set(
      'Step 2: Apply Deeper Green Iron Sulphate',
      makeStepKey('WINTER', 'iron1')
    );
  }
  return taskNameToStepKey;
}

/**
 * @typedef {Object} InboundTaskRow
 * @property {string} task_name
 * @property {string} due_date
 * @property {boolean} is_completed
 * @property {string | null} [last_completed_date]
 * @property {string | null} [skipped_on]
 */

/**
 * @typedef {{ taskName: string, skippedOn: string }} TaskSkipEntry
 */

/** @param {Record<string, string>} userLogs */
export function parseTaskSkips(userLogs) {
  const raw = userLogs[TASK_SKIPS_LOG_KEY];
  if (!raw) return /** @type {TaskSkipEntry[]} */ ([]);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {InboundTaskRow[]} rows
 * @param {Record<string, string>} userLogs
 */
export function applyInboundTaskSkips(rows, userLogs) {
  /** @type {Record<string, string>} */
  const nextLogs = { ...userLogs };
  const existing = parseTaskSkips(nextLogs);
  const seen = new Set(existing.map((entry) => `${entry.taskName}:${entry.skippedOn}`));
  let updated = false;

  for (const row of rows) {
    if (!row.skipped_on) continue;
    const key = `${row.task_name}:${row.skipped_on}`;
    if (seen.has(key)) continue;
    existing.push({ taskName: row.task_name, skippedOn: row.skipped_on });
    seen.add(key);
    updated = true;
  }

  if (updated) {
    nextLogs[TASK_SKIPS_LOG_KEY] = JSON.stringify(existing);
  }

  return nextLogs;
}

/**
 * @param {string} todayStr
 * @param {string} fromIso
 */
function daysBetweenIso(todayStr, fromIso) {
  const start = new Date(`${fromIso}T12:00:00`);
  const end = new Date(`${todayStr}T12:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * @param {Record<string, string>} userLogs
 * @param {string} todayStr
 * @param {number} [withinDays]
 */
export function countRecentWateringSkips(userLogs, todayStr, withinDays = 7) {
  const skips = parseTaskSkips(userLogs);
  let count = 0;

  for (const skip of skips) {
    if (
      skip.taskName !== WATER_TASK_NAME &&
      !skip.taskName.startsWith('Water lawn (')
    ) {
      continue;
    }
    const days = daysBetweenIso(todayStr, skip.skippedOn);
    if (days >= 0 && days <= withinDays) {
      count += 1;
    }
  }

  return count;
}

/**
 * @param {Record<string, string>} userLogs
 * @param {string} todayStr
 * @param {number} [withinDays]
 */
export function countFullySkippedWateringDays(userLogs, todayStr, withinDays = 7) {
  const skips = parseTaskSkips(userLogs);
  /** @type {Map<string, Set<string>>} */
  const byDate = new Map();

  for (const skip of skips) {
    if (!skip.taskName.startsWith('Water lawn (')) continue;
    const days = daysBetweenIso(todayStr, skip.skippedOn);
    if (days < 0 || days > withinDays) continue;
    if (!byDate.has(skip.skippedOn)) byDate.set(skip.skippedOn, new Set());
    byDate.get(skip.skippedOn)?.add(skip.taskName);
  }

  let fullDays = 0;
  for (const names of byDate.values()) {
    if (WATERING_SESSION_NAMES.every((name) => names.has(name))) {
      fullDays += 1;
    }
  }

  return fullDays;
}

/**
 * Merge Tasks app / Supabase completions into lawn pack logs and maintenance dates.
 * @param {InboundTaskRow[]} rows
 * @param {string} todayStr
 * @param {Record<string, string>} userLogs
 * @param {{ lastMowedDate?: string | null, lastWateredDate?: string | null, lastVerticutDate?: string | null }} maintenance
 */
export function applyInboundTaskCompletions(rows, todayStr, userLogs, maintenance = {}) {
  const stepMap = getTaskNameToStepKeyMap();
  /** @type {Record<string, string>} */
  const nextLogs = { ...userLogs };
  let lastMowedDate = maintenance.lastMowedDate ?? null;
  let lastWateredDate = maintenance.lastWateredDate ?? null;
  let lastVerticutDate = maintenance.lastVerticutDate ?? null;
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

    if (row.task_name === WATER_TASK_NAME || row.task_name.startsWith('Water lawn (')) {
      const merged = pickLatestIsoDate(lastWateredDate, completionDate);
      if (merged !== lastWateredDate) {
        lastWateredDate = merged;
        maintenanceUpdated = true;
      }
      continue;
    }

    if (row.task_name === VERTICUT_TASK_NAME) {
      const merged = pickLatestIsoDate(lastVerticutDate, completionDate);
      if (merged !== lastVerticutDate) {
        lastVerticutDate = merged;
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
    lastVerticutDate,
    packStepsUpdated,
    maintenanceUpdated,
  };
}
