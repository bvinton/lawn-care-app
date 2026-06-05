import { addDaysToDateString, makeStepKey } from '../data/LawnPackData.js';
import { SOAK_DEPTH_MM } from './lawnWeather.js';

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
 * Mowing interval from near-term rain (next few days) and soil temperature.
 * @param {number} forecastedRainSumNearTerm
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {string} todayStr
 */
export function getDynamicMowingDays(
  forecastedRainSumNearTerm,
  currentSoilTemp,
  springSeedDate,
  todayStr
) {
  const temp = currentSoilTemp;
  const rain = forecastedRainSumNearTerm;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 14;
  }

  if ((temp !== null && temp < 8) || rain > 8) return 14;
  if ((temp !== null && temp < 12) || rain > 5) return 10;
  if (temp !== null && temp >= 15 && rain < 3) return 5;
  return 7;
}

/**
 * @param {number} forecastedRainSumNearTerm
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {boolean} seedEstablishmentActive
 * @param {string} todayStr
 */
export function getDynamicWateringDays(
  forecastedRainSumNearTerm,
  currentSoilTemp,
  springSeedDate,
  seedEstablishmentActive,
  todayStr
) {
  const temp = currentSoilTemp;
  const rain = forecastedRainSumNearTerm;

  if (seedEstablishmentActive) return 1;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 2;
  }

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
 * @param {number | null} input.currentSoilTemp
 * @param {string | null} input.springSeedDate
 * @param {boolean} input.seedEstablishmentActive
 * @param {string} input.todayStr
 */
export function getScheduleReason(input) {
  const {
    forecastedRainSumNearTerm,
    forecastedRainSumWeek = forecastedRainSumNearTerm,
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

  if (temp !== null && temp >= 15 && rainNear < 3) {
    mowReasons.push(`${temp.toFixed(0)}°C soil + dry next few days – fast growth`);
  } else if (temp !== null && temp < 10) {
    mowReasons.push(`${temp.toFixed(0)}°C soil – slower growth`);
  } else if (rainNear > 5) {
    mowReasons.push(`${rainNear.toFixed(1)}mm rain next 3 days – wet lawn, slower cut`);
  }

  if (rainNear >= 4) {
    waterReasons.push(`${rainNear.toFixed(1)}mm rain next 3 days – reduced need`);
  } else if (temp !== null && temp > 20 && rainNear < 2) {
    waterReasons.push(`${temp.toFixed(0)}°C soil & dry forecast – increased demand`);
  }

  if (forecastedRainSumWeek > rainNear + 5 && rainNear < SOAK_DEPTH_MM) {
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
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
  } = input;

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const { seedEstablishmentActive, mowingLockedUntilIso } = getSeedState(todayStr, springSeedDate);
  const isDormantSeason = isDormantSeasonForDate(todayStr);

  const dynamicMowingDays = getDynamicMowingDays(
    forecastedRainSumNearTerm,
    currentSoilTemp,
    springSeedDate,
    todayStr
  );
  const dynamicWateringDays = getDynamicWateringDays(
    forecastedRainSumNearTerm,
    currentSoilTemp,
    springSeedDate,
    seedEstablishmentActive,
    todayStr
  );

  const mowingNextDueIso = lastMowedDate
    ? addDaysToDateString(lastMowedDate, dynamicMowingDays)
    : null;
  const wateringNextDueIso = lastWateredDate
    ? addDaysToDateString(lastWateredDate, dynamicWateringDays)
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
