import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';

const LAWN_STATE_ID = 'default';

/** soil_temperature_10cm_max is not a valid daily variable on the forecast API — use hourly soil temps only. */
export const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=54.99&longitude=-1.53&daily=precipitation_sum&hourly=soil_temperature_6cm&timezone=Europe%2FLondon&forecast_days=7';

export const SOAK_DEPTH_MM = 10;
export const RAIN_THRESHOLD_MM = 5;

/**
 * @typedef {Object} LawnWeatherSnapshot
 * @property {number} forecastedRainSum
 * @property {number | null} currentSoilTemp
 * @property {number | null} currentSoilTempMin
 * @property {boolean} isRainForecasted
 * @property {boolean} isNatureProvidingFullSoak
 * @property {number} netWaterNeeded
 * @property {string} fetchedAt
 * @property {'open-meteo'} source
 */

/**
 * @param {{ daily?: { soil_temperature_10cm_max?: Array<number | null>, precipitation_sum?: Array<number | null> }, hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
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
  const forecastedRainSum = Array.isArray(precipitationTotals)
    ? precipitationTotals.reduce((sum, mm) => sum + (mm ?? 0), 0)
    : 0;
  const currentSoilTemp = getTodayMaxSoilTemp(data);
  const currentSoilTempMin = getTodayMinSoilTemp(data);
  const netWaterNeeded = Math.max(0, SOAK_DEPTH_MM - forecastedRainSum);

  return {
    forecastedRainSum,
    currentSoilTemp,
    currentSoilTempMin,
    isRainForecasted: forecastedRainSum >= RAIN_THRESHOLD_MM,
    isNatureProvidingFullSoak: netWaterNeeded === 0,
    netWaterNeeded,
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo',
  };
}

/** @returns {Promise<LawnWeatherSnapshot>} */
export async function fetchLawnWeatherFromOpenMeteo() {
  const response = await fetch(OPEN_METEO_URL);
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
