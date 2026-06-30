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
import {
  VERTICUT_BLADE_HEIGHT_RULE,
  VERTICUT_MOW_PAIRING_NOTE,
} from '../services/lawnScheduleEngine';
import { getWateringRainSkipForDueDate, getSeedMistingRainSkipForSession } from '../services/lawnWeather';
import { VERTICUT_TASK_NAME } from '../services/lawnMaintenanceSync';

const GYPSUM_CYCLE_DAYS = 182;

/**
 * @param {string | null} lastGypsumDate
 * @param {string | null | undefined} gypsumPostponedUntil
 * @param {string} todayStr
 */
export function getGypsumSchedule(lastGypsumDate, gypsumPostponedUntil, todayStr) {
  const naturalDue = lastGypsumDate
    ? addDaysToDateString(lastGypsumDate, GYPSUM_CYCLE_DAYS)
    : todayStr;

  const snoozed =
    typeof gypsumPostponedUntil === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(gypsumPostponedUntil) &&
    gypsumPostponedUntil > todayStr;

  const dueDate = snoozed ? gypsumPostponedUntil : naturalDue;
  const cycleWouldBeDue =
    !lastGypsumDate || daysBetween(naturalDue, todayStr) >= 0;
  const gypsumDue = snoozed ? false : cycleWouldBeDue;

  let gypsumDaysRemaining = 0;
  if (snoozed) {
    gypsumDaysRemaining = daysBetween(todayStr, gypsumPostponedUntil);
  } else if (!gypsumDue && lastGypsumDate && daysBetween(naturalDue, todayStr) < 0) {
    gypsumDaysRemaining = daysBetween(todayStr, naturalDue);
  }

  return {
    dueDate,
    gypsumDue,
    gypsumDaysRemaining,
    naturalDue,
    snoozed,
    gypsumPostponedUntil: snoozed ? gypsumPostponedUntil : null,
  };
}

