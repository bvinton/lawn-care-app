/** Short keys used in ?focus= from the Tasks app */
export const LAWN_FOCUS_ALIASES = {
  water: 'maintenance-watering-tracker',
  mow: 'maintenance-mowing-tracker',
  gypsum: 'soil-treatments-tracker',
  maintenance: 'maintenance-panel',
};

const PACK_STEP_FOCUS_PATTERN = /^step-(SPRING|SUMMER|AUTUMN|WINTER)-([a-z]+)$/i;

const HIGHLIGHT_CLASS = 'lawn-focus-highlight';

/**
 * @param {string} seasonKey
 * @param {string} stepId
 * @returns {string}
 */
export function packStepDomId(seasonKey, stepId) {
  return `step-${seasonKey}-${stepId}`;
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ season: string, stepId: string, domId: string } | null}
 */
export function parsePackStepFocus(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.trim().match(PACK_STEP_FOCUS_PATTERN);
  if (!match) return null;

  const season = match[1].toUpperCase();
  const stepId = match[2].toLowerCase();
  return { season, stepId, domId: packStepDomId(season, stepId) };
}

/**
 * @param {string | null | undefined} raw
 * @returns {string | null} DOM id to scroll to
 */
export function resolveLawnFocusTarget(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const alias = LAWN_FOCUS_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const pack = parsePackStepFocus(trimmed);
  if (pack) return pack.domId;

  if (/^[a-z][a-z0-9-]*$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * @returns {string | null}
 */
export function getFocusFromUrl() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('focus');
  if (fromQuery) return fromQuery;

  const hash = window.location.hash.replace(/^#/, '');
  if (hash) return hash;

  return null;
}

/**
 * Scroll to a maintenance / treatment section and briefly highlight it.
 * @param {string} targetId
 * @param {{ delayMs?: number }} [options]
 */
export function scrollToLawnFocus(targetId, options = {}) {
  const { delayMs = 400 } = options;

  const run = () => {
    const el = document.getElementById(targetId);
    if (!el) return false;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add(HIGHLIGHT_CLASS);
    window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 3200);
    return true;
  };

  if (delayMs <= 0) {
    return run();
  }

  window.setTimeout(run, delayMs);
  return true;
}

/**
 * Apply ?focus= / #hash from the current URL once the main UI is mounted.
 * @param {{ delayMs?: number, retries?: number }} [options]
 */
export function applyLawnFocusFromUrl(options = {}) {
  const focusRaw = getFocusFromUrl();
  const targetId = resolveLawnFocusTarget(focusRaw);
  if (!targetId) return;

  const delayMs = options.delayMs ?? 300;
  const retries = options.retries ?? 8;

  const attempt = (left) => {
    if (scrollToLawnFocus(targetId, { delayMs: 0 })) return;
    if (left > 0) {
      window.setTimeout(() => attempt(left - 1), 200);
    }
  };

  window.setTimeout(() => attempt(retries), delayMs);
}
