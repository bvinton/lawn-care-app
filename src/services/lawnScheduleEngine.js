import { addDaysToDateString, makeStepKey } from '../data/LawnPackData.js';
import { pickLatestIsoDate } from './lawnMaintenanceSync.js';
import {
  RECENT_PAST_RAIN_DAYS,
  RECENT_RAIN_WET_SOIL_MM,
  SOAK_DEPTH_MM,
} from './lawnWeather.js';

export const SEED_ESTABLISHMENT_DAYS = 21;
/** Days after seed lock ends when mowing uses a gentler interval and height steps down gradually. */
export const SEED_RECOVERY_WINDOW_DAYS = 42;
export const SEED_RECOVERY_MOWING_DAYS = 7;
export const VERTICUT_INTERVAL_DAYS = 14;
export const VERTICUT_RENOVATION_HOLD_DAYS = 42;
export const VERTICUT_HEAT_THRESHOLD_C = 25;
export const VERTICUT_SEASON_START = '04-01';
export const VERTICUT_SEASON_END = '09-30';
export const VERTICUT_BLADE_HEIGHT_RULE =
  'Set blades 1-2mm below current mowing height (must remain above soil line).';
export const VERTICUT_MOW_PAIRING_NOTE =
  'Verticut first to lift weeds/runners, then follow up immediately with a regular mow to clean up the debris.';

export function getTodayLondon() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

export function isDormantSeasonForDate(todayStr) {
  const month = Number(todayStr.slice(5, 7));
  return month === 12 || month === 1 || month === 2;
}

/** @param {string} todayStr */
export function isVerticutSeasonForDate(todayStr) {
  const monthDay = todayStr.slice(5);
  return monthDay >= VERTICUT_SEASON_START && monthDay <= VERTICUT_SEASON_END;
}

/**
 * @param {string} todayStr
 * @param {Record<string, string>} userLogs
 */
export function getVerticutRenovationState(todayStr, userLogs) {
  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const springPrepDate = userLogs[makeStepKey('SPRING', 'prep')] ?? null;
  const renovationDate = pickLatestIsoDate(springSeedDate, springPrepDate);

  if (!renovationDate) {
    return {
      renovationDate: null,
      renovationHoldActive: false,
      verticutLockedUntilIso: null,
    };
  }

  const daysSinceRenovation = daysBetweenIso(todayStr, renovationDate);
  const renovationHoldActive = daysSinceRenovation < VERTICUT_RENOVATION_HOLD_DAYS;
  const verticutLockedUntilIso = renovationHoldActive
    ? addDaysToDateString(renovationDate, VERTICUT_RENOVATION_HOLD_DAYS)
    : null;

  return { renovationDate, renovationHoldActive, verticutLockedUntilIso };
}

/**
 * Pause verticutting during extreme heat or drought stress.
 * @param {number | null} currentSoilTemp
 * @param {number} forecastedRainSumNearTerm
 * @param {number} [recentPastRainSum]
 */
export function isVerticutHeatDroughtPaused(
  currentSoilTemp,
  forecastedRainSumNearTerm,
  recentPastRainSum = 0
) {
  if (currentSoilTemp !== null && currentSoilTemp >= VERTICUT_HEAT_THRESHOLD_C) {
    return true;
  }

  return (
    currentSoilTemp !== null &&
    currentSoilTemp >= 22 &&
    forecastedRainSumNearTerm < 2 &&
    recentPastRainSum < RECENT_RAIN_WET_SOIL_MM
  );
}

/**
 * @param {string} todayStr
 * @param {string | null} springSeedDate
 * @param {number} [establishmentExtraDays]
 */
