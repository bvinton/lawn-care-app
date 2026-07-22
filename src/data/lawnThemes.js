/** @typedef {'classic' | 'rooms' | 'tabs' | 'today'} LawnThemeLayout */

/**
 * @typedef {Object} LawnTheme
 * @property {string} id
 * @property {string} name
 * @property {string} tagline
 * @property {string} description
 * @property {LawnThemeLayout} layout
 * @property {string[]} swatches
 * @property {string} fontDisplay
 * @property {string} fontBody
 */

export const LAWN_THEME_STORAGE_KEY = 'lawnPackUiTheme';

/** @type {LawnTheme[]} */
export const LAWN_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Original long page',
    description:
      'Everything on one scrolling page — the familiar layout if you want to go back.',
    layout: 'classic',
    swatches: ['#14532d', '#dcfce7', '#ffffff', '#e5e7eb'],
    fontDisplay: '"Segoe UI", system-ui, sans-serif',
    fontBody: '"Segoe UI", system-ui, sans-serif',
  },
  {
    id: 'atelier',
    name: 'Atelier',
    tagline: 'Journal spine · chapters',
    description:
      'Porcelain studio look. A vertical chapter spine (Cover, Care, Pack, Studio) — open one chapter at a time like a field journal, not a tab bar or long page.',
    layout: 'rooms',
    swatches: ['#e7eef3', '#1c2430', '#f4f7fa', '#b45309'],
    fontDisplay: '"Literata", Georgia, serif',
    fontBody: '"Source Sans 3", "Segoe UI", sans-serif',
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Bottom tabs · status board',
    description:
      'Cool slate utility layout. Persistent bottom tabs (Status, Care, Pack, More) and a dense status board — a clear alternative to the long Classic page.',
    layout: 'tabs',
    swatches: ['#0b1220', '#64748b', '#e2e8f0', '#0f766e'],
    fontDisplay: '"Space Grotesk", "Segoe UI", sans-serif',
    fontBody: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  {
    id: 'canopy',
    name: 'Canopy',
    tagline: 'Daylight timeline · due ribbon',
    description:
      'Bright sky-to-meadow shell. Starts on a vertical Today timeline of what’s due, with Care / Pack opened as full sheets from a floating dock — not bottom tabs.',
    layout: 'today',
    swatches: ['#7eb8d9', '#e8f5d8', '#ffffff', '#2f6b3a'],
    fontDisplay: '"Sora", "Segoe UI", sans-serif',
    fontBody: '"Nunito Sans", "Segoe UI", sans-serif',
  },
];

export const DEFAULT_LAWN_THEME_ID = 'classic';

/** Layouts that use section navigation via activeRoom (not the classic long page). */
export const SECTIONED_LAYOUTS = new Set(['rooms', 'tabs', 'today']);

/** @param {string | null | undefined} id */
export function normalizeLawnThemeId(id) {
  if (!id || typeof id !== 'string') return DEFAULT_LAWN_THEME_ID;
  if (LAWN_THEMES.some((theme) => theme.id === id)) return id;
  return DEFAULT_LAWN_THEME_ID;
}

/** @param {string | null | undefined} id */
export function getLawnTheme(id) {
  const normalized = normalizeLawnThemeId(id);
  return LAWN_THEMES.find((theme) => theme.id === normalized) ?? LAWN_THEMES[0];
}

/** @param {string | null | undefined} layout */
export function isSectionedLayout(layout) {
  return SECTIONED_LAYOUTS.has(layout);
}

/** @returns {string} */
export function readStoredLawnThemeId() {
  try {
    const saved = localStorage.getItem(LAWN_THEME_STORAGE_KEY);
    return normalizeLawnThemeId(saved);
  } catch {
    /* ignore */
  }
  return DEFAULT_LAWN_THEME_ID;
}

/**
 * Map a Tasks deep-link focus target to a section room.
 * @param {string | null | undefined} focusRaw
 * @returns {'hub' | 'maintenance' | 'seasonal' | null}
 */
export function resolveFocusRoom(focusRaw) {
  if (!focusRaw || typeof focusRaw !== 'string') return null;
  const trimmed = focusRaw.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.startsWith('step-') || /^step-(spring|summer|autumn|winter)-/.test(trimmed)) {
    return 'seasonal';
  }

  if (
    trimmed === 'maintenance' ||
    trimmed === 'mow' ||
    trimmed === 'water' ||
    trimmed === 'verticut' ||
    trimmed === 'gypsum' ||
    trimmed === 'maintenance-panel' ||
    trimmed === 'maintenance-mowing-tracker' ||
    trimmed === 'maintenance-watering-tracker' ||
    trimmed === 'maintenance-verticut-tracker' ||
    trimmed === 'soil-treatments-tracker' ||
    trimmed === 'environmental-status-card'
  ) {
    return 'maintenance';
  }

  return null;
}
