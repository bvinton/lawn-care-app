import {
  addDaysToDateString,
  SEASONS,
  SEASON_ORDER,
  makeStepKey,
  getWorkflowSeasonForDate,
  getSeasonAnchorDate,
  cascadeSeasonDates,
  isSeasonPackComplete,
} from '../data/LawnPackData';

const GYPSUM_CYCLE_DAYS = 182;

/** @param {string | Date} from @param {string | Date} to */
function daysBetween(from, to) {
  const start = typeof from === 'string' ? new Date(`${from}T12:00:00`) : from;
  const end = typeof to === 'string' ? new Date(`${to}T12:00:00`) : to;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {boolean} input.isDormantSeason   - calendar-based (Dec–Feb): grass not growing
 * @param {boolean} input.isNatureProvidingFullSoak
 * @param {boolean} input.seedEstablishmentActive
 * @param {string | null} input.mowingLockedUntilIso
 * @param {string | null} input.mowingNextDueIso    - pre-computed from dynamic interval
 * @param {string | null} input.wateringNextDueIso  - pre-computed from dynamic interval
 * @param {string | null} input.lastGypsumDate
 * @param {{ mow: string | null, water: string | null } | null} [input.scheduleReason]
 */
export function compileLawnTasks({
  todayStr,
  isDormantSeason,
  isNatureProvidingFullSoak,
  seedEstablishmentActive,
  mowingLockedUntilIso,
  mowingNextDueIso,
  wateringNextDueIso,
  lastGypsumDate,
  scheduleReason = null,
}) {
  /** @param {string} dueDateIso */
  const taskStatusFromDue = (dueDateIso) =>
    daysBetween(dueDateIso, todayStr) >= 0 ? 'urgent' : 'pending';

  /** @type {Array<{ id: string, title: string, dueDate: string, status: 'pending' | 'urgent' | 'completed', module: 'lawn', reason?: string | null }>} */
  const compiledTasks = [];

  if (isDormantSeason) {
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: todayStr,
      status: 'completed',
      module: 'lawn',
      reason: 'Winter dormancy – grass not actively growing',
    });
  } else if (seedEstablishmentActive && mowingLockedUntilIso) {
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: mowingLockedUntilIso,
      status: 'pending',
      module: 'lawn',
      reason: 'Seed establishment – do not mow fresh seed',
    });
  } else {
    const mowDueDate = mowingNextDueIso ?? todayStr;
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: mowDueDate,
      status: taskStatusFromDue(mowDueDate),
      module: 'lawn',
      reason: scheduleReason?.mow ?? null,
    });
  }

  if (isDormantSeason || isNatureProvidingFullSoak) {
    compiledTasks.push({
      id: 'lawn-water',
      title: 'Water lawn',
      dueDate: todayStr,
      status: 'completed',
      module: 'lawn',
      reason: isDormantSeason
        ? 'Winter dormancy – watering suspended'
        : 'Heavy rain forecast – nature providing full soak',
    });
  } else {
    const waterDueDate = wateringNextDueIso ?? todayStr;
    compiledTasks.push({
      id: 'lawn-water',
      title: 'Water lawn',
      dueDate: waterDueDate,
      status: taskStatusFromDue(waterDueDate),
      module: 'lawn',
      reason: scheduleReason?.water ?? null,
    });
  }

  const gypsumDueDate = lastGypsumDate
    ? addDaysToDateString(lastGypsumDate, GYPSUM_CYCLE_DAYS)
    : todayStr;
  compiledTasks.push({
    id: 'lawn-gypsum',
    title: 'Apply Liquid Gypsum',
    dueDate: gypsumDueDate,
    status: taskStatusFromDue(gypsumDueDate),
    module: 'lawn',
  });

  return compiledTasks;
}

/**
 * Lawn Pack timeline steps → shared Tasks reminders (Weedol, scarify, seed, etc.).
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {Record<string, string>} input.userLogs
 * @param {Record<string, Record<string, string>>} input.pendingDates
 */
export function compilePackStepTasks({ todayStr, userLogs, pendingDates }) {
  const workflowSeason = getWorkflowSeasonForDate(todayStr, userLogs);
  const workflowIndex = SEASON_ORDER.indexOf(workflowSeason);

  /** @type {Array<{ id: string, title: string, dueDate: string, status: 'pending' | 'urgent' | 'completed', module: 'lawn', reason?: string | null }>} */
  const compiledTasks = [];

  for (let i = 0; i <= workflowIndex; i++) {
    const seasonKey = SEASON_ORDER[i];
    if (isSeasonPackComplete(seasonKey, userLogs)) {
      continue;
    }

    const anchor = getSeasonAnchorDate(seasonKey, userLogs, pendingDates);
    const seasonPending = cascadeSeasonDates(seasonKey, anchor, userLogs, pendingDates);

    for (const step of SEASONS[seasonKey].steps) {
      const logKey = makeStepKey(seasonKey, step.id);
      const completedDate = userLogs[logKey] ?? null;
      const dueDate = completedDate ?? seasonPending[step.id];
      if (!dueDate) continue;

      const status = completedDate
        ? 'completed'
        : daysBetween(dueDate, todayStr) >= 0
          ? 'urgent'
          : 'pending';

      compiledTasks.push({
        id: `lawn-pack-${seasonKey}-${step.id}`,
        title: step.label,
        dueDate,
        status,
        module: 'lawn',
      });
    }
  }

  return compiledTasks;
}

/**
 * Maintenance (mow/water/gypsum) + pack timeline steps for Supabase / Tasks app.
 * @param {Object} input
 */
export function compileAllLawnTasks(input) {
  const {
    todayStr,
    userLogs,
    pendingDates,
    isDormantSeason,
    isNatureProvidingFullSoak,
    seedEstablishmentActive,
    mowingLockedUntilIso,
    mowingNextDueIso,
    wateringNextDueIso,
    lastGypsumDate,
    scheduleReason = null,
  } = input;

  return [
    ...compilePackStepTasks({ todayStr, userLogs, pendingDates }),
    ...compileLawnTasks({
      todayStr,
      isDormantSeason,
      isNatureProvidingFullSoak,
      seedEstablishmentActive,
      mowingLockedUntilIso,
      mowingNextDueIso,
      wateringNextDueIso,
      lastGypsumDate,
      scheduleReason,
    }),
  ];
}
