/** @typedef {'classic' | 'rooms'} LawnThemeLayout */

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
    tagline: 'Sectioned rooms · calm workshop',
    description:
      'Home hub with separate rooms for Maintenance and Seasonal Pack. Soft moss tones, clear places for each job.',
    layout: 'rooms',
    swatches: ['#1a3a2a', '#c5d9c8', '#f3f7f4', '#2f6b4f'],
    fontDisplay: '"Bricolage Grotesque", Georgia, serif',
    fontBody: '"Figtree", "Segoe UI", sans-serif',
  },
  {
    id: 'signal',
    name: 'Signal',
    tagline: 'Sectioned rooms · neat & crisp',
    description:
      'Same roomed layout with cooler slate/sage and tighter typography — built for a neat-freak glance.',
    layout: 'rooms',
    swatches: ['#0f172a', '#94a3b8', '#f1f5f9', '#3f6f5a'],
    fontDisplay: '"Space Grotesk", "Segoe UI", sans-serif',
    fontBody: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  {
    id: 'canopy',
    name: 'Canopy',
    tagline: 'Sectioned rooms · outdoor atmosphere',
    description:
      'Roomed layout with deeper greens and a leafy backdrop so each section feels like its own space.',
    layout: 'rooms',
    swatches: ['#052e16', '#86efac', '#ecfdf5', '#166534'],
    fontDisplay: '"Fraunces", Georgia, serif',
    fontBody: '"Karla", "Segoe UI", sans-serif',
  },
];

export const DEFAULT_LAWN_THEME_ID = 'classic';

/** @param {string | null | undefined} id */
export function getLawnTheme(id) {
  return LAWN_THEMES.find((theme) => theme.id === id) ?? LAWN_THEMES[0];
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
 * Map a Tasks deep-link focus target to a rooms section.
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