/** @param {string | Date} from @param {string | Date} to */
function daysBetween(from, to) {
  const start = typeof from === 'string' ? new Date(`${from}T12:00:00`) : from;
  const end = typeof to === 'string' ? new Date(`${to}T12:00:00`) : to;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** @param {string} dueDateIso @param {string} reason */
function pushRainSkippedWaterTasks(compiledTasks, seedEstablishmentActive, dueDateIso, reason) {
  if (seedEstablishmentActive) {
    for (const session of [
      { id: 'lawn-water-morning', title: 'Water lawn (Morning)' },
      { id: 'lawn-water-midday', title: 'Water lawn (Midday)' },
      { id: 'lawn-water-evening', title: 'Water lawn (Evening)' },
    ]) {
      compiledTasks.push({
        id: session.id,
        title: session.title,
        dueDate: dueDateIso,
        status: 'completed',
        module: 'lawn',
        reason,
      });
    }
    return;
  }

  compiledTasks.push({
    id: 'lawn-water',
    title: 'Water lawn',
    dueDate: dueDateIso,
    status: 'completed',
    module: 'lawn',
    reason,
  });
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {boolean} input.isDormantSeason   - calendar-based (Dec–Feb): grass not growing
 * @param {boolean} input.isNatureProvidingFullSoak
 * @param {boolean} [input.soilRecentlyWet]
 * @param {Array<{ date: string, mm: number }>} [input.dailyForecastByDate]
 * @param {number} [input.recentPastRainBeforeToday]
 * @param {number} [input.todayRainMm]
 * @param {boolean} input.seedEstablishmentActive
 * @param {string | null} input.mowingLockedUntilIso
 * @param {string | null} input.mowingNextDueIso    - pre-computed from dynamic interval
 * @param {string | null} input.wateringNextDueIso  - pre-computed from dynamic interval
 * @param {boolean} [input.isVerticutSeason]
 * @param {boolean} [input.renovationHoldActive]
 * @param {string | null} [input.verticutLockedUntilIso]
 * @param {boolean} [input.verticutHeatDroughtPaused]
 * @param {string | null} [input.verticutNextDueIso]
 * @param {boolean} [input.verticutPairedWithMow]
 * @param {string | null} [input.lastGypsumDate]
 * @param {string | null} [input.gypsumPostponedUntil]
 * @param {{ mow: string | null, water: string | null, verticut?: string | null } | null} [input.scheduleReason]
 */
export function compileLawnTasks({
  todayStr,
  isDormantSeason,
  isNatureProvidingFullSoak,
  soilRecentlyWet = false,
  dailyForecastByDate = [],
  recentPastRainBeforeToday = 0,
  todayRainMm = 0,
  todayHourlyPrecipMm = [],
  todayRainObservedMm = 0,
  seedEstablishmentActive,
  mowingLockedUntilIso,
  mowingNextDueIso,
  wateringNextDueIso,
  isVerticutSeason = false,
  renovationHoldActive = false,
  verticutLockedUntilIso = null,
  verticutHeatDroughtPaused = false,
  verticutNextDueIso = null,
  verticutPairedWithMow = false,
  lastGypsumDate,
  gypsumPostponedUntil = null,
  scheduleReason = null,
  dynamicMinutes = 0,
  recentWateringSkips = 0,
}) {
  /** @param {string} dueDateIso */
  const taskStatusFromDue = (dueDateIso) =>
    daysBetween(dueDateIso, todayStr) >= 0 ? 'urgent' : 'pending';

  /** @type {Array<{ id: string, title: string, dueDate: string, status: 'pending' | 'urgent' | 'completed', module: 'lawn', reason?: string | null }>} */
  const compiledTasks = [];

  const mowPairedWithVerticut =
    verticutPairedWithMow &&
    isVerticutSeason &&
    !renovationHoldActive &&
    !verticutHeatDroughtPaused &&
    verticutNextDueIso &&
    mowingNextDueIso &&
    verticutNextDueIso === mowingNextDueIso;

  const buildMowReason = () => {
    const parts = [];
    if (mowPairedWithVerticut) {
      parts.push(VERTICUT_MOW_PAIRING_NOTE);
    }
    if (scheduleReason?.mow) {
      parts.push(scheduleReason.mow);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const buildVerticutReason = () => {
    const parts = [VERTICUT_BLADE_HEIGHT_RULE];
    if (mowPairedWithVerticut) {
      parts.push(VERTICUT_MOW_PAIRING_NOTE);
    }
    if (scheduleReason?.verticut) {
      parts.push(scheduleReason.verticut);
    }
    return parts.join(' · ');
  };

  if (isDormantSeason) {
    compiledTasks.push({
      id: 'lawn-mow',
      title: 'Mow lawn',
      dueDate: mowingNextDueIso ?? todayStr,
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
      reason: buildMowReason(),
    });
  }

  if (!isVerticutSeason) {
    compiledTasks.push({
      id: 'lawn-verticut',
      title: VERTICUT_TASK_NAME,
      dueDate: verticutNextDueIso ?? todayStr,
      status: 'completed',
      module: 'lawn',
      reason: 'Outside active season (Apr 1 – Sep 30)',
    });
  } else if (renovationHoldActive && verticutLockedUntilIso) {
    compiledTasks.push({
      id: 'lawn-verticut',
      title: VERTICUT_TASK_NAME,
      dueDate: verticutLockedUntilIso,
      status: 'pending',
      module: 'lawn',
      reason: 'Post-renovation hold – allow 6–8 weeks for root maturation',
    });
  } else if (verticutHeatDroughtPaused) {
    compiledTasks.push({
      id: 'lawn-verticut',
      title: VERTICUT_TASK_NAME,
      dueDate: verticutNextDueIso ?? todayStr,
      status: 'completed',
      module: 'lawn',
      reason:
        scheduleReason?.verticut ??
        'Paused during extreme heat or drought risk to protect the lawn from stress',
    });
  } else {
    const verticutDueDate = verticutNextDueIso ?? todayStr;
    compiledTasks.push({
      id: 'lawn-verticut',
      title: VERTICUT_TASK_NAME,
      dueDate: verticutDueDate,
      status: taskStatusFromDue(verticutDueDate),
      module: 'lawn',
      reason: buildVerticutReason(),
    });
  }

  if (isDormantSeason) {
    compiledTasks.push({
      id: 'lawn-water',
      title: 'Water lawn',
      dueDate: wateringNextDueIso ?? todayStr,
      status: 'completed',
      module: 'lawn',
      reason: 'Winter dormancy – watering suspended',
    });
  } else {
    const waterDueDate = wateringNextDueIso ?? todayStr;

    if (seedEstablishmentActive) {
      const waterStatus = taskStatusFromDue(waterDueDate);
      const mistingMins = dynamicMinutes > 0 ? Math.round(dynamicMinutes / 3) : 0;
      const baseReason = scheduleReason?.water ? `${scheduleReason.water} · ` : '';
      const perSessionText =
        mistingMins > 0 ? `Run for ${mistingMins} minutes` : 'divide daily duration by 3';
      const missAdvisory =
        recentWateringSkips > 0
          ? `Missed ${recentWateringSkips} misting session${recentWateringSkips === 1 ? '' : 's'} this week — keep seed bed moist`
          : null;
      const mistingReason = [`${baseReason}Light surface misting · ${perSessionText}`, missAdvisory]
        .filter(Boolean)
        .join(' · ');

      for (const session of [
        { id: 'lawn-water-morning', title: 'Water lawn (Morning)' },
        { id: 'lawn-water-midday', title: 'Water lawn (Midday)' },
        { id: 'lawn-water-evening', title: 'Water lawn (Evening)' },
      ]) {
        const sessionRainSkip = getSeedMistingRainSkipForSession(
          session.title,
          waterDueDate,
          todayStr,
          todayHourlyPrecipMm,
          dailyForecastByDate,
          todayRainMm,
          todayRainObservedMm
        );

        if (sessionRainSkip.skip && sessionRainSkip.reason) {
          compiledTasks.push({
            id: session.id,
            title: session.title,
            dueDate: waterDueDate,
            status: 'completed',
            module: 'lawn',
            reason: sessionRainSkip.reason,
          });
        } else {
          compiledTasks.push({
            id: session.id,
            title: session.title,
            dueDate: waterDueDate,
            status: waterStatus,
            module: 'lawn',
            reason: mistingReason,
          });
        }
      }
    } else {
      const rainSkip =
        dailyForecastByDate.length > 0
          ? getWateringRainSkipForDueDate(
              waterDueDate,
              todayStr,
              dailyForecastByDate,
              recentPastRainBeforeToday,
              todayRainMm,
              { seedEstablishmentActive: false }
            )
          : {
              skip: isNatureProvidingFullSoak || soilRecentlyWet,
              reason: isNatureProvidingFullSoak
                ? 'Heavy rain – nature providing full soak'
                : soilRecentlyWet
                  ? 'Recent rain – soil still damp, skip watering'
                  : null,
            };

      if (rainSkip.skip && rainSkip.reason) {
        pushRainSkippedWaterTasks(compiledTasks, false, waterDueDate, rainSkip.reason);
      } else {
        compiledTasks.push({
          id: 'lawn-water',
          title: 'Water lawn',
          dueDate: waterDueDate,
          status: taskStatusFromDue(waterDueDate),
          module: 'lawn',
          reason: scheduleReason?.water ?? null,
        });
      }
    }
  }

  const gypsum = getGypsumSchedule(lastGypsumDate, gypsumPostponedUntil, todayStr);
  compiledTasks.push({
    id: 'lawn-gypsum',
    title: 'Apply Liquid Gypsum',
    dueDate: gypsum.dueDate,
    status: gypsum.gypsumDue ? 'urgent' : taskStatusFromDue(gypsum.dueDate),
    module: 'lawn',
    reason: gypsum.snoozed
      ? `Postponed — remind ${gypsum.dueDate}`
      : 'Typically every ~6 months for soil drainage',
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
    const seasonComplete = isSeasonPackComplete(seasonKey, userLogs);
    const anchor = getSeasonAnchorDate(seasonKey, userLogs, pendingDates);
    const seasonPending = cascadeSeasonDates(seasonKey, anchor, userLogs, pendingDates);

    for (const step of SEASONS[seasonKey].steps) {
      const logKey = makeStepKey(seasonKey, step.id);
      const completedDate = userLogs[logKey] ?? null;

      if (seasonComplete) {
        if (!completedDate) continue;
        compiledTasks.push({
          id: `lawn-pack-${seasonKey}-${step.id}`,
          title: step.label,
          dueDate: completedDate,
          status: 'completed',
          module: 'lawn',
          completedDate,
        });
        continue;
      }

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
        completedDate: completedDate ?? null,
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
    soilRecentlyWet = false,
    dailyForecastByDate = [],
    recentPastRainBeforeToday = 0,
    todayRainMm = 0,
    todayHourlyPrecipMm = [],
    todayRainObservedMm = 0,
    seedEstablishmentActive,
    mowingLockedUntilIso,
    mowingNextDueIso,
    wateringNextDueIso,
    isVerticutSeason,
    renovationHoldActive,
    verticutLockedUntilIso,
    verticutHeatDroughtPaused,
    verticutNextDueIso,
    verticutPairedWithMow,
    lastGypsumDate,
    gypsumPostponedUntil = null,
    scheduleReason = null,
    dynamicMinutes = 0,
    recentWateringSkips = 0,
  } = input;

  return [
    ...compilePackStepTasks({ todayStr, userLogs, pendingDates }),
    ...compileLawnTasks({
      todayStr,
      isDormantSeason,
      isNatureProvidingFullSoak,
      soilRecentlyWet,
      dailyForecastByDate,
      recentPastRainBeforeToday,
      todayRainMm,
      todayHourlyPrecipMm,
      todayRainObservedMm,
      seedEstablishmentActive,
      mowingLockedUntilIso,
      mowingNextDueIso,
      wateringNextDueIso,
      isVerticutSeason,
      renovationHoldActive,
      verticutLockedUntilIso,
      verticutHeatDroughtPaused,
      verticutNextDueIso,
      verticutPairedWithMow,
      lastGypsumDate,
      gypsumPostponedUntil,
      scheduleReason,
      dynamicMinutes,
      recentWateringSkips,
    }),
  ];
}
