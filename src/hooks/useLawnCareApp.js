import { useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_LAWN_CONFIG,
  SEASONS,
  EQUIPMENT_OPTIONS,
  SPRINKLER_OPTIONS,
  WEEDOL_BARRIER_DAYS,
  SEASON_START_DATES,
  getCalendarSeasonForDate,
  getWorkflowSeasonForDate,
  getIncompleteSeasonSteps,
  makeStepKey,
  createInitialPendingDates,
  cascadeSeasonDates,
  getSeasonAnchorDate,
  getGranularRepeatDate,
  addDaysToDateString,
  stepTriggersPetLockout,
  hasChemicalApplicationToday,
  stripStalePetLockout,
} from '../data/LawnPackData';
import {
  syncLawnTasksToSupabase,
  fetchLawnTasksFromSupabase,
  fetchLawnTasksForInboundSync,
  clearLawnTaskCompletion,
} from '../services/lawnTasks';
import {
  applyInboundTaskCompletions,
  GYPSUM_LOG_KEY,
  GYPSUM_POSTPONE_KEY,
} from '../services/lawnTaskInboundSync';
import { getGypsumSchedule } from '../utils/compileLawnTasks';
import {
  mergeMaintenanceDate,
  pullMaintenanceDatesFromSupabase,
  getLastCompletedColumnHint,
  probeLastCompletedColumn,
  isMissingLastCompletedColumnError,
} from '../services/lawnMaintenanceSync';
import {
  fetchLawnAppStateFromSupabase,
  fetchLawnUserLogsFromSupabase,
  saveLawnUserLogsToSupabase,
  saveLawnScheduleSnapshot,
  mergeLawnUserLogs,
  getLawnAppStateSetupHint,
} from '../services/lawnAppState';
import {
  DEFAULT_WEATHER_LOCATION,
  getBrowserGeolocation,
  lookupNearestUkPostcode,
  lookupUkPostcode,
  mergeWeatherLocation,
  parseWeatherLocation,
  persistWeatherLocation,
  readStoredWeatherLocation,
} from '../services/lawnLocation';
import {
  fetchLawnWeatherFromOpenMeteo,
  fetchLawnWeatherSnapshotFromSupabase,
  computeWateringRainContext,
  getEffectiveNearTermRain,
  getEffectiveRecentPastRain,
  isWeatherSnapshotFresh,
  saveLawnWeatherSnapshot,
} from '../services/lawnWeather';
import {
  buildMaintenanceSchedule,
  getMowingWeatherAdvisory,
  getScheduleReason,
} from '../services/lawnScheduleEngine';
import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { compileAllLawnTasks } from '../utils/compileLawnTasks';
import { applyLawnFocusFromUrl, getFocusFromUrl, parsePackStepFocus } from '../utils/lawnDeepLink';
import { readStoredJson } from '../utils/lawnStorage';
import {
  startOfDay,
  daysBetween,
  formatDisplayDate,
  formatInputDate,
  formatNextDueDate,
} from '../utils/lawnDates';
import {
  MS_PER_HOUR,
  SEED_ESTABLISHMENT_DAYS,
  SEED_GERMINATION_SOIL_TEMP_MIN_C,
  SEED_GERMINATION_SOIL_TEMP_MAX_C,
  PET_LOCKOUT_KEY,
  PET_LOCKOUT_HOURS,
  MOWER_OPTIONS,
  LAWN_SURFACE_OPTIONS,
} from '../data/lawnUiConfig';

