import { addDaysToDateString, makeStepKey } from '../data/LawnPackData.js';
import {
  RECENT_PAST_RAIN_DAYS,
  RECENT_RAIN_WET_SOIL_MM,
  SOAK_DEPTH_MM,
} from './lawnWeather.js';

export const SEED_ESTABLISHMENT_DAYS = 21;

export function getTodayLondon() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

export function isDormantSeasonForDate(todayStr) {
  const month = Number(todayStr.slice(5, 7));
  return month === 12 || month === 1 || month === 2;
}

/**
 * @param {string} todayStr
 * @param {string | null} springSeedDate
 */
export function getSeedState(todayStr, springSeedDate) {
  const daysSinceSeed = springSeedDate ? daysBetweenIso(todayStr, springSeedDate) : null;
  const seedEstablishmentActive =
    springSeedDate !== null && daysSinceSeed !== null && daysSinceSeed < SEED_ESTABLISHMENT_DAYS;
  const mowingLockedUntilIso =
    seedEstablishmentActive && springSeedDate
      ? addDaysToDateString(springSeedDate, SEED_ESTABLISHMENT_DAYS)
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
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 14;
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
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 2;
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
  } = input;

  const temp = currentSoilTemp;
  const rainNear = forecastedRainSumNearTerm;
  const mowReasons = [];
  const waterReasons = [];

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) {
      mowReasons.push('gentle recovery schedule after seeding');
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

  return {
    mow: mowReasons.length > 0 ? mowReasons.join(', ') : null,
    water: waterReasons.length > 0 ? waterReasons.join(', ') : null,
  };
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {Record<string, string>} input.userLogs
 * @param {number} input.forecastedRainSumNearTerm
 * @param {number} [input.recentPastRainSum]
 * @param {number | null} input.currentSoilTemp
 * @param {boolean} input.isNatureProvidingFullSoak
 * @param {string | null} input.lastMowedDate
 * @param {string | null} input.lastWateredDate
 */
export function buildMaintenanceSchedule(input) {
  const {
    todayStr,
    userLogs,
    forecastedRainSumNearTerm,
    recentPastRainSum = 0,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
  } = input;

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const { seedEstablishmentActive, mowingLockedUntilIso } = getSeedState(todayStr, springSeedDate);
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

  const mowingNextDueIso = lastMowedDate
    ? addDaysToDateString(lastMowedDate, dynamicMowingDays)
    : null;

  // If rain has recently soaked the soil, treat today as the effective watering date so
  // the next-due calculation counts forward from now rather than from the last manual water.
  // Without this, when rain clears the task immediately reappears overdue.
  const soilRecentlyWet = recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM;
  const effectiveLastWateredDate =
    (isNatureProvidingFullSoak || soilRecentlyWet) ? todayStr : lastWateredDate;
  const wateringNextDueIso = effectiveLastWateredDate
    ? addDaysToDateString(effectiveLastWateredDate, dynamicWateringDays)
    : null;

  return {
    isDormantSeason,
    isNatureProvidingFullSoak,
    seedEstablishmentActive,
    mowingLockedUntilIso,
    mowingNextDueIso,
    wateringNextDueIso,
    dynamicMowingDays,
    dynamicWateringDays,
  };
}
