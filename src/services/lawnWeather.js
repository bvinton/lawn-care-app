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
    hourly: 'soil_temperature_6cm,precipitation',
    timezone: 'Europe/London',
    past_days: String(PAST_RAIN_DAYS),
    forecast_days: String(FORECAST_RAIN_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export const SOAK_DEPTH_MM = 10;
export const RAIN_THRESHOLD_MM = 5;
/** Light surface misting target during seed establishment (~2.5mm). */
export const SEED_MIST_TARGET_MM = 2.5;
// Per-session skip: seed surface stays moist with much less rain than a full daily soak.
export const SEED_MIST_SESSION_THRESHOLD_MM = 1.0;
/** Rain in the next few days drives forward-looking adjustments. */
export const NEAR_TERM_RAIN_DAYS = 3;
/** Observed rain history from Open-Meteo. */
export const PAST_RAIN_DAYS = 7;
/** Recent past days that still keep the soil damp for soak / due decisions. */
export const RECENT_PAST_RAIN_DAYS = 3;
export const RECENT_RAIN_WET_SOIL_MM = 5;

/** Hour-of-day windows (Europe/London) for seed misting sessions — end hour exclusive. */
export const SEED_MISTING_SESSION_WINDOWS = {
  'Water lawn (Morning)': { startHour: 5, endHour: 11, label: 'morning' },
  'Water lawn (Midday)': { startHour: 11, endHour: 16, label: 'midday' },
  'Water lawn (Evening)': { startHour: 16, endHour: 22, label: 'evening' },
};

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
 * @property {number} [recentPastRainBeforeToday]
 * @property {number} [todayRainMm]
 * @property {Array<{ date: string, mm: number }>} [dailyForecastByDate]
 * @property {number[]} [todayHourlyPrecipMm]
 * @property {number} [todayRainObservedMm]
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
 * Rain credit for pausing watering *today* — past soak + today's rain only.
 * Tomorrow's forecast does not cancel today's watering.
 * @param {number} recentPastRainBeforeToday
 * @param {number} todayRainMm
 */
export function computeTodayWateringRainContext(recentPastRainBeforeToday, todayRainMm) {
  const recentTotal = recentPastRainBeforeToday + todayRainMm;
  const rainCreditMm = Math.min(SOAK_DEPTH_MM, recentTotal);
  const netWaterNeeded = Math.max(0, SOAK_DEPTH_MM - rainCreditMm);
  const isNatureProvidingFullSoak = rainCreditMm >= SOAK_DEPTH_MM;
  const soilRecentlyWet = recentTotal >= RECENT_RAIN_WET_SOIL_MM;

  return {
    rainCreditMm,
    netWaterNeeded,
    isNatureProvidingFullSoak,
    soilRecentlyWet,
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
 * Sum observed hourly precipitation from midnight today up to the current hour.
 * @param {{ hourly?: { precipitation?: Array<number | null>, time?: Array<string> } }} data
 */
export function getTodayPrecipitationSoFar(data) {
  const hourlyPrecip = data.hourly?.precipitation;
  const hourlyTimes = data.hourly?.time;
  if (!Array.isArray(hourlyPrecip) || !Array.isArray(hourlyTimes) || hourlyPrecip.length === 0) {
    return 0;
  }

  const start = PAST_RAIN_DAYS * 24;
  const now = Date.now();
  let sum = 0;

  for (let i = start; i < Math.min(start + 24, hourlyPrecip.length); i++) {
    const hourMs = new Date(hourlyTimes[i]).getTime();
    if (Number.isNaN(hourMs) || hourMs > now) break;
    sum += hourlyPrecip[i] ?? 0;
  }

  return sum;
}

/**
 * Daily precipitation from today through the forecast window.
 * @param {{ daily?: { time?: Array<string>, precipitation_sum?: Array<number | null> } }} data
 * @returns {Array<{ date: string, mm: number }>}
 */
export function buildDailyForecastSeries(data) {
  const times = data?.daily?.time;
  const precip = data?.daily?.precipitation_sum;
  if (!Array.isArray(times) || !Array.isArray(precip)) return [];

  const { forecast } = splitPrecipitationSeries(precip);
  return times.slice(PAST_RAIN_DAYS, PAST_RAIN_DAYS + FORECAST_RAIN_DAYS).map((date, index) => ({
    date,
    mm: forecast[index] ?? 0,
  }));
}

/**
 * Today's 24 hourly precipitation values (index 0 = midnight, 23 = 11pm).
 * @param {{ hourly?: { precipitation?: Array<number | null> } }} data
 * @returns {number[]}
 */
export function getTodayHourlyPrecipMm(data) {
  const hourlyPrecip = data?.hourly?.precipitation;
  if (!Array.isArray(hourlyPrecip) || hourlyPrecip.length === 0) {
    return [];
  }

  const start = PAST_RAIN_DAYS * 24;
  const values = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const index = start + hour;
    values.push(index < hourlyPrecip.length ? hourlyPrecip[index] ?? 0 : 0);
  }
  return values;
}

/**
 * @param {number[]} todayHourlyPrecipMm
 * @param {number} startHour inclusive
 * @param {number} endHour exclusive
 */
export function sumHourlyPrecipInWindow(todayHourlyPrecipMm, startHour, endHour) {
  if (!Array.isArray(todayHourlyPrecipMm) || todayHourlyPrecipMm.length < 24) {
    return 0;
  }

  let sum = 0;
  for (let hour = startHour; hour < endHour && hour < 24; hour += 1) {
    sum += todayHourlyPrecipMm[hour] ?? 0;
  }
  return sum;
}

/**
 * Seed establishment: skip a single misting session when rain in that session's
 * time window meets the surface moisture target (not the whole day).
 * @param {string} sessionTitle
 * @param {string} dueDateIso
 * @param {string} todayStr
 * @param {number[]} [todayHourlyPrecipMm]
 * @param {Array<{ date: string, mm: number }>} dailyForecastByDate
 * @param {number} todayRainMm
 * @param {number} [todayRainObservedMm]
 */
export function getSeedMistingRainSkipForSession(
  sessionTitle,
  dueDateIso,
  todayStr,
  todayHourlyPrecipMm,
  dailyForecastByDate,
  todayRainMm,
  todayRainObservedMm = 0
) {
  const daysUntilDue = Math.floor(
    (new Date(`${dueDateIso}T12:00:00`).getTime() - new Date(`${todayStr}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) {
    return { skip: false, reason: null, fullSoak: false };
  }

  if (daysUntilDue > 0) {
    const rainMm = dailyForecastByDate.find((entry) => entry.date === dueDateIso)?.mm ?? 0;
    if (rainMm >= SEED_MIST_TARGET_MM) {
      return {
        skip: true,
        reason: `${rainMm.toFixed(1)}mm rain forecast – skip misting`,
        fullSoak: false,
      };
    }
    return { skip: false, reason: null, fullSoak: false };
  }

  const window = SEED_MISTING_SESSION_WINDOWS[sessionTitle];
  if (
    window &&
    Array.isArray(todayHourlyPrecipMm) &&
    todayHourlyPrecipMm.length >= 24
  ) {
    const rainMm = sumHourlyPrecipInWindow(
      todayHourlyPrecipMm,
      window.startHour,
      window.endHour
    );
    if (rainMm >= SEED_MIST_SESSION_THRESHOLD_MM) {
      const label =
        window.label === 'evening'
          ? `${rainMm.toFixed(1)}mm rain forecast this evening – skip misting`
          : `${rainMm.toFixed(1)}mm rain in the ${window.label} – skip misting`;
      return { skip: true, reason: label, fullSoak: false };
    }
    return { skip: false, reason: null, fullSoak: false };
  }

  // Fallback when hourly series unavailable (legacy snapshots).
  if (sessionTitle === 'Water lawn (Evening)' && todayRainMm >= SEED_MIST_SESSION_THRESHOLD_MM) {
    return {
      skip: true,
      reason: 'Rain keeping seed bed moist – skip evening misting',
      fullSoak: false,
    };
  }
  if (todayRainObservedMm >= SEED_MIST_SESSION_THRESHOLD_MM) {
    return {
      skip: true,
      reason: 'Rain already fallen today – skip misting',
      fullSoak: false,
    };
  }

  return { skip: false, reason: null, fullSoak: false };
}

/**
 * Seed establishment: skip light misting only when rain on the due date itself
 * meets the surface moisture target. Past days do not carry forward — each day
 * is judged independently because the seed bed surface dries quickly.
 * @param {string} dueDateIso
 * @param {string} todayStr
 * @param {Array<{ date: string, mm: number }>} dailyForecastByDate
 * @param {number} todayRainMm
 */
export function getSeedMistingRainSkipForDueDate(
  dueDateIso,
  todayStr,
  dailyForecastByDate,
  todayRainMm
) {
  const daysUntilDue = Math.floor(
    (new Date(`${dueDateIso}T12:00:00`).getTime() - new Date(`${todayStr}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) {
    return { skip: false, reason: null, fullSoak: false };
  }

  const rainMm =
    daysUntilDue === 0
      ? todayRainMm
      : (dailyForecastByDate.find((entry) => entry.date === dueDateIso)?.mm ?? 0);

  if (rainMm >= SEED_MIST_TARGET_MM) {
    const dayLabel =
      daysUntilDue === 0
        ? 'Rain keeping seed bed moist – skip misting today'
        : `${rainMm.toFixed(1)}mm rain forecast – skip misting`;
    return { skip: true, reason: dayLabel, fullSoak: false };
  }

  return { skip: false, reason: null, fullSoak: false };
}

/**
 * Should watering be skipped on a specific due date?
 * Normal maintenance: deep soak thresholds; past rain can pause for several days.
 * Seed establishment: surface misting thresholds; only rain on the due date counts.
 * @param {string} dueDateIso
 * @param {string} todayStr
 * @param {Array<{ date: string, mm: number }>} dailyForecastByDate
 * @param {number} recentPastRainBeforeToday
 * @param {number} todayRainMm
 * @param {{ seedEstablishmentActive?: boolean }} [options]
 */
export function getWateringRainSkipForDueDate(
  dueDateIso,
  todayStr,
  dailyForecastByDate,
  recentPastRainBeforeToday,
  todayRainMm,
  { seedEstablishmentActive = false } = {}
) {
  if (seedEstablishmentActive) {
    return getSeedMistingRainSkipForDueDate(
      dueDateIso,
      todayStr,
      dailyForecastByDate,
      todayRainMm
    );
  }

  const daysUntilDue = Math.floor(
    (new Date(`${dueDateIso}T12:00:00`).getTime() - new Date(`${todayStr}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) {
    return { skip: false, reason: null, fullSoak: false };
  }

  if (daysUntilDue === 0) {
    const todayContext = computeTodayWateringRainContext(
      recentPastRainBeforeToday,
      todayRainMm
    );

    if (todayContext.isNatureProvidingFullSoak) {
      return {
        skip: true,
        reason: 'Heavy rain – nature providing full soak',
        fullSoak: true,
      };
    }

    if (todayContext.soilRecentlyWet) {
      return {
        skip: true,
        reason: 'Recent rain – soil still damp, skip watering',
        fullSoak: false,
      };
    }

    return { skip: false, reason: null, fullSoak: false };
  }

  const forecastEntry = dailyForecastByDate.find((entry) => entry.date === dueDateIso);
  const forecastMm = forecastEntry?.mm ?? 0;

  if (forecastMm >= SOAK_DEPTH_MM) {
    return {
      skip: true,
      reason: `${forecastMm.toFixed(0)}mm rain forecast – skip watering`,
      fullSoak: true,
    };
  }

  if (forecastMm >= RECENT_RAIN_WET_SOIL_MM) {
    return {
      skip: true,
      reason: `${forecastMm.toFixed(1)}mm rain forecast – soil will be damp`,
      fullSoak: false,
    };
  }

  return { skip: false, reason: null, fullSoak: false };
}

/**
 * Hourly data starts PAST_RAIN_DAYS ago, so today's 24 hours begin at index PAST_RAIN_DAYS * 24.
 * @param {{ daily?: { precipitation_sum?: Array<number | null> }, hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
 */
export function getTodayMaxSoilTemp(data) {
  const hourlyTemps = data.hourly?.soil_temperature_6cm;
  if (!Array.isArray(hourlyTemps) || hourlyTemps.length === 0) return null;

  const start = PAST_RAIN_DAYS * 24;
  return hourlyTemps.slice(start, start + 24).reduce((max, temp) => {
    if (temp == null) return max;
    return max === null ? temp : Math.max(max, temp);
  }, /** @type {number | null} */ (null));
}

/**
 * Hourly data starts PAST_RAIN_DAYS ago, so today's 24 hours begin at index PAST_RAIN_DAYS * 24.
 * @param {{ hourly?: { soil_temperature_6cm?: Array<number | null> } }} data
 */
export function getTodayMinSoilTemp(data) {
  const hourlyTemps = data.hourly?.soil_temperature_6cm;
  if (!Array.isArray(hourlyTemps) || hourlyTemps.length === 0) return null;

  const start = PAST_RAIN_DAYS * 24;
  return hourlyTemps.slice(start, start + 24).reduce((min, temp) => {
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
  const recentPastRainBeforeToday = sumPrecipitation(
    past.slice(-RECENT_PAST_RAIN_DAYS),
    RECENT_PAST_RAIN_DAYS
  );
  const todayRainObservedMm = getTodayPrecipitationSoFar(data);
  const todayFromDailyForecast = forecast[0] ?? 0;
  const todayRainMm = Math.max(todayRainObservedMm, todayFromDailyForecast);
  const effectiveRecentPastRain = recentPastRainBeforeToday + todayRainMm;
  const forecastNearTermBeyondToday = sumPrecipitation(
    forecast.slice(1),
    Math.max(0, NEAR_TERM_RAIN_DAYS - 1)
  );
  const forecastedRainSumNearTerm = todayRainMm + forecastNearTermBeyondToday;
  const forecastedRainSum = sumPrecipitation(forecast, FORECAST_RAIN_DAYS);
  const dailyForecastByDate = buildDailyForecastSeries(data);
  const todayHourlyPrecipMm = getTodayHourlyPrecipMm(data);
  const currentSoilTemp = getTodayMaxSoilTemp(data);
  const currentSoilTempMin = getTodayMinSoilTemp(data);
  const todayWatering = computeTodayWateringRainContext(
    recentPastRainBeforeToday,
    todayRainMm
  );

  return {
    forecastedRainSum,
    forecastedRainSumNearTerm,
    recentPastRainSum: effectiveRecentPastRain,
    recentPastRainBeforeToday,
    todayRainMm,
    dailyForecastByDate,
    todayHourlyPrecipMm,
    todayRainObservedMm,
    rainCreditMm: todayWatering.rainCreditMm,
    currentSoilTemp,
    currentSoilTempMin,
    isRainForecasted:
      forecastedRainSumNearTerm >= RAIN_THRESHOLD_MM ||
      effectiveRecentPastRain >= RECENT_RAIN_WET_SOIL_MM,
    isNatureProvidingFullSoak: todayWatering.isNatureProvidingFullSoak,
    soilRecentlyWet: todayWatering.soilRecentlyWet,
    netWaterNeeded: todayWatering.netWaterNeeded,
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
