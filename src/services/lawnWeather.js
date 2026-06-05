import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { resolveWeatherLocation } from './lawnLocation.js';

const LAWN_STATE_ID = 'default';

export const FORECAST_RAIN_DAYS = 7;

/**
 * @param {number} latitude
 * @param {number} longitude
 */
export function buildOpenMeteoForecastUrl(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'precipitation_sum',
    hourly: 'soil_temperature_6cm',
    timezone: 'Europe/London',
    past_days: String(PAST_RAIN_DAYS),
    forecast_days: String(FORECAST_RAIN_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export const SOAK_DEPTH_MM = 10;
export const RAIN_THRESHOLD_MM = 5;
/** Rain in the next few days drives forward-looking adjustments. */
export const NEAR_TERM_RAIN_DAYS = 3;
/** Observed rain history from Open-Meteo. */
export const PAST_RAIN_DAYS = 7;
/** Recent past days that still keep the soil damp for soak / due decisions. */
export const RECENT_PAST_RAIN_DAYS = 3;
export const RECENT_RAIN_WET_SOIL_MM = 5;

/**
 * @typedef {Object} LawnWeatherSnapshot
 * @property {number} forecastedRainSum
 * @property {number} forecastedRainSumNearTerm
 * @property {number} recentPastRainSum
 * @property {number} rainCreditMm
 * @property {number | null} currentSoilTemp
 * @property {number | null} currentSoilTempMin
 * @property {boolean} isRainForecasted
 * @property {boolean} isNatureProvidingFullSoak
 * @property {boolean} soilRecentlyWet
 * @property {number} netWaterNeeded
 * @property {string} fetchedAt
 * @property {'open-meteo'} source
 */

/**
 * @param {Array<number | null> | undefined} precipitationTotals
 * @param {number} [days]
 */
export function sumPrecipitation(precipitationTotals, days = 7) {
  if (!Array.isArray(precipitationTotals)) return 0;
  return precipitationTotals.slice(0, days).reduce((sum, mm) => sum + (mm ?? 0), 0);
}

/**
 * @param {Array<number | null> | undefined} precipitationTotals
 * @param {number} [pastDays]
 * @param {number} [forecastDays]
 */
export function splitPrecipitationSeries(
  precipitationTotals,
  pastDays = PAST_RAIN_DAYS,
  forecastDays = FORECAST_RAIN_DAYS
) {
  if (!Array.isArray(precipitationTotals) || precipitationTotals.length === 0) {
    return { past: [], forecast: [] };
  }

  // Legacy snapshots / forecast-only responses (no past_days in the series).
  if (precipitationTotals.length < pastDays + 1) {
    return { past: [], forecast: precipitationTotals.slice(0, forecastDays) };
  }

  return {
    past: precipitationTotals.slice(0, pastDays),
    forecast: precipitationTotals.slice(pastDays, pastDays + forecastDays),
  };
}

/**
 * @param {number} recentPastRainSum
 * @param {number} forecastedRainSumNearTerm
 */
export function computeWateringRainContext(recentPastRainSum, forecastedRainSumNearTerm) {
  const pastCredit = Math.min(SOAK_DEPTH_MM, recentPastRainSum);
  const rainCreditMm = Math.min(SOAK_DEPTH_MM, pastCredit + forecastedRainSumNearTerm);
  const netWaterNeeded = Math.max(0, SOAK_DEPTH_MM - rainCreditMm);
  const isNatureProvidingFullSoak = rainCreditMm >= SOAK_DEPTH_MM;
  const soilRecentlyWet = recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM;

  return {
    rainCreditMm,
    netWaterNeeded,
    isNatureProvidingFullSoak,
    soilRecentlyWet,
  };
}

/**
 * @param {Partial<LawnWeatherSnapshot>} weather
 */
export function getEffectiveNearTermRain(weather) {
  if (typeof weather.forecastedRainSumNearTerm === 'number') {
    return weather.forecastedRainSumNearTerm;
  }
  if (typeof weather.forecastedRainSum === 'number') {
    return (weather.forecastedRainSum / FORECAST_RAIN_DAYS) * NEAR_TERM_RAIN_DAYS;
  }
  return 0;
}

/**
 * @param {Partial<LawnWeatherSnapshot>} weather
 */
export function getEffectiveRecentPastRain(weather) {
  if (typeof weather.recentPastRainSum === 'number') {
    return weather.recentPastRainSum;
  }
  return 0;
}

/**
 * @param {{ daily?: { precipitation_sum?: Array<number | null> }, hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
 */
export function getTodayMaxSoilTemp(data) {
  const hourlyTemps = data.hourly?.soil_temperature_6cm;
  if (!Array.isArray(hourlyTemps) || hourlyTemps.length === 0) return null;

  return hourlyTemps.slice(0, 24).reduce((max, temp) => {
    if (temp == null) return max;
    return max === null ? temp : Math.max(max, temp);
  }, /** @type {number | null} */ (null));
}

/**
 * @param {{ hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
 */
export function getTodayMinSoilTemp(data) {
  const hourlyTemps = data.hourly?.soil_temperature_6cm;
  if (!Array.isArray(hourlyTemps) || hourlyTemps.length === 0) return null;

  return hourlyTemps.slice(0, 24).reduce((min, temp) => {
    if (temp == null) return min;
    return min === null ? temp : Math.min(min, temp);
  }, /** @type {number | null} */ (null));
}

/**
 * @param {{ daily?: { precipitation_sum?: Array<number | null> }, hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
 * @returns {LawnWeatherSnapshot}
 */
export function buildWeatherSnapshotFromOpenMeteo(data) {
  const precipitationTotals = data?.daily?.precipitation_sum;
  const { past, forecast } = splitPrecipitationSeries(precipitationTotals);
  const recentPastRainSum = sumPrecipitation(
    past.slice(-RECENT_PAST_RAIN_DAYS),
    RECENT_PAST_RAIN_DAYS
  );
  const forecastedRainSumNearTerm = sumPrecipitation(forecast, NEAR_TERM_RAIN_DAYS);
  const forecastedRainSum = sumPrecipitation(forecast, FORECAST_RAIN_DAYS);
  const currentSoilTemp = getTodayMaxSoilTemp(data);
  const currentSoilTempMin = getTodayMinSoilTemp(data);
  const watering = computeWateringRainContext(recentPastRainSum, forecastedRainSumNearTerm);

  return {
    forecastedRainSum,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    rainCreditMm: watering.rainCreditMm,
    currentSoilTemp,
    currentSoilTempMin,
    isRainForecasted:
      forecastedRainSumNearTerm >= RAIN_THRESHOLD_MM || recentPastRainSum >= RECENT_RAIN_WET_SOIL_MM,
    isNatureProvidingFullSoak: watering.isNatureProvidingFullSoak,
    soilRecentlyWet: watering.soilRecentlyWet,
    netWaterNeeded: watering.netWaterNeeded,
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo',
  };
}

/**
 * @param {import('./lawnLocation.js').LawnWeatherLocation | null | undefined} [location]
 * @returns {Promise<LawnWeatherSnapshot>}
 */
export async function fetchLawnWeatherFromOpenMeteo(location) {
  const resolved = resolveWeatherLocation(location);
  const response = await fetch(
    buildOpenMeteoForecastUrl(resolved.latitude, resolved.longitude)
  );
  if (!response.ok) {
    throw new Error('Weather forecast unavailable');
  }
  const data = await response.json();
  return buildWeatherSnapshotFromOpenMeteo(data);
}

/**
 * @param {LawnWeatherSnapshot} snapshot
 * @returns {Promise<boolean>}
 */
export async function saveLawnWeatherSnapshot(snapshot) {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  const { error } = await supabase.from('lawn_app_state').upsert(
    {
      id: LAWN_STATE_ID,
      weather_snapshot: snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    if (/weather_snapshot|42703|PGRST204|PGRST205|schema cache/i.test(error.message)) {
      return false;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  return true;
}

/** @returns {Promise<LawnWeatherSnapshot | null>} */
export async function fetchLawnWeatherSnapshotFromSupabase() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase client could not be initialised.');
  }

  const { data, error } = await supabase
    .from('lawn_app_state')
    .select('weather_snapshot')
    .eq('id', LAWN_STATE_ID)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || /lawn_app_state|weather_snapshot/i.test(error.message)) {
      return null;
    }
    throw new Error(formatSupabaseSyncError(error));
  }

  const raw = data?.weather_snapshot;
  if (!raw || typeof raw !== 'object') return null;

  const snap = /** @type {LawnWeatherSnapshot} */ (raw);
  if (typeof snap.forecastedRainSum !== 'number') return null;

  return snap;
}

/** @param {string | undefined} fetchedAt @param {number} maxAgeHours */
export function isWeatherSnapshotFresh(fetchedAt, maxAgeHours = 6) {
  if (!fetchedAt) return false;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs >= 0 && ageMs < maxAgeHours * 60 * 60 * 1000;
}
