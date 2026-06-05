import { WALLSEND_COORDS } from '../data/LawnPackData.js';

export const WEATHER_LOCATION_STORAGE_KEY = 'lawnPackWeatherLocation';

/** @typedef {'postcode' | 'geolocation' | 'default'} LawnLocationSource */

/**
 * @typedef {Object} LawnWeatherLocation
 * @property {string} postcode
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} label
 * @property {LawnLocationSource} source
 */

export const DEFAULT_WEATHER_LOCATION = /** @type {LawnWeatherLocation} */ ({
  postcode: '',
  latitude: WALLSEND_COORDS.latitude,
  longitude: WALLSEND_COORDS.longitude,
  label: 'Wallsend area (default)',
  source: 'default',
});

/**
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeUkPostcode(input) {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) {
    return null;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/**
 * @param {unknown} value
 * @returns {LawnWeatherLocation | null}
 */
export function parseWeatherLocation(value) {
  if (!value || typeof value !== 'object') return null;

  const raw = /** @type {Record<string, unknown>} */ (value);
  const latitude = raw.latitude;
  const longitude = raw.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return {
    postcode: typeof raw.postcode === 'string' ? raw.postcode : '',
    latitude,
    longitude,
    label:
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim()
        : DEFAULT_WEATHER_LOCATION.label,
    source:
      raw.source === 'postcode' || raw.source === 'geolocation' || raw.source === 'default'
        ? raw.source
        : 'default',
  };
}

/** @returns {LawnWeatherLocation} */
export function readStoredWeatherLocation() {
  try {
    const saved = localStorage.getItem(WEATHER_LOCATION_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_WEATHER_LOCATION };
    return parseWeatherLocation(JSON.parse(saved)) ?? { ...DEFAULT_WEATHER_LOCATION };
  } catch {
    return { ...DEFAULT_WEATHER_LOCATION };
  }
}

/** @param {LawnWeatherLocation} location */
export function persistWeatherLocation(location) {
  localStorage.setItem(WEATHER_LOCATION_STORAGE_KEY, JSON.stringify(location));
}

/**
 * @param {LawnWeatherLocation | null | undefined} local
 * @param {LawnWeatherLocation | null | undefined} remote
 */
export function mergeWeatherLocation(local, remote) {
  if (!remote) return local ?? { ...DEFAULT_WEATHER_LOCATION };
  if (!local || local.source === 'default') return remote;
  if (remote.source === 'default') return local;
  return remote;
}

/**
 * @param {LawnWeatherLocation | null | undefined} location
 * @returns {LawnWeatherLocation}
 */
export function resolveWeatherLocation(location) {
  return parseWeatherLocation(location) ?? readStoredWeatherLocation();
}

/**
 * @param {string} postcode
 * @returns {Promise<LawnWeatherLocation>}
 */
export async function lookupUkPostcode(postcode) {
  const normalized = normalizeUkPostcode(postcode);
  if (!normalized) {
    throw new Error('Enter a valid UK postcode (e.g. NE28 9AB).');
  }

  const compact = normalized.replace(/\s+/g, '');
  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`
  );
  const data = await response.json();

  if (data.status !== 200 || !data.result) {
    throw new Error('Postcode not found. Check it and try again.');
  }

  const result = data.result;
  const place = result.admin_district || result.parish || result.region;

  return {
    postcode: result.postcode,
    latitude: result.latitude,
    longitude: result.longitude,
    label: place ? `${result.postcode} — ${place}` : result.postcode,
    source: 'postcode',
  };
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<LawnWeatherLocation>}
 */
export async function lookupNearestUkPostcode(latitude, longitude) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    limit: '1',
  });
  const response = await fetch(`https://api.postcodes.io/postcodes?${params}`);
  const data = await response.json();

  if (data.status !== 200 || !Array.isArray(data.result) || data.result.length === 0) {
    return {
      postcode: '',
      latitude,
      longitude,
      label: `Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
      source: 'geolocation',
    };
  }

  const result = data.result[0];
  const place = result.admin_district || result.parish || result.region;

  return {
    postcode: result.postcode,
    latitude: result.latitude,
    longitude: result.longitude,
    label: place ? `${result.postcode} — ${place}` : 'Current location',
    source: 'geolocation',
  };
}

/** @returns {Promise<{ latitude: number, longitude: number }>} */
export function getBrowserGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Enter your postcode instead.'));
          return;
        }
        reject(new Error('Could not detect your location. Enter your postcode instead.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  });
}
