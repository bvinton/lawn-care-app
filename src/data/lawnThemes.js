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
    tagline: 'Home hub · separate rooms',
    description:
      'Calm moss look. Home screen with Maintenance and Seasonal Pack as separate rooms you open one at a time.',
    layout: 'rooms',
    swatches: ['#1a3a2a', '#c5d9c8', '#f3f7f4', '#2f6b4f'],
    fontDisplay: '"Bricolage Grotesque", Georgia, serif',
    fontBody: '"Figtree", "Segoe UI", sans-serif',
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Bottom tabs · status board',
    description:
      'Cool slate utility layout. Persistent bottom tabs (Status, Care, Pack, More) and a dense status board — not a room hub.',
    layout: 'tabs',
    swatches: ['#0b1220', '#64748b', '#e2e8f0', '#0f766e'],
    fontDisplay: '"Space Grotesk", "Segoe UI", sans-serif',
    fontBody: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  {
    id: 'canopy',
    name: 'Canopy',
    tagline: 'Today queue · top segments',
    description:
      'Deep green, immersive. Starts on a Today queue of what’s due, with Care / Pack as top segments — different navigation and colour world.',
    layout: 'today',
    swatches: ['#03160d', '#14532d', '#ecfdf5', '#4ade80'],
    fontDisplay: '"Fraunces", Georgia, serif',
    fontBody: '"Karla", "Segoe UI", sans-serif',
  },
];

export const DEFAULT_LAWN_THEME_ID = 'classic';

/** Layouts that use section navigation via activeRoom (not the classic long page). */
export const SECTIONED_LAYOUTS = new Set(['rooms', 'tabs', 'today']);

/** @param {string | null | undefined} id */
export function getLawnTheme(id) {
  return LAWN_THEMES.find((theme) => theme.id === id) ?? LAWN_THEMES[0];
}

/** @param {string | null | undefined} layout */
export function isSectionedLayout(layout) {
  return SECTIONED_LAYOUTS.has(layout);
}

/** @returns {string} */
export function readStoredLawnThemeId() {
  try {
    const saved = localStorage.getItem(LAWN_THEME_STORAGE_KEY);
    if (saved && LAWN_THEMES.some((theme) => theme.id === saved)) return saved;
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
