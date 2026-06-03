import { addDaysToDateString, makeStepKey } from '../data/LawnPackData.js';

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
 * @param {number} forecastedRainSum
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {string} todayStr
 */
export function getDynamicMowingDays(forecastedRainSum, currentSoilTemp, springSeedDate, todayStr) {
  const temp = currentSoilTemp;
  const rain = forecastedRainSum;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 14;
  }

  if ((temp !== null && temp < 8) || rain > 25) return 14;
  if ((temp !== null && temp < 12) || rain > 15) return 10;
  if (temp !== null && temp > 18 && rain < 5) return 5;
  return 7;
}

/**
 * @param {number} forecastedRainSum
 * @param {number | null} currentSoilTemp
 * @param {string | null} springSeedDate
 * @param {boolean} seedEstablishmentActive
 * @param {string} todayStr
 */
export function getDynamicWateringDays(
  forecastedRainSum,
  currentSoilTemp,
  springSeedDate,
  seedEstablishmentActive,
  todayStr
) {
  const temp = currentSoilTemp;
  const rain = forecastedRainSum;

  if (seedEstablishmentActive) return 1;

  if (springSeedDate) {
    const sinceSeed = daysBetweenIso(todayStr, springSeedDate);
    if (sinceSeed >= SEED_ESTABLISHMENT_DAYS && sinceSeed < 42) return 2;
  }

  if (temp !== null && temp > 20 && rain < 2) return 2;
  if (rain >= 5) return 5;
  if (rain >= 2) return 4;
  if (temp !== null && temp < 12) return 5;
  return 3;
}

/**
 * @param {Object} input
 * @param {string} input.todayStr
 * @param {Record<string, string>} input.userLogs
 * @param {number} input.forecastedRainSum
 * @param {number | null} input.currentSoilTemp
 * @param {boolean} input.isNatureProvidingFullSoak
 * @param {string | null} input.lastMowedDate
 * @param {string | null} input.lastWateredDate
 */
export function buildMaintenanceSchedule(input) {
  const {
    todayStr,
    userLogs,
    forecastedRainSum,
    currentSoilTemp,
    isNatureProvidingFullSoak,
    lastMowedDate,
    lastWateredDate,
  } = input;

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const { seedEstablishmentActive, mowingLockedUntilIso } = getSeedState(todayStr, springSeedDate);
  const isDormantSeason = isDormantSeasonForDate(todayStr);

  const dynamicMowingDays = getDynamicMowingDays(
    forecastedRainSum,
    currentSoilTemp,
    springSeedDate,
    todayStr
  );
  const dynamicWateringDays = getDynamicWateringDays(
    forecastedRainSum,
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
