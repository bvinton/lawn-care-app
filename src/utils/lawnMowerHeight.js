import { SEED_ESTABLISHMENT_DAYS } from '../data/lawnUiConfig.jsx';
import { MOWER_OPTIONS } from '../data/mowerOptions.js';

/** @deprecated Prefer getMowerHeightLabel(mowerModel, settingNumber) */
export const MOWER_SETTING_LABELS = {
  1: 'Setting 1 (25mm)',
  2: 'Setting 2 (35mm)',
  3: 'Setting 3 (45mm)',
  4: 'Setting 4 (50mm)',
};

/**
 * @param {string | undefined} mowerModel
 */
export function getMowerOption(mowerModel) {
  return MOWER_OPTIONS[mowerModel] ?? MOWER_OPTIONS.RYOBI_33;
}

/**
 * Resolve recommended cut height in mm for a care level on the selected mower.
 * @param {string | undefined} mowerModel
 * @param {number} settingNumber
 * @returns {number}
 */
export function getMowerHeightMm(mowerModel, settingNumber) {
  const mower = getMowerOption(mowerModel);
  const mapped = mower.heightBySetting?.[settingNumber];
  if (typeof mapped === 'number') {
    const min = typeof mower.minMm === 'number' ? mower.minMm : mapped;
    const max = typeof mower.maxMm === 'number' ? mower.maxMm : mapped;
    return Math.min(max, Math.max(min, mapped));
  }
  // Fallback for unknown levels: Ryobi-style defaults
  const fallback = { 1: 25, 2: 35, 3: 45, 4: 50 };
  return fallback[settingNumber] ?? 35;
}

/**
 * Human-readable height for the selected mower (settings label or mm only).
 * @param {string | undefined} mowerModel
 * @param {number} settingNumber
 */
export function getMowerHeightLabel(mowerModel, settingNumber) {
  const mower = getMowerOption(mowerModel);
  const mm = getMowerHeightMm(mowerModel, settingNumber);

  if (mower.heightMode === 'mm') {
    return `${mm}mm`;
  }

  return `Setting ${settingNumber} (${mm}mm)`;
}

/**
 * Normal maintenance height for current weather and lawn surface (not post-seed recovery).
 * Higher number = taller cut. Returns null during dormancy.
 * @param {{
 *   isDormantSeason: boolean,
 *   isOnScarificationPrepStep: boolean,
 *   currentSoilTemp: number | null,
 *   lawnSurface: string,
 *   mowerModel?: string,
 * }} input
 * @returns {number | null}
 */
export function getSeasonalMowerSettingNumber(input) {
  const { isDormantSeason, isOnScarificationPrepStep, currentSoilTemp, lawnSurface } = input;

  if (isDormantSeason) return null;
  if (isOnScarificationPrepStep) return 1;
  if (currentSoilTemp !== null && currentSoilTemp >= 22) {
    return lawnSurface === 'FLAT' ? 3 : 4;
  }
  if (lawnSurface === 'FLAT') return 2;
  return 3;
}

/**
 * @param {number} settingNumber
 * @param {string} reasonSuffix
 * @param {string | undefined} mowerModel
 */
export function formatMowerHeightRecommendation(settingNumber, reasonSuffix, mowerModel) {
  const label = getMowerHeightLabel(mowerModel, settingNumber);
  return `Height: ${label} - ${reasonSuffix}`;
}

/**
 * @param {{
 *   isDormantSeason: boolean,
 *   isOnScarificationPrepStep: boolean,
 *   currentSoilTemp: number | null,
 *   lawnSurface: string,
 *   mowerModel?: string,
 * }} input
 */
export function getSeasonalMowerHeightRecommendation(input) {
  const setting = getSeasonalMowerSettingNumber(input);
  if (setting === null) {
    return 'Height: N/A - Growth Dormant';
  }

  if (input.isOnScarificationPrepStep) {
    return formatMowerHeightRecommendation(1, 'Scalp for renovation', input.mowerModel);
  }

  if (input.currentSoilTemp !== null && input.currentSoilTemp >= 22) {
    return formatMowerHeightRecommendation(
      setting,
      input.lawnSurface === 'FLAT'
        ? 'Hot spell: leave slightly longer to reduce stress'
        : 'Hot spell: leave longer on uneven turf',
      input.mowerModel,
    );
  }

  if (input.lawnSurface === 'FLAT') {
    return formatMowerHeightRecommendation(2, 'Standard low maintenance cut', input.mowerModel);
  }

  return formatMowerHeightRecommendation(
    3,
    'Standard safe maintenance cut to prevent scalping',
    input.mowerModel,
  );
}

/**
 * Post-seed recovery height: step down each week (4 → 3 → 2) but never shorter than the
 * seasonal baseline for current weather and time of year.
 * @param {{
 *   daysSinceSeed: number,
 *   isDormantSeason: boolean,
 *   isOnScarificationPrepStep: boolean,
 *   currentSoilTemp: number | null,
 *   lawnSurface: string,
 *   mowerModel?: string,
 * }} input
 */
export function getPostSeedRecoveryMowerHeightRecommendation(input) {
  const { daysSinceSeed } = input;
  const baseline = getSeasonalMowerSettingNumber(input);
  if (baseline === null) {
    return 'Height: N/A - Growth Dormant';
  }

  const recoveryWeek = Math.ceil((daysSinceSeed - SEED_ESTABLISHMENT_DAYS) / 7);
  const targetSetting = recoveryWeek <= 1 ? 4 : recoveryWeek === 2 ? 3 : 2;
  const effectiveSetting = Math.max(targetSetting, baseline);

  let reason;
  if (effectiveSetting === baseline && targetSetting < baseline) {
    reason = 'Seasonal minimum for current conditions — do not go shorter during recovery';
  } else if (recoveryWeek <= 1) {
    reason = 'First recovery cut: leave long, then step down each week';
  } else if (effectiveSetting === baseline) {
    reason = 'At normal maintenance height for current conditions';
  } else {
    reason = 'Gradually lowering after seeding';
  }

  return formatMowerHeightRecommendation(effectiveSetting, reason, input.mowerModel);
}