export function getSeedState(todayStr, springSeedDate, establishmentExtraDays = 0) {
  const daysSinceSeed = springSeedDate ? daysBetweenIso(todayStr, springSeedDate) : null;
  const totalEstablishmentDays = SEED_ESTABLISHMENT_DAYS + establishmentExtraDays;
  const seedEstablishmentActive =
    springSeedDate !== null &&
    daysSinceSeed !== null &&
    daysSinceSeed <= totalEstablishmentDays;
  const mowingLockedUntilIso =
    seedEstablishmentActive && springSeedDate
      ? addDaysToDateString(springSeedDate, totalEstablishmentDays)
      : null;
  return { springSeedDate, seedEstablishmentActive, mowingLockedUntilIso };
}

function daysBetweenIso(todayStr, pastIso) {
  const start = new Date(`${pastIso}T12:00:00`);
  const end = new Date(`${todayStr}T12:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Mowing interval from growth rate (soil temperature) — not rainfall.
 * Rain only affects when it is practical to mow, not whether grass needs cutting.
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {string} todayStr
 */
export function getDynamicMowingDays(currentSoilTemp, springSeedDate, todayStr) {
  const temp = currentSoilTemp;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed > SEED_ESTABLISHMENT_DAYS && sinceSeed < SEED_RECOVERY_WINDOW_DAYS) {
      return SEED_RECOVERY_MOWING_DAYS;
    }
  }

  if (temp !== null && temp < 8) return 14;
  if (temp !== null && temp < 12) return 10;
  if (temp !== null && temp >= 15) return 5;
  return 7;
}

/**
 * Optional note when rain makes today a poor mowing window — does not change due date.
 * @param {number} forecastedRainSumNearTerm
 * @param {number} [recentPastRainSum]
 */
export function getMowingWeatherAdvisory(forecastedRainSumNearTerm, recentPastRainSum = 0) {
  if (forecastedRainSumNearTerm >= 3) {
    return `${forecastedRainSumNearTerm.toFixed(1)}mm rain forecast soon — still cut when due; pick the next dry window`;
  }
  if (recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM) {
    return 'Lawn may still be damp — mow when due and the surface is dry enough';
  }
  return null;
}

/**
 * @param {number} forecastedRainSumNearTerm
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {boolean} seedEstablishmentActive
 * @param {string} todayStr
 * @param {number} [recentPastRainSum]
 */
export function getDynamicWateringDays(
  forecastedRainSumNearTerm,
  currentSoilTemp,
  springSeedDate,
  seedEstablishmentActive,
  todayStr,
  recentPastRainSum = 0
) {
  const temp = currentSoilTemp;
  const rain = forecastedRainSumNearTerm;

  if (seedEstablishmentActive) return 1;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed > SEED_ESTABLISHMENT_DAYS && sinceSeed < SEED_RECOVERY_WINDOW_DAYS) return 2;
  }

  if (recentPastRainSum >= 8) return 5;
  if (recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM) return 4;
  if (temp !== null && temp > 20 && rain < 2) return 2;
  if (rain >= 4) return 5;
  if (rain >= 1.5) return 4;
  if (temp !== null && temp < 12) return 5;
  return 3;
}

/**
 * @param {Object} input
 * @param {number} input.forecastedRainSumNearTerm
 * @param {number} [input.forecastedRainSumWeek]
 * @param {number} [input.recentPastRainSum]
 * @param {number | null} input.currentSoilTemp
 * @param {string | null} input.springSeedDate
 * @param {boolean} input.seedEstablishmentActive
 * @param {string} input.todayStr
 * @param {Record<string, string>} [input.userLogs]
 */
export function getScheduleReason(input) {
  const {
    forecastedRainSumNearTerm,
    forecastedRainSumWeek = forecastedRainSumNearTerm,
    recentPastRainSum = 0,
    currentSoilTemp,
    springSeedDate,
    seedEstablishmentActive,
    todayStr,
    userLogs = {},
  } = input;

  const temp = currentSoilTemp;
  const rainNear = forecastedRainSumNearTerm;
  const mowReasons = [];
  const waterReasons = [];
  const verticutReasons = [];

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed > SEED_ESTABLISHMENT_DAYS && sinceSeed < SEED_RECOVERY_WINDOW_DAYS) {
      mowReasons.push(
        `${SEED_RECOVERY_MOWING_DAYS}-day recovery cuts — gradually lower height each mow`
      );
      waterReasons.push('enhanced watering during turf recovery');
    }
  }

  if (seedEstablishmentActive) {
    waterReasons.push('daily watering during seed establishment');
  }

  if (temp !== null && temp >= 15) {
    mowReasons.push(`${temp.toFixed(0)}°C soil – active growth`);
  } else if (temp !== null && temp < 10) {
    mowReasons.push(`${temp.toFixed(0)}°C soil – slower growth`);
  }

  if (recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM) {
    waterReasons.push(
      `${recentPastRainSum.toFixed(1)}mm rain in last ${RECENT_PAST_RAIN_DAYS} days – soil still damp`
    );
  } else if (rainNear >= 4) {
    waterReasons.push(`${rainNear.toFixed(1)}mm rain next 3 days – reduced need`);
  } else if (temp !== null && temp > 20 && rainNear < 2) {
    waterReasons.push(`${temp.toFixed(0)}°C soil & dry forecast – increased demand`);
  }

  if (forecastedRainSumWeek > rainNear + 5 && rainNear < SOAK_DEPTH_MM && recentPastRainSum < RECENT_RAIN_WET_SOIL_MM) {
    waterReasons.push(
      `${forecastedRainSumWeek.toFixed(0)}mm later this week – not pausing watering yet`
    );
  }

  if (!isVerticutSeasonForDate(todayStr)) {
    verticutReasons.push('outside active season (Apr 1 – Sep 30)');
  } else if (temp !== null && temp >= VERTICUT_HEAT_THRESHOLD_C) {
    verticutReasons.push(
      `${temp.toFixed(0)}°C soil – paused to protect turf from heat stress`
    );
  } else if (
    temp !== null &&
    temp >= 22 &&
    rainNear < 2 &&
    recentPastRainSum < RECENT_RAIN_WET_SOIL_MM
  ) {
    verticutReasons.push('drought-risk conditions – paused until cooler or wetter weather');
  }

  const { renovationHoldActive } = getVerticutRenovationState(todayStr, userLogs);
  if (renovationHoldActive) {
    verticutReasons.push('post-renovation hold – root system still maturing (6–8 weeks)');
  }

  return {
    mow: mowReasons.length > 0 ? mowReasons.join(', ') : null,
    water: waterReasons.length > 0 ? waterReasons.join(', ') : null,
    verticut: verticutReasons.length > 0 ? verticutReasons.join(', ') : null,
  };
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {Record<string, string>} input.userLogs
 * @param {number} input.forecastedRainSumNearTerm
 * @param {number} [input.recentPastRainSum]
 * @param {number | null} input.currentSoilTemp
 * @param {boolean} input.isNatureProvidingFullSoak - today-only full soak (not future forecast)
 * @param {boolean} [input.soilRecentlyWetToday]
 * @param {string | null} input.lastMowedDate
 * @param {string | null} input.lastWateredDate
 * @param {string | null} input.lastVerticutDate
 * @param {number} [input.establishmentExtraDays]
 */
export function buildMaintenanceSchedule(input) {
  const {
    todayStr,
    userLogs,
    forecastedRainSumNearTerm,
    recentPastRainSum = 0,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    soilRecentlyWetToday = null,
    lastMowedDate,
    lastWateredDate,
    lastVerticutDate,
    establishmentExtraDays = 0,
  } = input;

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const { seedEstablishmentActive, mowingLockedUntilIso } = getSeedState(
    todayStr,
    springSeedDate,
    establishmentExtraDays
  );
  const isDormantSeason = isDormantSeasonForDate(todayStr);

  const dynamicMowingDays = getDynamicMowingDays(currentSoilTemp, springSeedDate, todayStr);
  const dynamicWateringDays = getDynamicWateringDays(
    forecastedRainSumNearTerm,
    currentSoilTemp,
    springSeedDate,
    seedEstablishmentActive,
    todayStr,
    recentPastRainSum
  );

  // The Spring prep step (Step 2) requires scalping the lawn first, so logging it
  // counts as a mow. Use whichever date is more recent: last logged mow or scarify date.
  const springScarifyDate = userLogs[makeStepKey('SPRING', 'prep')] ?? null;
  const wasScalped =
    springScarifyDate !== null &&
    (lastMowedDate === null || springScarifyDate >= lastMowedDate);
  const effectiveLastMowedDate =
    lastMowedDate && springScarifyDate
      ? lastMowedDate > springScarifyDate ? lastMowedDate : springScarifyDate
      : lastMowedDate ?? springScarifyDate ?? null;

  // After a scalp cut the grass is much shorter than usual (setting 1 vs standard setting 3),
  // so it needs longer to recover before the next proper cut. Use at least 10 days.
  const effectiveMowingDays = wasScalped
    ? Math.max(dynamicMowingDays, 10)
    : dynamicMowingDays;

  const mowingNextDueIso = effectiveLastMowedDate
    ? addDaysToDateString(effectiveLastMowedDate, effectiveMowingDays)
    : null;

  // If rain has recently soaked the soil, treat today as the effective watering date so
  // the next-due calculation counts forward from now rather than from the last manual water.
  // Without this, when rain clears the task immediately reappears overdue.
  const soilRecentlyWet =
    typeof soilRecentlyWetToday === 'boolean'
      ? soilRecentlyWetToday
      : recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM;
  const effectiveLastWateredDate =
    !seedEstablishmentActive && (isNatureProvidingFullSoak || soilRecentlyWet)
      ? todayStr
      : lastWateredDate;
  let wateringNextDueIso = effectiveLastWateredDate
    ? addDaysToDateString(effectiveLastWateredDate, dynamicWateringDays)
    : null;

  if (wateringNextDueIso && wateringNextDueIso < todayStr) {
    wateringNextDueIso = todayStr;
  }

  const isVerticutSeason = isVerticutSeasonForDate(todayStr);
  const { renovationHoldActive, verticutLockedUntilIso } = getVerticutRenovationState(
    todayStr,
    userLogs
  );
  const verticutHeatDroughtPaused = isVerticutHeatDroughtPaused(
    currentSoilTemp,
    forecastedRainSumNearTerm,
    recentPastRainSum
  );

  const verticutNaturalNextDueIso = lastVerticutDate
    ? addDaysToDateString(lastVerticutDate, VERTICUT_INTERVAL_DAYS)
    : mowingNextDueIso;

  const verticutIntervalElapsed =
    lastVerticutDate === null ||
    daysBetweenIso(todayStr, lastVerticutDate) >= VERTICUT_INTERVAL_DAYS;

  let verticutNextDueIso = null;
  let verticutPairedWithMow = false;

  if (isVerticutSeason && !renovationHoldActive && !verticutHeatDroughtPaused) {
    if (verticutIntervalElapsed) {
      verticutNextDueIso = mowingNextDueIso ?? verticutNaturalNextDueIso ?? todayStr;
      verticutPairedWithMow = Boolean(mowingNextDueIso);
    } else if (verticutNaturalNextDueIso) {
      verticutNextDueIso = verticutNaturalNextDueIso;
    }
  }

  return {
    isDormantSeason,
    isNatureProvidingFullSoak,
    seedEstablishmentActive,
    mowingLockedUntilIso,
    mowingNextDueIso,
    wateringNextDueIso,
    dynamicMowingDays,
    dynamicWateringDays,
    isVerticutSeason,
    renovationHoldActive,
    verticutLockedUntilIso,
    verticutHeatDroughtPaused,
    verticutNextDueIso,
    verticutPairedWithMow,
    verticutIntervalElapsed,
  };
}
