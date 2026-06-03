/**
 * Server-side full lawn sync (same pipeline as Lawn app “Sync” button).
 * Used by POST /api/sync-lawn — not imported by the browser bundle.
 */
import { createInitialPendingDates, stripStalePetLockout } from '../data/LawnPackData.js';
import { getSupabaseConfigError, initServerSupabase } from '../lib/supabase.js';
import { fetchLawnAppStateFromSupabase, saveLawnScheduleSnapshot, saveLawnUserLogsToSupabase } from '../services/lawnAppState.js';
import {
  inferMaintenanceDatesFromRows,
  mergeMaintenanceDate,
} from '../services/lawnMaintenanceSync.js';
import { buildMaintenanceSchedule } from '../services/lawnScheduleEngine.js';
import { applyInboundTaskCompletions, GYPSUM_POSTPONE_KEY } from '../services/lawnTaskInboundSync.js';
import {
  fetchLawnTasksForInboundSync,
  syncLawnTasksToSupabase,
} from '../services/lawnTasks.js';
import { fetchLawnWeatherFromOpenMeteo, saveLawnWeatherSnapshot } from '../services/lawnWeather.js';
import { compileAllLawnTasks } from '../utils/compileLawnTasks.js';
import { getTodayLondon } from '../services/lawnScheduleEngine.js';

/**
 * @returns {Promise<{ ok: boolean, taskCount: number, message?: string }>}
 */
export async function runLawnCloudSync() {
  const configError = getSupabaseConfigError({ server: true });
  if (configError) {
    return { ok: false, taskCount: 0, message: configError };
  }

  initServerSupabase();

  const todayStr = getTodayLondon();
  const cloudState = await fetchLawnAppStateFromSupabase();

  if (!cloudState) {
    return {
      ok: false,
      taskCount: 0,
      message: 'Lawn cloud state not set up. Run supabase/lawn_app_state.sql in Supabase.',
    };
  }

  let userLogs = stripStalePetLockout({ ...cloudState.userLogs }, todayStr);
  const scheduleSnapshot = cloudState.scheduleSnapshot ?? {};

  let lastMowedDate = scheduleSnapshot.lastMowedDate ?? null;
  let lastWateredDate = scheduleSnapshot.lastWateredDate ?? null;

  const inboundRows = await fetchLawnTasksForInboundSync();
  const inbound = applyInboundTaskCompletions(inboundRows, todayStr, userLogs, {
    lastMowedDate,
    lastWateredDate,
  });
  userLogs = stripStalePetLockout(inbound.userLogs, todayStr);
  lastMowedDate = inbound.lastMowedDate ?? lastMowedDate;
  lastWateredDate = inbound.lastWateredDate ?? lastWateredDate;

  const maintenanceRows = inboundRows.filter((row) =>
    ['Mow lawn', 'Water lawn'].includes(row.task_name)
  );
  const inferred = inferMaintenanceDatesFromRows(maintenanceRows, todayStr);
  lastMowedDate = mergeMaintenanceDate(lastMowedDate, inferred.lastMowedDate);
  lastWateredDate = mergeMaintenanceDate(lastWateredDate, inferred.lastWateredDate);

  await saveLawnUserLogsToSupabase(userLogs);

  let weather;
  try {
    weather = await fetchLawnWeatherFromOpenMeteo();
    await saveLawnWeatherSnapshot(weather);
  } catch (err) {
    console.warn('[Lawn sync API] Weather fetch failed, using cloud snapshot:', err);
    weather = cloudState.weatherSnapshot ?? {
      forecastedRainSum: scheduleSnapshot.forecastedRainSum ?? 0,
      currentSoilTemp: scheduleSnapshot.currentSoilTemp ?? null,
      currentSoilTempMin: null,
      isRainForecasted: false,
      isNatureProvidingFullSoak: scheduleSnapshot.isNatureProvidingFullSoak ?? false,
      netWaterNeeded: 10,
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo',
    };
  }

  const forecastedRainSum = weather.forecastedRainSum;
  const currentSoilTemp = weather.currentSoilTemp;
  const isNatureProvidingFullSoak = weather.isNatureProvidingFullSoak;

  const pendingDates =
    scheduleSnapshot.pendingDates ??
    createInitialPendingDates(null, userLogs);

  const maintenance = buildMaintenanceSchedule({
    todayStr,
    userLogs,
    forecastedRainSum,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
  });

  const compiledTasks = compileAllLawnTasks({
    todayStr,
    userLogs,
    pendingDates,
    isDormantSeason: maintenance.isDormantSeason,
    isNatureProvidingFullSoak: maintenance.isNatureProvidingFullSoak,
    seedEstablishmentActive: maintenance.seedEstablishmentActive,
    mowingLockedUntilIso: maintenance.mowingLockedUntilIso,
    mowingNextDueIso: maintenance.mowingNextDueIso,
    wateringNextDueIso: maintenance.wateringNextDueIso,
    lastGypsumDate: userLogs.lastGypsumDate ?? null,
    gypsumPostponedUntil: userLogs[GYPSUM_POSTPONE_KEY] ?? null,
    scheduleReason: null,
  });

  await syncLawnTasksToSupabase(
    compiledTasks,
    { lastMowedDate, lastWateredDate },
    todayStr
  );

  await saveLawnScheduleSnapshot(
    {
      lastMowedDate,
      lastWateredDate,
      mowingNextDueIso: maintenance.mowingNextDueIso,
      wateringNextDueIso: maintenance.wateringNextDueIso,
      forecastedRainSum,
      currentSoilTemp,
      isNatureProvidingFullSoak,
      pendingDates,
    },
    userLogs
  );

  return { ok: true, taskCount: compiledTasks.length };
}
