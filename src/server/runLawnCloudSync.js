/**
 * Server-side full lawn sync (same pipeline as Lawn app “Sync” button).
 * Used by POST /api/sync-lawn — not imported by the browser bundle.
 */
import { createInitialPendingDates, stripStalePetLockout, makeStepKey } from '../data/LawnPackData.js';
import { getSupabaseConfigError, initServerSupabase } from '../lib/supabase.js';
import { fetchLawnAppStateFromSupabase, saveLawnScheduleSnapshot, saveLawnUserLogsToSupabase } from '../services/lawnAppState.js';
import {
  inferMaintenanceDatesFromRows,
  mergeMaintenanceDate,
  MOW_TASK_NAME,
  WATER_TASK_NAME,
  VERTICUT_TASK_NAME,
} from '../services/lawnMaintenanceSync.js';
import { buildMaintenanceSchedule, getScheduleReason } from '../services/lawnScheduleEngine.js';
import { applyInboundTaskCompletions, GYPSUM_POSTPONE_KEY } from '../services/lawnTaskInboundSync.js';
import {
  fetchLawnTasksForInboundSync,
  syncLawnTasksToSupabase,
} from '../services/lawnTasks.js';
import { resolveWeatherLocation } from '../services/lawnLocation.js';
import {
  computeWateringRainContext,
  fetchLawnWeatherFromOpenMeteo,
  getEffectiveNearTermRain,
  getEffectiveRecentPastRain,
  saveLawnWeatherSnapshot,
} from '../services/lawnWeather.js';
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
  let lastVerticutDate = scheduleSnapshot.lastVerticutDate ?? null;

  const inboundRows = await fetchLawnTasksForInboundSync();
  const inbound = applyInboundTaskCompletions(inboundRows, todayStr, userLogs, {
    lastMowedDate,
    lastWateredDate,
    lastVerticutDate,
  });
  userLogs = stripStalePetLockout(inbound.userLogs, todayStr);
  lastMowedDate = inbound.lastMowedDate ?? lastMowedDate;
  lastWateredDate = inbound.lastWateredDate ?? lastWateredDate;
  lastVerticutDate = inbound.lastVerticutDate ?? lastVerticutDate;

  const maintenanceRows = inboundRows.filter((row) =>
    [MOW_TASK_NAME, WATER_TASK_NAME, VERTICUT_TASK_NAME].includes(row.task_name)
  );
  const inferred = inferMaintenanceDatesFromRows(maintenanceRows, todayStr);
  lastMowedDate = mergeMaintenanceDate(lastMowedDate, inferred.lastMowedDate);
  lastWateredDate = mergeMaintenanceDate(lastWateredDate, inferred.lastWateredDate);
  lastVerticutDate = mergeMaintenanceDate(lastVerticutDate, inferred.lastVerticutDate);

  await saveLawnUserLogsToSupabase(userLogs);

  const weatherLocation = resolveWeatherLocation(scheduleSnapshot.weatherLocation);

  let weather;
  try {
    weather = await fetchLawnWeatherFromOpenMeteo(weatherLocation);
    await saveLawnWeatherSnapshot(weather);
  } catch (err) {
    console.warn('[Lawn sync API] Weather fetch failed, using cloud snapshot:', err);
    const fromCloud = cloudState.weatherSnapshot;
    if (fromCloud && typeof fromCloud.forecastedRainSum === 'number') {
      weather = fromCloud;
    } else if (typeof scheduleSnapshot.forecastedRainSum === 'number') {
      const nearTerm = getEffectiveNearTermRain({
        forecastedRainSum: scheduleSnapshot.forecastedRainSum,
        forecastedRainSumNearTerm: scheduleSnapshot.forecastedRainSumNearTerm,
      });
      const pastRain = getEffectiveRecentPastRain({
        recentPastRainSum: scheduleSnapshot.recentPastRainSum,
      });
      const watering = computeWateringRainContext(pastRain, nearTerm);
      weather = {
        forecastedRainSum: scheduleSnapshot.forecastedRainSum,
        forecastedRainSumNearTerm: nearTerm,
        recentPastRainSum: pastRain,
        rainCreditMm: watering.rainCreditMm,
        currentSoilTemp: scheduleSnapshot.currentSoilTemp ?? null,
        currentSoilTempMin: null,
        isRainForecasted: nearTerm >= 5 || pastRain >= 5,
        isNatureProvidingFullSoak:
          scheduleSnapshot.isNatureProvidingFullSoak ?? watering.isNatureProvidingFullSoak,
        soilRecentlyWet: watering.soilRecentlyWet,
        netWaterNeeded: watering.netWaterNeeded,
        fetchedAt: scheduleSnapshot.savedAt ?? new Date().toISOString(),
        source: 'open-meteo',
      };
    } else {
      throw new Error('Weather forecast unavailable and no cached snapshot in cloud.');
    }
  }

  const forecastedRainSum = weather.forecastedRainSum;
  const forecastedRainSumNearTerm = getEffectiveNearTermRain(weather);
  const recentPastRainSum = getEffectiveRecentPastRain(weather);
  const currentSoilTemp = weather.currentSoilTemp;
  const isNatureProvidingFullSoak = weather.isNatureProvidingFullSoak;

  const pendingDates =
    scheduleSnapshot.pendingDates ??
    createInitialPendingDates(null, userLogs);

  const maintenance = buildMaintenanceSchedule({
    todayStr,
    userLogs,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
    lastVerticutDate,
  });

  const scheduleReason = getScheduleReason({
    forecastedRainSumNearTerm,
    forecastedRainSumWeek: forecastedRainSum,
    recentPastRainSum,
    currentSoilTemp,
    springSeedDate: userLogs[makeStepKey('SPRING', 'seed')] ?? null,
    seedEstablishmentActive: maintenance.seedEstablishmentActive,
    todayStr,
    userLogs,
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
    isVerticutSeason: maintenance.isVerticutSeason,
    renovationHoldActive: maintenance.renovationHoldActive,
    verticutLockedUntilIso: maintenance.verticutLockedUntilIso,
    verticutHeatDroughtPaused: maintenance.verticutHeatDroughtPaused,
    verticutNextDueIso: maintenance.verticutNextDueIso,
    verticutPairedWithMow: maintenance.verticutPairedWithMow,
    lastGypsumDate: userLogs.lastGypsumDate ?? null,
    gypsumPostponedUntil: userLogs[GYPSUM_POSTPONE_KEY] ?? null,
    scheduleReason,
  });

  await syncLawnTasksToSupabase(
    compiledTasks,
    { lastMowedDate, lastWateredDate, lastVerticutDate },
    todayStr
  );

  await saveLawnScheduleSnapshot(
    {
      lastMowedDate,
      lastWateredDate,
      lastVerticutDate,
      mowingNextDueIso: maintenance.mowingNextDueIso,
      wateringNextDueIso: maintenance.wateringNextDueIso,
      verticutNextDueIso: maintenance.verticutNextDueIso,
      forecastedRainSum,
      forecastedRainSumNearTerm,
      recentPastRainSum,
      weatherLocation,
      currentSoilTemp,
      isNatureProvidingFullSoak,
      pendingDates,
    },
    userLogs
  );

  return { ok: true, taskCount: compiledTasks.length };
}