export function useLawnCareApp() {
  const [length, setLength] = useState(INITIAL_LAWN_CONFIG.defaultLength);
  const [width, setWidth] = useState(INITIAL_LAWN_CONFIG.defaultWidth);
  const [sqm, setSqm] = useState(INITIAL_LAWN_CONFIG.defaultSqm);
  const [userLogs, setUserLogs] = useState(() =>
    stripStalePetLockout(
      /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {})),
      formatInputDate(new Date())
    )
  );
  const [currentSeason, setCurrentSeason] = useState(() => {
    const logs = stripStalePetLockout(
      /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {})),
      formatInputDate(new Date())
    );
    return getWorkflowSeasonForDate(formatInputDate(new Date()), logs);
  });
  const [seasonManuallySelected, setSeasonManuallySelected] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState('BIRCHMEIER');
  const [selectedSprinkler, setSelectedSprinkler] = useState(() => {
    const saved = localStorage.getItem('lawnPackSelectedSprinkler');
    return saved && SPRINKLER_OPTIONS[saved] ? saved : 'OSCILLATING';
  });
  const [mowerModel, setMowerModel] = useState(() => {
    const saved = localStorage.getItem('lawnPackMowerModel');
    return saved && MOWER_OPTIONS[saved] ? saved : 'RYOBI_33';
  });
  const [lawnSurface, setLawnSurface] = useState(() => {
    const saved = localStorage.getItem('lawnPackLawnSurface');
    return saved && LAWN_SURFACE_OPTIONS[saved] ? saved : 'UNEVEN';
  });
  const [weatherLocation, setWeatherLocation] = useState(() => readStoredWeatherLocation());
  const [postcodeInput, setPostcodeInput] = useState(
    () => readStoredWeatherLocation().postcode
  );
  const [weatherLocationError, setWeatherLocationError] = useState(
    /** @type {string | null} */ (null)
  );
  const [weatherLocationSaving, setWeatherLocationSaving] = useState(false);
  const [activeScreen, setActiveScreen] = useState('main');
  const [showLevellingGuide, setShowLevellingGuide] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [lawnTasksSnapshot, setLawnTasksSnapshot] = useState(
    /** @type {Array<{ id: string, title: string, dueDate: string, status: string, module: 'lawn' }>} */ ([])
  );
  const [supabaseSyncError, setSupabaseSyncError] = useState(
    /** @type {string | null} */ (null)
  );
  const [maintenanceHydrated, setMaintenanceHydrated] = useState(false);
  const [userLogsHydrated, setUserLogsHydrated] = useState(false);
  const userLogsSaveTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const [maintenanceHints, setMaintenanceHints] = useState(
    /** @type {{ mow: string | null, water: string | null }} */ ({ mow: null, water: null })
  );
  const syncInFlightRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');
  const weatherReadyRef = useRef(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState(
    /** @type {'idle' | 'pulling' | 'pushing' | 'synced' | 'error'} */ ('idle')
  );
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState(/** @type {Date | null} */ (null));

  const [pendingDates, setPendingDates] = useState(() =>
    /** @type {Record<string, Record<string, string>>} */ (
      createInitialPendingDates(
        null,
        /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {}))
      )
    )
  );
  const [lastMowedDate, setLastMowedDate] = useState(() =>
    localStorage.getItem('lawnPackLastMowedDate')
  );
  const [lastWateredDate, setLastWateredDate] = useState(() =>
    localStorage.getItem('lawnPackLastWateredDate')
  );
  const [pendingMowLogDate, setPendingMowLogDate] = useState(() => formatInputDate(new Date()));
  const [pendingWaterLogDate, setPendingWaterLogDate] = useState(() => formatInputDate(new Date()));
  const [pendingGypsumLogDate, setPendingGypsumLogDate] = useState(() => formatInputDate(new Date()));

  const [isRainForecasted, setIsRainForecasted] = useState(false);
  const [forecastedRainSum, setForecastedRainSum] = useState(0);
  const [forecastedRainSumNearTerm, setForecastedRainSumNearTerm] = useState(0);
  const [recentPastRainSum, setRecentPastRainSum] = useState(0);
  const [netWaterNeeded, setNetWaterNeeded] = useState(0);
  const [isNatureProvidingFullSoak, setIsNatureProvidingFullSoak] = useState(false);
  const [soilRecentlyWet, setSoilRecentlyWet] = useState(false);
  const [currentSoilTemp, setCurrentSoilTemp] = useState(
    /** @type {number | null} */ (null)
  );
  const [currentSoilTempMin, setCurrentSoilTempMin] = useState(
    /** @type {number | null} */ (null)
  );
  const [weatherStatus, setWeatherStatus] = useState('loading');
  const [enlargedSprinkler, setEnlargedSprinkler] = useState(
    /** @type {{ image: string, name: string } | null} */ (null)
  );

  const activeEquipment = EQUIPMENT_OPTIONS[selectedEquipment];
  const activeSprinkler = SPRINKLER_OPTIONS[selectedSprinkler];
  const dynamicMinutes = Math.round(
    (netWaterNeeded / SPRINKLER_OPTIONS[selectedSprinkler].ratePerHour) * 60
  );
  const activeSeason = SEASONS[currentSeason];
  const today = startOfDay(new Date());
  const todayStr = formatInputDate(today);
  const calendarSeason = getCalendarSeasonForDate(todayStr);
  const workflowSeason = getWorkflowSeasonForDate(todayStr, userLogs);
  const isCatchUpMode = workflowSeason !== calendarSeason;
  const incompleteSpringSteps = getIncompleteSeasonSteps('SPRING', userLogs);
  const springPackIncomplete = incompleteSpringSteps.length > 0;
  const springRenovationPending = incompleteSpringSteps.some((step) =>
    ['prep', 'seed'].includes(step.id)
  );

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const daysSinceSeed = springSeedDate ? daysBetween(springSeedDate, today) : null;
  const seedEstablishmentActive =
    springSeedDate !== null && daysSinceSeed !== null && daysSinceSeed < SEED_ESTABLISHMENT_DAYS;
  const seedDaysRemaining = seedEstablishmentActive
    ? SEED_ESTABLISHMENT_DAYS - (daysSinceSeed ?? 0)
    : 0;

  const weedolLoggedDate = userLogs[makeStepKey('SPRING', 'weedol')] ?? null;
  const weedolDaysElapsed = weedolLoggedDate ? daysBetween(weedolLoggedDate, today) : 0;
  const weedolDaysRemaining = weedolLoggedDate
    ? Math.max(0, WEEDOL_BARRIER_DAYS - weedolDaysElapsed)
    : 0;
  const weedolBarrierActive =
    weedolLoggedDate !== null && weedolDaysElapsed < WEEDOL_BARRIER_DAYS;

  const weedolClearanceDate = weedolLoggedDate
    ? addDaysToDateString(weedolLoggedDate, WEEDOL_BARRIER_DAYS)
    : null;

  const daysSinceMow = lastMowedDate ? daysBetween(lastMowedDate, today) : null;
  const daysSinceWater = lastWateredDate ? daysBetween(lastWateredDate, today) : null;

  const lastGypsumDate = userLogs[GYPSUM_LOG_KEY] ?? null;
  const petLockoutUntil = userLogs[PET_LOCKOUT_KEY] ?? null;
  const petLockoutUntilMs = petLockoutUntil ? new Date(petLockoutUntil).getTime() : null;
  const chemicalAppliedToday = hasChemicalApplicationToday(userLogs, todayStr);
  const petLockoutActive =
    chemicalAppliedToday &&
    petLockoutUntilMs !== null &&
    !Number.isNaN(petLockoutUntilMs) &&
    petLockoutUntilMs > Date.now();
  const petLockoutHoursRemaining = petLockoutActive
    ? Math.max(1, Math.ceil((petLockoutUntilMs - Date.now()) / MS_PER_HOUR))
    : 0;
  const gypsumPostponedUntil = userLogs[GYPSUM_POSTPONE_KEY] ?? null;
  const gypsumSchedule = getGypsumSchedule(lastGypsumDate, gypsumPostponedUntil, todayStr);
  const {
    gypsumDue,
    gypsumDaysRemaining,
    snoozed: gypsumSnoozed,
    dueDate: gypsumDueDate,
    naturalDue: gypsumNaturalDue,
  } = gypsumSchedule;
  const daysSinceGypsum = lastGypsumDate ? daysBetween(lastGypsumDate, today) : null;

  const soilTempMinForCheck = currentSoilTempMin ?? currentSoilTemp;
  const soilTempMaxForCheck = currentSoilTemp ?? currentSoilTempMin;

  const isSoilTooColdForSeed =
    soilTempMinForCheck !== null &&
    soilTempMinForCheck < SEED_GERMINATION_SOIL_TEMP_MIN_C;
  const isSoilTooHotForSeed =
    soilTempMaxForCheck !== null &&
    soilTempMaxForCheck > SEED_GERMINATION_SOIL_TEMP_MAX_C;
  const isSoilPrimeForSeed =
    soilTempMinForCheck !== null &&
    soilTempMaxForCheck !== null &&
    !isSoilTooColdForSeed &&
    !isSoilTooHotForSeed;

  const mowingWeatherAdvisory = getMowingWeatherAdvisory(
    forecastedRainSumNearTerm,
    recentPastRainSum
  );
  const scheduleReason = getScheduleReason({
    forecastedRainSumNearTerm,
    forecastedRainSumWeek: forecastedRainSum,
    recentPastRainSum,
    currentSoilTemp,
    springSeedDate,
    seedEstablishmentActive,
    todayStr,
  });

  const maintenanceSchedule = buildMaintenanceSchedule({
    todayStr,
    userLogs,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
  });

  const isDormantSeason = maintenanceSchedule.isDormantSeason;
  const dynamicMowingDays = maintenanceSchedule.dynamicMowingDays;
  const dynamicWateringDays = maintenanceSchedule.dynamicWateringDays;
  const mowingNextDueIso = maintenanceSchedule.mowingNextDueIso;
  const wateringNextDueIso = maintenanceSchedule.wateringNextDueIso;
  const mowingLockedUntilIso = maintenanceSchedule.mowingLockedUntilIso;

  const mowingNextDate = formatNextDueDate(lastMowedDate, dynamicMowingDays);
  const wateringNextDate = formatNextDueDate(lastWateredDate, dynamicWateringDays);
  const seedLockEndDate = formatNextDueDate(springSeedDate, SEED_ESTABLISHMENT_DAYS);

  const activeSeasonStep =
    activeSeason.steps.find((step) => !userLogs[makeStepKey(currentSeason, step.id)]) ?? null;
  const isOnScarificationPrepStep =
    currentSeason === 'AUTUMN' && activeSeasonStep?.id === 'prep';

  let recommendedSetting =
    'Height: Setting 3 (45mm) - Standard safe maintenance cut to prevent scalping';
  if (isDormantSeason) {
    recommendedSetting = 'Height: N/A - Growth Dormant';
  } else if (currentSeason === 'SPRING' && seedEstablishmentActive) {
    recommendedSetting = 'Height: 🚫 LOCKED - Do not mow fresh seed';
  } else if (isOnScarificationPrepStep) {
    recommendedSetting = 'Height: Setting 1 (25mm) - Scalp for renovation';
  } else if (currentSoilTemp !== null && currentSoilTemp >= 22) {
    recommendedSetting =
      lawnSurface === 'FLAT'
        ? 'Height: Setting 3 (45mm) - Hot spell: leave slightly longer to reduce stress'
        : 'Height: Setting 4 (50mm) - Hot spell: leave longer on uneven turf';
  } else if (lawnSurface === 'FLAT') {
    recommendedSetting = 'Height: Setting 2 (35mm) - Standard low maintenance cut';
  } else if (lawnSurface === 'UNEVEN') {
    recommendedSetting =
      'Height: Setting 3 (45mm) - Standard safe maintenance cut to prevent scalping';
  }

  const maintenanceDueDates = {
    mowingNextDue: mowingNextDueIso,
    mowingLockedUntil: mowingLockedUntilIso,
    mowingIntervalDays: dynamicMowingDays,
    wateringNextDue: wateringNextDueIso,
    wateringIntervalDays: dynamicWateringDays,
    wateringMinutes: dynamicMinutes,
    forecastedRainSum,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    netWaterNeeded,
    currentSoilTemp,
    lastGypsumDate,
    gypsumDaysRemaining,
    gypsumDue,
    mowerModel,
    lawnSurface,
    recommendedSetting,
    mowingStatus: isDormantSeason ? 'dormant' : seedEstablishmentActive ? 'locked' : 'active',
    wateringStatus: isDormantSeason
      ? 'dormant'
      : isNatureProvidingFullSoak
        ? 'paused'
        : 'active',
    scheduleReason,
  };
  const mowingDue =
    !isDormantSeason &&
    !seedEstablishmentActive &&
    (daysSinceMow === null || daysSinceMow >= dynamicMowingDays);
  const wateringDue =
    !isDormantSeason &&
    !isNatureProvidingFullSoak &&
    !soilRecentlyWet &&
    (daysSinceWater === null || daysSinceWater >= dynamicWateringDays);

  const summerGranularRepeat = getGranularRepeatDate('SUMMER', userLogs);
  const granularRepeatDue =
    summerGranularRepeat !== null &&
    daysBetween(summerGranularRepeat, todayStr) >= 0;

  const recascadeSeason = useCallback(
    (seasonKey, anchorDate, logs) => {
      setPendingDates((prev) => ({
        ...prev,
        [seasonKey]: cascadeSeasonDates(seasonKey, anchorDate, logs, prev),
      }));
    },
    []
  );

  const compileLawnTasksExport = useCallback(
    (overrides = {}) => {
      const nextLastMowedDate =
        overrides.lastMowedDate !== undefined ? overrides.lastMowedDate : lastMowedDate;
      const nextLastWateredDate =
        overrides.lastWateredDate !== undefined ? overrides.lastWateredDate : lastWateredDate;
      const nextLastGypsumDate =
        overrides.lastGypsumDate !== undefined ? overrides.lastGypsumDate : lastGypsumDate;
      const nextGypsumPostponedUntil =
        overrides.gypsumPostponedUntil !== undefined
          ? overrides.gypsumPostponedUntil
          : userLogs[GYPSUM_POSTPONE_KEY] ?? null;

      const nextRainNear =
        overrides.forecastedRainSumNearTerm ?? forecastedRainSumNearTerm;
      const nextPastRain = overrides.recentPastRainSum ?? recentPastRainSum;
      const nextSoilTemp =
        overrides.currentSoilTemp !== undefined ? overrides.currentSoilTemp : currentSoilTemp;
      const nextFullSoak =
        overrides.isNatureProvidingFullSoak ?? isNatureProvidingFullSoak;

      const maintenance = buildMaintenanceSchedule({
        todayStr,
        userLogs,
        forecastedRainSumNearTerm: nextRainNear,
        recentPastRainSum: nextPastRain,
        currentSoilTemp: nextSoilTemp,
        isNatureProvidingFullSoak: nextFullSoak,
        lastMowedDate: nextLastMowedDate,
        lastWateredDate: nextLastWateredDate,
      });

      return compileAllLawnTasks({
        todayStr,
        userLogs,
        pendingDates,
        isDormantSeason: maintenance.isDormantSeason,
        isNatureProvidingFullSoak: maintenance.isNatureProvidingFullSoak,
        seedEstablishmentActive: maintenance.seedEstablishmentActive,
        mowingLockedUntilIso: maintenance.mowingLockedUntilIso,
        mowingNextDueIso: maintenance.mowingNextDueIso,
        wateringNextDueIso: maintenance.wateringNextDueIso,
        lastGypsumDate: nextLastGypsumDate,
        gypsumPostponedUntil: nextGypsumPostponedUntil,
        scheduleReason,
      });
    },
    [
      lastMowedDate,
      lastWateredDate,
      lastGypsumDate,
      todayStr,
      userLogs,
      pendingDates,
      forecastedRainSumNearTerm,
      recentPastRainSum,
      currentSoilTemp,
      isNatureProvidingFullSoak,
      scheduleReason,
    ]
  );

  const pushLawnTasksToSupabase = useCallback(
    async (overrides = {}, options = {}) => {
      const { quiet = true, force = false, allowBeforeWeather = false } = options;

      if (!allowBeforeWeather && !weatherReadyRef.current) {
        return;
      }

      const compiledTasks = compileLawnTasksExport(overrides);
      const fingerprint = JSON.stringify(compiledTasks);

      if (
        !force &&
        (syncInFlightRef.current || fingerprint === lastSyncFingerprintRef.current)
      ) {
        setLawnTasksSnapshot(compiledTasks);
        return;
      }

      syncInFlightRef.current = true;
      setLawnTasksSnapshot(compiledTasks);
      if (!quiet) {
        setCloudSyncStatus('pushing');
      }

      try {
        const syncedMow =
          overrides.lastMowedDate !== undefined ? overrides.lastMowedDate : lastMowedDate;
        const syncedWater =
          overrides.lastWateredDate !== undefined ? overrides.lastWateredDate : lastWateredDate;

        await syncLawnTasksToSupabase(
          compiledTasks,
          {
            lastMowedDate: syncedMow,
            lastWateredDate: syncedWater,
          },
          todayStr
        );

        try {
          await saveLawnScheduleSnapshot(
            {
              lastMowedDate: syncedMow,
              lastWateredDate: syncedWater,
              mowingNextDueIso: mowingNextDueIso ?? null,
              wateringNextDueIso: wateringNextDueIso ?? null,
              forecastedRainSum,
              forecastedRainSumNearTerm,
              recentPastRainSum,
              weatherLocation,
              currentSoilTemp: currentSoilTemp ?? null,
              isNatureProvidingFullSoak,
              pendingDates,
            },
            userLogs
          );
          await saveLawnWeatherSnapshot({
            forecastedRainSum,
            forecastedRainSumNearTerm,
            recentPastRainSum,
            rainCreditMm: computeWateringRainContext(recentPastRainSum, forecastedRainSumNearTerm)
              .rainCreditMm,
            currentSoilTemp: currentSoilTemp ?? null,
            currentSoilTempMin: currentSoilTempMin ?? null,
            isRainForecasted,
            isNatureProvidingFullSoak,
            soilRecentlyWet,
            netWaterNeeded,
            fetchedAt: new Date().toISOString(),
            source: 'open-meteo',
          });
        } catch (snapshotError) {
          console.warn('[Lawn Care] Schedule snapshot save failed:', snapshotError);
        }

        lastSyncFingerprintRef.current = fingerprint;
        setSupabaseSyncError(null);
        setLastCloudSyncAt(new Date());
        setCloudSyncStatus('synced');
        setMaintenanceHints({ mow: null, water: null });
      } catch (error) {
        console.error('[Lawn Care] Supabase sync failed:', error);
        setCloudSyncStatus('error');
        if (isMissingLastCompletedColumnError(error)) {
          setSupabaseSyncError(getLastCompletedColumnHint());
        } else {
          setSupabaseSyncError(formatSupabaseSyncError(error));
        }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [
      compileLawnTasksExport,
      lastMowedDate,
      lastWateredDate,
      userLogs,
      pendingDates,
      forecastedRainSum,
      forecastedRainSumNearTerm,
      weatherLocation,
      currentSoilTemp,
      isNatureProvidingFullSoak,
    ]
  );

  const pullCloudState = useCallback(async () => {
    if (getSupabaseConfigError()) return null;

    const supabase = getSupabase();
    if (supabase) {
      const linked = await probeLastCompletedColumn(supabase);
      if (!linked) {
        setSupabaseSyncError(getLastCompletedColumnHint());
      }
    }

    let nextUserLogs = stripStalePetLockout(readStoredJson('lawnPackUserLogs', {}), todayStr);
    let nextMow = localStorage.getItem('lawnPackLastMowedDate');
    let nextWater = localStorage.getItem('lawnPackLastWateredDate');
    let inboundPack = 0;
    let inboundMaintenance = false;

    try {
      const remote = await fetchLawnUserLogsFromSupabase();
      if (remote !== null) {
        nextUserLogs = stripStalePetLockout(mergeLawnUserLogs(remote, nextUserLogs), todayStr);
      } else {
        setSupabaseSyncError((prev) => prev ?? getLawnAppStateSetupHint());
      }
    } catch (error) {
      console.warn('[Lawn Care] Lawn pack state pull failed:', error);
    }

    try {
      const appState = await fetchLawnAppStateFromSupabase();
      const cloudLocation = parseWeatherLocation(appState?.scheduleSnapshot?.weatherLocation);
      if (cloudLocation) {
        const merged = mergeWeatherLocation(readStoredWeatherLocation(), cloudLocation);
        setWeatherLocation(merged);
        setPostcodeInput(merged.postcode ?? '');
        persistWeatherLocation(merged);
      }
    } catch (error) {
      console.warn('[Lawn Care] Weather location pull failed:', error);
    }

    try {
      const rows = await fetchLawnTasksForInboundSync();
      const inbound = applyInboundTaskCompletions(rows, todayStr, nextUserLogs, {
        lastMowedDate: nextMow,
        lastWateredDate: nextWater,
      });
      nextUserLogs = stripStalePetLockout(inbound.userLogs, todayStr);
      nextMow = inbound.lastMowedDate ?? nextMow;
      nextWater = inbound.lastWateredDate ?? nextWater;
      inboundPack = inbound.packStepsUpdated;
      inboundMaintenance = inbound.maintenanceUpdated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Lawn Care] Task inbound pull failed:', error);
      if (!isMissingLastCompletedColumnError(error)) {
        setSupabaseSyncError(`Could not load tasks from shared database: ${message}`);
      }
    }

    try {
      const inferred = await pullMaintenanceDatesFromSupabase(todayStr);
      if (inferred.lastMowedDate) {
        nextMow = mergeMaintenanceDate(nextMow, inferred.lastMowedDate);
        inboundMaintenance = true;
      }
      if (inferred.lastWateredDate) {
        nextWater = mergeMaintenanceDate(nextWater, inferred.lastWateredDate);
        inboundMaintenance = true;
      }

      if (inboundMaintenance) {
        setMaintenanceHints({
          mow: nextMow ? `Last mow updated from shared log (${formatDisplayDate(nextMow)}).` : null,
          water: nextWater
            ? `Last water updated from shared log (${formatDisplayDate(nextWater)}).`
            : null,
        });
      } else {
        setMaintenanceHints({ mow: null, water: null });
      }
    } catch (error) {
      console.warn('[Lawn Care] Maintenance pull failed:', error);
    }

    setUserLogs(nextUserLogs);
    localStorage.setItem('lawnPackUserLogs', JSON.stringify(nextUserLogs));
    if (nextMow) setLastMowedDate(nextMow);
    if (nextWater) setLastWateredDate(nextWater);

    try {
      await saveLawnUserLogsToSupabase(nextUserLogs);
    } catch (error) {
      console.warn('[Lawn Care] Lawn pack state save failed:', error);
    }

    const supabaseClient = getSupabase();
    if (supabaseClient && (await probeLastCompletedColumn(supabaseClient))) {
      setSupabaseSyncError((prev) =>
        prev?.includes('maintenance_link.sql') || prev?.includes('lawn_app_state.sql')
          ? prev
          : null
      );
    }

    return { inboundPack, inboundMaintenance };
  }, [todayStr]);

  const applyWeatherSnapshot = useCallback((snapshot) => {
    const nearTerm = getEffectiveNearTermRain(snapshot);
    const pastRain = getEffectiveRecentPastRain(snapshot);
    const watering =
      typeof snapshot.netWaterNeeded === 'number' &&
      typeof snapshot.isNatureProvidingFullSoak === 'boolean'
        ? {
            netWaterNeeded: snapshot.netWaterNeeded,
            isNatureProvidingFullSoak: snapshot.isNatureProvidingFullSoak,
            soilRecentlyWet: snapshot.soilRecentlyWet ?? pastRain >= 5,
          }
        : computeWateringRainContext(pastRain, nearTerm);

    setForecastedRainSum(snapshot.forecastedRainSum);
    setForecastedRainSumNearTerm(nearTerm);
    setRecentPastRainSum(pastRain);
    setNetWaterNeeded(watering.netWaterNeeded);
    setIsNatureProvidingFullSoak(watering.isNatureProvidingFullSoak);
    setSoilRecentlyWet(watering.soilRecentlyWet);
    setCurrentSoilTemp(snapshot.currentSoilTemp);
    setCurrentSoilTempMin(snapshot.currentSoilTempMin);
    setIsRainForecasted(snapshot.isRainForecasted);
    setWeatherStatus('ready');
    weatherReadyRef.current = true;
  }, []);

  const runFullCloudSync = useCallback(
    async (options = {}) => {
      const { forcePush = true } = options;
      if (getSupabaseConfigError()) {
        setCloudSyncStatus('error');
        return;
      }

      setCloudSyncStatus('pulling');
      try {
        await pullCloudState();

        if (forcePush) {
          let weatherOverrides = null;

          try {
            const snapshot = await fetchLawnWeatherFromOpenMeteo(weatherLocation);
            const nearTerm = getEffectiveNearTermRain(snapshot);
            const pastRain = getEffectiveRecentPastRain(snapshot);
            const watering = computeWateringRainContext(pastRain, nearTerm);
            weatherOverrides = {
              forecastedRainSumNearTerm: nearTerm,
              recentPastRainSum: pastRain,
              currentSoilTemp: snapshot.currentSoilTemp,
              isNatureProvidingFullSoak: watering.isNatureProvidingFullSoak,
            };
            applyWeatherSnapshot(snapshot);
            try {
              await saveLawnWeatherSnapshot(snapshot);
            } catch (saveError) {
              console.warn('[Lawn Care] Weather snapshot save failed:', saveError);
            }
          } catch (fetchError) {
            console.warn('[Lawn Care] Live weather fetch failed during sync:', fetchError);
            if (!weatherReadyRef.current) {
              try {
                const cached = await fetchLawnWeatherSnapshotFromSupabase();
                if (cached) {
                  applyWeatherSnapshot(cached);
                }
              } catch {
                /* use whatever weather state we already have */
              }
            }
          }

          lastSyncFingerprintRef.current = '';
          await pushLawnTasksToSupabase(weatherOverrides ?? {}, {
            quiet: false,
            force: true,
            allowBeforeWeather: weatherReadyRef.current,
          });
        } else {
          setLastCloudSyncAt(new Date());
          setCloudSyncStatus('synced');
        }
      } catch (error) {
        console.error('[Lawn Care] Cloud sync failed:', error);
        setCloudSyncStatus('error');
      }
    },
    [pullCloudState, pushLawnTasksToSupabase, applyWeatherSnapshot, weatherLocation]
  );

  const handleCopyTasksJson = async () => {
    try {
      const payload = await fetchLawnTasksFromSupabase();
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      const fallback = lawnTasksSnapshot.length > 0 ? lawnTasksSnapshot : compileLawnTasksExport();
      try {
        await navigator.clipboard.writeText(JSON.stringify(fallback, null, 2));
        setJsonCopied(true);
        setTimeout(() => setJsonCopied(false), 2000);
      } catch {
        setJsonCopied(false);
      }
    }
  };

  useEffect(() => {
    setSqm(length * width);
  }, [length, width]);

  useEffect(() => {
    if (seasonManuallySelected) return;
    setCurrentSeason(getWorkflowSeasonForDate(todayStr, userLogs));
  }, [todayStr, seasonManuallySelected, userLogs]);

  useEffect(() => {
    if (!userLogsHydrated) return;

    const sanitized = stripStalePetLockout(userLogs, todayStr);
    if (sanitized !== userLogs) {
      setUserLogs(sanitized);
      return;
    }

    localStorage.setItem('lawnPackUserLogs', JSON.stringify(userLogs));

    if (userLogsSaveTimerRef.current) {
      clearTimeout(userLogsSaveTimerRef.current);
    }

    userLogsSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        if (getSupabaseConfigError()) return;
        const saved = await saveLawnUserLogsToSupabase(userLogs);
        if (saved === false) {
          setSupabaseSyncError((prev) =>
            prev?.includes('maintenance_link.sql') ? prev : getLawnAppStateSetupHint()
          );
        }
      })();
    }, 800);

    return () => {
      if (userLogsSaveTimerRef.current) {
        clearTimeout(userLogsSaveTimerRef.current);
      }
    };
  }, [userLogs, userLogsHydrated]);

  useEffect(() => {
    if (lastMowedDate) {
      localStorage.setItem('lawnPackLastMowedDate', lastMowedDate);
    } else {
      localStorage.removeItem('lawnPackLastMowedDate');
    }
  }, [lastMowedDate]);

  useEffect(() => {
    if (lastWateredDate) {
      localStorage.setItem('lawnPackLastWateredDate', lastWateredDate);
    } else {
      localStorage.removeItem('lawnPackLastWateredDate');
    }
  }, [lastWateredDate]);

  useEffect(() => {
    if (!enlargedSprinkler) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') setEnlargedSprinkler(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enlargedSprinkler]);

  useEffect(() => {
    localStorage.setItem('lawnPackSelectedSprinkler', selectedSprinkler);
  }, [selectedSprinkler]);

  useEffect(() => {
    localStorage.setItem('lawnPackMowerModel', mowerModel);
  }, [mowerModel]);

  useEffect(() => {
    localStorage.setItem('lawnPackLawnSurface', lawnSurface);
  }, [lawnSurface]);

  useEffect(() => {
    // Render from localStorage immediately; cloud pull runs in the background.
    setUserLogsHydrated(true);
    setMaintenanceHydrated(true);

    let cancelled = false;

    async function hydrateFromSupabase() {
      try {
        const cached = await fetchLawnWeatherSnapshotFromSupabase();
        if (!cancelled && cached && isWeatherSnapshotFresh(cached.fetchedAt, 6)) {
          applyWeatherSnapshot(cached);
        }
      } catch {
        /* live weather fetch runs in a separate effect */
      }

      await pullCloudState();
      // Do not push here — wait until weather is ready so we never overwrite Supabase
      // with a schedule that ignores recent rain (which makes "Water lawn" reappear).
    }

    void hydrateFromSupabase();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runFullCloudSync();
      }
    };

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runFullCloudSync]);

  useEffect(() => {
    if (!maintenanceHydrated || !userLogsHydrated || weatherStatus !== 'ready') return;

    const timer = setTimeout(() => {
      void pushLawnTasksToSupabase({}, { quiet: true });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    maintenanceHydrated,
    userLogsHydrated,
    weatherStatus,
    lastMowedDate,
    lastWateredDate,
    lastGypsumDate,
    userLogs,
    pendingDates,
    currentSeason,
    isDormantSeason,
    isNatureProvidingFullSoak,
    seedEstablishmentActive,
    forecastedRainSum,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    soilRecentlyWet,
    netWaterNeeded,
    compileLawnTasksExport,
  ]);

  useEffect(() => {
    if (!maintenanceHydrated || !userLogsHydrated) return;

    const focusRaw = getFocusFromUrl();
    const pack = parsePackStepFocus(focusRaw);
    if (pack) {
      setCurrentSeason(pack.season);
      setSeasonManuallySelected(true);
    }
  }, [maintenanceHydrated, userLogsHydrated]);

  useEffect(() => {
    if (!maintenanceHydrated || !userLogsHydrated) return;

    const focusRaw = getFocusFromUrl();
    const pack = parsePackStepFocus(focusRaw);
    if (pack && currentSeason !== pack.season) return;

    applyLawnFocusFromUrl({ delayMs: 150, retries: 8 });
  }, [maintenanceHydrated, userLogsHydrated, currentSeason]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setWeatherStatus('loading');

      let cached = null;
      try {
        cached = await fetchLawnWeatherSnapshotFromSupabase();
        if (!cancelled && cached && isWeatherSnapshotFresh(cached.fetchedAt, 3)) {
          applyWeatherSnapshot(cached);
        }
      } catch {
        /* use live fetch below */
      }

      try {
        const snapshot = await fetchLawnWeatherFromOpenMeteo(weatherLocation);
        if (cancelled) return;

        applyWeatherSnapshot(snapshot);
        try {
          await saveLawnWeatherSnapshot(snapshot);
        } catch (saveError) {
          console.warn('[Lawn Care] Weather snapshot save failed:', saveError);
        }
      } catch (fetchError) {
        console.warn('[Lawn Care] Live weather fetch failed:', fetchError);
        if (!cancelled) {
          if (cached) {
            applyWeatherSnapshot(cached);
            setWeatherStatus('ready');
          } else {
            setWeatherStatus('error');
          }
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [applyWeatherSnapshot, weatherLocation.latitude, weatherLocation.longitude]);

  const handleSaveWeatherPostcode = async () => {
    setWeatherLocationSaving(true);
    setWeatherLocationError(null);

    try {
      const location = await lookupUkPostcode(postcodeInput);
      setWeatherLocation(location);
      setPostcodeInput(location.postcode);
      persistWeatherLocation(location);
      lastSyncFingerprintRef.current = '';
      await pushLawnTasksToSupabase({}, { quiet: true, force: true, allowBeforeWeather: true });
    } catch (error) {
      setWeatherLocationError(
        error instanceof Error ? error.message : 'Could not look up that postcode.'
      );
    } finally {
      setWeatherLocationSaving(false);
    }
  };

  const handleUseMyLocationForWeather = async () => {
    setWeatherLocationSaving(true);
    setWeatherLocationError(null);

    try {
      const coords = await getBrowserGeolocation();
      const location = await lookupNearestUkPostcode(coords.latitude, coords.longitude);
      setWeatherLocation(location);
      setPostcodeInput(location.postcode ?? '');
      persistWeatherLocation(location);
      lastSyncFingerprintRef.current = '';
      await pushLawnTasksToSupabase({}, { quiet: true, force: true, allowBeforeWeather: true });
    } catch (error) {
      setWeatherLocationError(
        error instanceof Error ? error.message : 'Could not use your location.'
      );
    } finally {
      setWeatherLocationSaving(false);
    }
  };

  const handleResetWeatherLocation = async () => {
    const location = { ...DEFAULT_WEATHER_LOCATION };
    setWeatherLocation(location);
    setPostcodeInput('');
    setWeatherLocationError(null);
    persistWeatherLocation(location);
    lastSyncFingerprintRef.current = '';
    await pushLawnTasksToSupabase({}, { quiet: true, force: true, allowBeforeWeather: true });
  };

  const handlePendingDateChange = (stepId, value) => {
    const steps = SEASONS[currentSeason].steps;
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isFirstStep = stepIndex === 0;

    setPendingDates((prev) => {
      const nextSeason = { ...prev[currentSeason], [stepId]: value };

      if (isFirstStep) {
        const cascaded = cascadeSeasonDates(currentSeason, value, userLogs, {
          ...prev,
          [currentSeason]: nextSeason,
        });
        return { ...prev, [currentSeason]: cascaded };
      }

      return { ...prev, [currentSeason]: nextSeason };
    });
  };

  const handleLogTask = (stepId) => {
    const dateValue = pendingDates[currentSeason]?.[stepId];
    if (!dateValue) return;

    const steps = SEASONS[currentSeason].steps;
    const step = steps.find((s) => s.id === stepId);
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isFirstStep = stepIndex === 0;

    const nextLogs = {
      ...userLogs,
      [makeStepKey(currentSeason, stepId)]: dateValue,
    };

    if (step && stepTriggersPetLockout(step)) {
      if (dateValue === todayStr) {
        nextLogs[PET_LOCKOUT_KEY] = new Date(
          Date.now() + PET_LOCKOUT_HOURS * MS_PER_HOUR
        ).toISOString();
      } else {
        delete nextLogs[PET_LOCKOUT_KEY];
      }
    }

    setUserLogs(nextLogs);
    lastSyncFingerprintRef.current = '';
    void pushLawnTasksToSupabase({}, { quiet: true, force: true, allowBeforeWeather: true });

    if (isFirstStep) {
      recascadeSeason(currentSeason, dateValue, nextLogs);
    } else {
      const anchor = getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);
      recascadeSeason(currentSeason, anchor, nextLogs);
    }
  };

  const handleClearLog = (stepId) => {
    const key = makeStepKey(currentSeason, stepId);
    const step = SEASONS[currentSeason].steps.find((s) => s.id === stepId);
    const nextLogs = { ...userLogs };
    delete nextLogs[key];
    setUserLogs(nextLogs);

    if (step) {
      void clearLawnTaskCompletion(step.label).then(() => {
        lastSyncFingerprintRef.current = '';
        void pushLawnTasksToSupabase({}, { quiet: true, force: true, allowBeforeWeather: true });
      });
    }

    const isFirstStep = SEASONS[currentSeason].steps[0].id === stepId;
    const anchor = isFirstStep
      ? SEASON_START_DATES[currentSeason]
      : getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);

    recascadeSeason(currentSeason, anchor, nextLogs);
  };

  const showsWeedolAdvisory = (step) =>
    currentSeason === 'SPRING' &&
    weedolLoggedDate !== null &&
    step.id !== 'weedol' &&
    !userLogs[makeStepKey('SPRING', step.id)] &&
    (weedolBarrierActive || ['prep', 'seed'].includes(step.id));

  const weedolClearanceLabel = weedolClearanceDate
    ? formatDisplayDate(weedolClearanceDate)
    : null;

  const weatherStatusText =
    weatherStatus === 'loading'
      ? 'Fetching 7-day rainfall forecast…'
      : weatherStatus === 'error'
        ? '⚠️ Forecast unavailable — tap Sync to retry'
        : isRainForecasted
          ? '🌧️ Rain Forecasted - Watering Paused'
          : '☀️ Dry Week Predicted - Timers Active';
  const weatherLocationLabel = weatherLocation.label || DEFAULT_WEATHER_LOCATION.label;

  return {
    length,
    setLength,
    width,
    setWidth,
    sqm,
    userLogs,
    setUserLogs,
    currentSeason,
    setCurrentSeason,
    seasonManuallySelected,
    setSeasonManuallySelected,
    selectedEquipment,
    setSelectedEquipment,
    selectedSprinkler,
    setSelectedSprinkler,
    mowerModel,
    setMowerModel,
    lawnSurface,
    setLawnSurface,
    weatherLocation,
    postcodeInput,
    setPostcodeInput,
    weatherLocationError,
    weatherLocationSaving,
    activeScreen,
    setActiveScreen,
    showLevellingGuide,
    setShowLevellingGuide,
    jsonCopied,
    supabaseSyncError,
    maintenanceHints,
    setMaintenanceHints,
    cloudSyncStatus,
    lastCloudSyncAt,
    pendingDates,
    lastMowedDate,
    setLastMowedDate,
    lastWateredDate,
    setLastWateredDate,
    pendingMowLogDate,
    setPendingMowLogDate,
    pendingWaterLogDate,
    setPendingWaterLogDate,
    pendingGypsumLogDate,
    setPendingGypsumLogDate,
    isRainForecasted,
    forecastedRainSum,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    soilRecentlyWet,
    currentSoilTemp,
    currentSoilTempMin,
    weatherStatus,
    enlargedSprinkler,
    setEnlargedSprinkler,
    lastSyncFingerprintRef,
    activeEquipment,
    activeSprinkler,
    netWaterNeeded,
    dynamicMinutes,
    isNatureProvidingFullSoak,
    activeSeason,
    today,
    todayStr,
    calendarSeason,
    workflowSeason,
    isCatchUpMode,
    incompleteSpringSteps,
    springPackIncomplete,
    springRenovationPending,
    springSeedDate,
    daysSinceSeed,
    seedEstablishmentActive,
    seedDaysRemaining,
    weedolLoggedDate,
    weedolDaysElapsed,
    weedolDaysRemaining,
    weedolBarrierActive,
    weedolClearanceDate,
    daysSinceMow,
    daysSinceWater,
    lastGypsumDate,
    petLockoutUntil,
    petLockoutActive,
    petLockoutHoursRemaining,
    gypsumPostponedUntil,
    gypsumDue,
    gypsumDaysRemaining,
    gypsumSnoozed,
    gypsumDueDate,
    gypsumNaturalDue,
    daysSinceGypsum,
    isSoilTooColdForSeed,
    isSoilTooHotForSeed,
    isSoilPrimeForSeed,
    isDormantSeason,
    dynamicMowingDays,
    dynamicWateringDays,
    scheduleReason,
    mowingNextDueIso,
    wateringNextDueIso,
    mowingLockedUntilIso,
    mowingNextDate,
    wateringNextDate,
    seedLockEndDate,
    activeSeasonStep,
    isOnScarificationPrepStep,
    recommendedSetting,
    maintenanceDueDates,
    mowingDue,
    mowingWeatherAdvisory,
    wateringDue,
    summerGranularRepeat,
    granularRepeatDue,
    pushLawnTasksToSupabase,
    runFullCloudSync,
    handleCopyTasksJson,
    handleSaveWeatherPostcode,
    handleUseMyLocationForWeather,
    handleResetWeatherLocation,
    handlePendingDateChange,
    handleLogTask,
    handleClearLog,
    showsWeedolAdvisory,
    weedolClearanceLabel,
    weatherStatusText,
    weatherLocationLabel,
  };
}
