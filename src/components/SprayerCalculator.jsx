import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_LAWN_CONFIG,
  SEASONS,
  EQUIPMENT_OPTIONS,
  SPRINKLER_OPTIONS,
  WEEDOL_BARRIER_DAYS,
  SEASON_START_DATES,
  getCalendarSeasonForDate,
  getWorkflowSeasonForDate,
  getIncompleteSeasonSteps,
  makeStepKey,
  createInitialPendingDates,
  cascadeSeasonDates,
  getSeasonAnchorDate,
  getGranularRepeatDate,
  addDaysToDateString,
  stepTriggersPetLockout,
  hasChemicalApplicationToday,
  stripStalePetLockout,
} from '../data/LawnPackData';
import {
  syncLawnTasksToSupabase,
  fetchLawnTasksFromSupabase,
  fetchLawnTasksForInboundSync,
  clearLawnTaskCompletion,
  LAWN_APP_SOURCE,
} from '../services/lawnTasks';
import {
  applyInboundTaskCompletions,
  GYPSUM_LOG_KEY,
  GYPSUM_POSTPONE_KEY,
  GYPSUM_POSTPONE_OPTIONS,
} from '../services/lawnTaskInboundSync';
import { getGypsumSchedule } from '../utils/compileLawnTasks';
import {
  mergeMaintenanceDate,
  pullMaintenanceDatesFromSupabase,
  getLastCompletedColumnHint,
  probeLastCompletedColumn,
  isMissingLastCompletedColumnError,
} from '../services/lawnMaintenanceSync';
import {
  fetchLawnUserLogsFromSupabase,
  saveLawnUserLogsToSupabase,
  saveLawnScheduleSnapshot,
  mergeLawnUserLogs,
  getLawnAppStateSetupHint,
} from '../services/lawnAppState';
import {
  fetchLawnWeatherFromOpenMeteo,
  fetchLawnWeatherSnapshotFromSupabase,
  isWeatherSnapshotFresh,
  saveLawnWeatherSnapshot,
  SOAK_DEPTH_MM,
} from '../services/lawnWeather';
import { getSupabase, getSupabaseConfigError, formatSupabaseSyncError } from '../lib/supabase';
import { compileAllLawnTasks } from '../utils/compileLawnTasks';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;
const MOWING_DUE_DAYS = 5;
const WATERING_DUE_DAYS = 3;
const SEED_ESTABLISHMENT_DAYS = 21;
const GYPSUM_CYCLE_DAYS = 182;
const SEED_GERMINATION_SOIL_TEMP_MIN_C = 10;
const SEED_GERMINATION_SOIL_TEMP_MAX_C = 25;
const PET_LOCKOUT_KEY = 'petLockoutUntil';
const PET_LOCKOUT_HOURS = 24;

const MOWER_OPTIONS = {
  RYOBI_33: {
    id: 'RYOBI_33',
    name: 'Ryobi 18V ONE+ 33cm (5-Height System)',
  },
};

const LAWN_SURFACE_OPTIONS = {
  UNEVEN: {
    id: 'UNEVEN',
    label: 'Uneven / Bumpy',
  },
  FLAT: {
    id: 'FLAT',
    label: 'Perfectly Flat / Smooth',
  },
};

const LEVELLING_GUIDE_METHODS = [
  {
    title: '1. Light Topdressing (Minor bumps up to 20mm)',
    text: 'Spread a 50/50 mix of sharp sand and screened topsoil across low areas during active growth (spring or early autumn). Work the mix in with a lawn lute or stiff rake, keeping grass tips visible. Water lightly and repeat in thin layers rather than one deep dump.',
  },
  {
    title: '2. Deep Spot Filling (Medium dips)',
    text: 'Remove debris from the hollow, fill with topsoil in layers, and firm each layer with your heel or a tamper until level with the surrounding turf. Over-seed the patch or lay fresh turf sods, then keep the area moist until roots establish.',
  },
  {
    title: '3. Turf Lifting (Severe hollows)',
    text: 'Cut an H-shape through the turf around the sunken area. Peel back both flaps carefully, add and compact topsoil underneath until the surface matches the surrounding lawn, then fold the grass flaps back down. Water thoroughly and avoid heavy traffic until re-rooted.',
  },
];

const PET_SAFETY_CLASS =
  'bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs p-3 rounded-lg flex items-center gap-2 mb-2';

const DECKING_EDGE_WATERING_SUBTASK = (
  <p className="mt-2 text-[11px] font-medium text-sky-900 bg-sky-50/80 border border-sky-100 rounded p-2 leading-snug">
    🚰 Secondary Task: 2-minute manual hose blast for the decking edges and blind spots.
  </p>
);

const UK_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UK_WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const UK_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** @param {string | Date} date */
function startOfDay(date) {
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/** @param {string | Date} fromDate @param {string | Date} toDate */
function daysBetween(fromDate, toDate) {
  const toMs = startOfDay(toDate).getTime();
  const fromMs = startOfDay(fromDate).getTime();
  return Math.floor((toMs - fromMs) / MS_PER_DAY);
}

/** @param {string} dateString */
function formatUkDate(dateString) {
  if (!dateString) return '';
  const normalized = startOfDay(dateString);
  const day = String(normalized.getDate()).padStart(2, '0');
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const year = normalized.getFullYear();
  return `${day}/${month}/${year}`;
}

/** @param {string} input */
function parseUkDate(input) {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatInputDate(date);
}

/** @param {number | null} days */
function formatDaysSinceLabel(days) {
  if (days === null) return 'no record yet';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** @param {Date} date */
function formatSyncTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** @param {string} dateString */
function formatDisplayDate(dateString) {
  const normalized = startOfDay(dateString);
  const weekday = UK_WEEKDAYS_SHORT[normalized.getDay()];
  const month = UK_MONTHS_SHORT[normalized.getMonth()];
  return `${weekday}, ${normalized.getDate()} ${month} ${normalized.getFullYear()}`;
}

/** @param {Date} date */
function formatInputDate(date) {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** @param {{ id?: string, value: string, onChange: (value: string) => void, max?: string, disabled?: boolean, className?: string }} props */
function UkDateInput({ id, value, onChange, max, disabled, className }) {
  const [text, setText] = useState(() => formatUkDate(value));
  const nativeInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    setText(formatUkDate(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseUkDate(text);
    if (!parsed || (max && parsed > max)) {
      setText(formatUkDate(value));
      return;
    }
    onChange(parsed);
    setText(formatUkDate(parsed));
  };

  const handleNativeChange = (event) => {
    const iso = event.target.value;
    if (!iso) return;
    if (max && iso > max) return;
    onChange(iso);
    setText(formatUkDate(iso));
  };

  const openCalendar = () => {
    const input = nativeInputRef.current;
    if (!input || disabled) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className={`${className ?? ''} pr-9`.trim()}
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        aria-label="Open calendar"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        📅
      </button>
      <input
        ref={nativeInputRef}
        type="date"
        value={value || ''}
        max={max}
        onChange={handleNativeChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}

/** @param {import('../data/LawnPackData').SEASONS[string]['steps'][number]} step @param {number} sqm */
function getStepAmounts(step, sqm) {
  if (step.rates) {
    return step.rates.map((item) => ({
      name: item.name,
      total: item.ratePerSqm * sqm,
      unit: item.unit,
    }));
  }
  if (step.ratePerSqm != null) {
    return [{ name: null, total: step.ratePerSqm * sqm, unit: step.unit }];
  }
  return [];
}

function readStoredJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export default function SprayerCalculator() {
  const [length, setLength] = useState(INITIAL_LAWN_CONFIG.defaultLength);
  const [width, setWidth] = useState(INITIAL_LAWN_CONFIG.defaultWidth);
  const [sqm, setSqm] = useState(INITIAL_LAWN_CONFIG.defaultSqm);
  const [userLogs, setUserLogs] = useState(() =>
    stripStalePetLockout(
      /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {})),
      formatInputDate(new Date())
    )
  );
  const [currentSeason, setCurrentSeason] = useState(() => {
    const logs = stripStalePetLockout(
      /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {})),
      formatInputDate(new Date())
    );
    return getWorkflowSeasonForDate(formatInputDate(new Date()), logs);
  });
  const [seasonManuallySelected, setSeasonManuallySelected] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState('BIRCHMEIER');
  const [selectedSprinkler, setSelectedSprinkler] = useState(() => {
    const saved = localStorage.getItem('lawnPackSelectedSprinkler');
    return saved && SPRINKLER_OPTIONS[saved] ? saved : 'OSCILLATING';
  });
  const [mowerModel, setMowerModel] = useState(() => {
    const saved = localStorage.getItem('lawnPackMowerModel');
    return saved && MOWER_OPTIONS[saved] ? saved : 'RYOBI_33';
  });
  const [lawnSurface, setLawnSurface] = useState(() => {
    const saved = localStorage.getItem('lawnPackLawnSurface');
    return saved && LAWN_SURFACE_OPTIONS[saved] ? saved : 'UNEVEN';
  });
  const [activeScreen, setActiveScreen] = useState('main');
  const [showLevellingGuide, setShowLevellingGuide] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [lawnTasksSnapshot, setLawnTasksSnapshot] = useState(
    /** @type {Array<{ id: string, title: string, dueDate: string, status: string, module: 'lawn' }>} */ ([])
  );
  const [supabaseSyncError, setSupabaseSyncError] = useState(
    /** @type {string | null} */ (null)
  );
  const [maintenanceHydrated, setMaintenanceHydrated] = useState(false);
  const [userLogsHydrated, setUserLogsHydrated] = useState(false);
  const userLogsSaveTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const [maintenanceHints, setMaintenanceHints] = useState(
    /** @type {{ mow: string | null, water: string | null }} */ ({ mow: null, water: null })
  );
  const syncInFlightRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');
  const [cloudSyncStatus, setCloudSyncStatus] = useState(
    /** @type {'idle' | 'pulling' | 'pushing' | 'synced' | 'error'} */ ('idle')
  );
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState(/** @type {Date | null} */ (null));

  const [pendingDates, setPendingDates] = useState(() =>
    /** @type {Record<string, Record<string, string>>} */ (
      createInitialPendingDates(
        null,
        /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {}))
      )
    )
  );
  const [lastMowedDate, setLastMowedDate] = useState(() =>
    localStorage.getItem('lawnPackLastMowedDate')
  );
  const [lastWateredDate, setLastWateredDate] = useState(() =>
    localStorage.getItem('lawnPackLastWateredDate')
  );
  const [pendingMowLogDate, setPendingMowLogDate] = useState(() => formatInputDate(new Date()));
  const [pendingWaterLogDate, setPendingWaterLogDate] = useState(() => formatInputDate(new Date()));
  const [pendingGypsumLogDate, setPendingGypsumLogDate] = useState(() => formatInputDate(new Date()));

  const [isRainForecasted, setIsRainForecasted] = useState(false);
  const [forecastedRainSum, setForecastedRainSum] = useState(0);
  const [currentSoilTemp, setCurrentSoilTemp] = useState(
    /** @type {number | null} */ (null)
  );
  const [currentSoilTempMin, setCurrentSoilTempMin] = useState(
    /** @type {number | null} */ (null)
  );
  const [weatherStatus, setWeatherStatus] = useState('loading');
  const [enlargedSprinkler, setEnlargedSprinkler] = useState(
    /** @type {{ image: string, name: string } | null} */ (null)
  );

  const activeEquipment = EQUIPMENT_OPTIONS[selectedEquipment];
  const activeSprinkler = SPRINKLER_OPTIONS[selectedSprinkler];
  const netWaterNeeded = Math.max(0, SOAK_DEPTH_MM - forecastedRainSum);
  const dynamicMinutes = Math.round(
    (netWaterNeeded / SPRINKLER_OPTIONS[selectedSprinkler].ratePerHour) * 60
  );
  const isNatureProvidingFullSoak = netWaterNeeded === 0;
  const activeSeason = SEASONS[currentSeason];
  const today = startOfDay(new Date());
  const todayStr = formatInputDate(today);
  const calendarSeason = getCalendarSeasonForDate(todayStr);
  const workflowSeason = getWorkflowSeasonForDate(todayStr, userLogs);
  const isCatchUpMode = workflowSeason !== calendarSeason;
  const incompleteSpringSteps = getIncompleteSeasonSteps('SPRING', userLogs);
  const springPackIncomplete = incompleteSpringSteps.length > 0;
  const springRenovationPending = incompleteSpringSteps.some((step) =>
    ['prep', 'seed'].includes(step.id)
  );

  const springSeedDate = userLogs[makeStepKey('SPRING', 'seed')] ?? null;
  const daysSinceSeed = springSeedDate ? daysBetween(springSeedDate, today) : null;
  const seedEstablishmentActive =
    springSeedDate !== null && daysSinceSeed !== null && daysSinceSeed < SEED_ESTABLISHMENT_DAYS;
  const seedDaysRemaining = seedEstablishmentActive
    ? SEED_ESTABLISHMENT_DAYS - (daysSinceSeed ?? 0)
    : 0;

  const weedolLoggedDate = userLogs[makeStepKey('SPRING', 'weedol')] ?? null;
  const weedolDaysElapsed = weedolLoggedDate ? daysBetween(weedolLoggedDate, today) : 0;
  const weedolDaysRemaining = weedolLoggedDate
    ? Math.max(0, WEEDOL_BARRIER_DAYS - weedolDaysElapsed)
    : 0;
  const weedolBarrierActive =
    weedolLoggedDate !== null && weedolDaysElapsed < WEEDOL_BARRIER_DAYS;

  const weedolClearanceDate = weedolLoggedDate
    ? addDaysToDateString(weedolLoggedDate, WEEDOL_BARRIER_DAYS)
    : null;

  const daysSinceMow = lastMowedDate ? daysBetween(lastMowedDate, today) : null;
  const daysSinceWater = lastWateredDate ? daysBetween(lastWateredDate, today) : null;

  const lastGypsumDate = userLogs[GYPSUM_LOG_KEY] ?? null;
  const petLockoutUntil = userLogs[PET_LOCKOUT_KEY] ?? null;
  const petLockoutUntilMs = petLockoutUntil ? new Date(petLockoutUntil).getTime() : null;
  const chemicalAppliedToday = hasChemicalApplicationToday(userLogs, todayStr);
  const petLockoutActive =
    chemicalAppliedToday &&
    petLockoutUntilMs !== null &&
    !Number.isNaN(petLockoutUntilMs) &&
    petLockoutUntilMs > Date.now();
  const petLockoutHoursRemaining = petLockoutActive
    ? Math.max(1, Math.ceil((petLockoutUntilMs - Date.now()) / MS_PER_HOUR))
    : 0;
  const gypsumPostponedUntil = userLogs[GYPSUM_POSTPONE_KEY] ?? null;
  const gypsumSchedule = getGypsumSchedule(lastGypsumDate, gypsumPostponedUntil, todayStr);
  const {
    gypsumDue,
    gypsumDaysRemaining,
    snoozed: gypsumSnoozed,
    dueDate: gypsumDueDate,
    naturalDue: gypsumNaturalDue,
  } = gypsumSchedule;
  const daysSinceGypsum = lastGypsumDate ? daysBetween(lastGypsumDate, today) : null;

  const soilTempMinForCheck = currentSoilTempMin ?? currentSoilTemp;
  const soilTempMaxForCheck = currentSoilTemp ?? currentSoilTempMin;

  const isSoilTooColdForSeed =
    soilTempMinForCheck !== null &&
    soilTempMinForCheck < SEED_GERMINATION_SOIL_TEMP_MIN_C;
  const isSoilTooHotForSeed =
    soilTempMaxForCheck !== null &&
    soilTempMaxForCheck > SEED_GERMINATION_SOIL_TEMP_MAX_C;
  const isSoilPrimeForSeed =
    soilTempMinForCheck !== null &&
    soilTempMaxForCheck !== null &&
    !isSoilTooColdForSeed &&
    !isSoilTooHotForSeed;

  // Calendar-based dormancy: Dec, Jan, Feb = grass not actively growing.
  // Used for maintenance tasks (mow/water) independently of the manual season tab.
  const isDormantSeason = (() => {
    const month = today.getMonth() + 1; // 1–12
    return month === 12 || month === 1 || month === 2;
  })();

  // Dynamic mowing interval (days) adjusted for soil temperature, rainfall,
  // and post-seed recovery phase.
  const dynamicMowingDays = (() => {
    const temp = currentSoilTemp;
    const rain = forecastedRainSum;

    // Post-seed recovery (21–42 days after seeding): ease back in gently
    if (springSeedDate) {
      const daysSince = Math.floor(
        (today.getTime() - new Date(`${springSeedDate}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= SEED_ESTABLISHMENT_DAYS && daysSince < 42) return 14;
    }

    if ((temp !== null && temp < 8) || rain > 25) return 14;   // very cold / waterlogged
    if ((temp !== null && temp < 12) || rain > 15) return 10;  // cool / wet
    if ((temp !== null && temp > 18) && rain < 5) return 5;    // warm & dry – fast growth
    return 7;                                                   // normal growing season
  })();

  // Dynamic watering interval (days) adjusted for soil temperature, rainfall,
  // and seed establishment.
  const dynamicWateringDays = (() => {
    const temp = currentSoilTemp;
    const rain = forecastedRainSum;

    // Active seed establishment: keep the seedbed consistently moist
    if (seedEstablishmentActive) return 1;

    // Post-seed recovery (21–42 days): continued elevated watering
    if (springSeedDate) {
      const daysSince = Math.floor(
        (today.getTime() - new Date(`${springSeedDate}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= SEED_ESTABLISHMENT_DAYS && daysSince < 42) return 2;
    }

    if ((temp !== null && temp > 20) && rain < 2) return 2;  // hot & dry – high demand
    if (rain >= 5) return 5;                                  // meaningful rain – reduce need
    if (rain >= 2) return 4;                                  // light rain – slight reduction
    if (temp !== null && temp < 12) return 5;                 // cool – low evaporation
    return 3;                                                  // normal
  })();

  // Human-readable explanations surfaced in the UI for why an interval was adjusted.
  const scheduleReason = (() => {
    const temp = currentSoilTemp;
    const rain = forecastedRainSum;
    const mowReasons = [];
    const waterReasons = [];

    if (springSeedDate) {
      const daysSince = Math.floor(
        (today.getTime() - new Date(`${springSeedDate}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince >= SEED_ESTABLISHMENT_DAYS && daysSince < 42) {
        mowReasons.push('gentle recovery schedule after seeding');
        waterReasons.push('enhanced watering during turf recovery');
      }
    }

    if (seedEstablishmentActive) {
      waterReasons.push('daily watering during seed establishment');
    }

    if (temp !== null && temp > 18 && rain < 5) {
      mowReasons.push(`${temp.toFixed(0)}°C soil + dry forecast – fast growth`);
    } else if (temp !== null && temp < 10) {
      mowReasons.push(`${temp.toFixed(0)}°C soil – slower growth`);
    }

    if (rain > 5) {
      waterReasons.push(`${rain.toFixed(0)}mm forecast this week – reduced need`);
    } else if (temp !== null && temp > 20 && rain < 2) {
      waterReasons.push(`${temp.toFixed(0)}°C soil & dry forecast – increased demand`);
    }

    return {
      mow: mowReasons.length > 0 ? mowReasons.join(', ') : null,
      water: waterReasons.length > 0 ? waterReasons.join(', ') : null,
    };
  })();

  /** @param {string | null | undefined} lastDateString @param {number} daysToAdd */
  const getNextDueDate = (lastDateString, daysToAdd) => {
    if (!lastDateString) return null;
    const dueDateStr = addDaysToDateString(lastDateString, daysToAdd);
    const dueDate = startOfDay(dueDateStr);
    const weekday = UK_WEEKDAYS_LONG[dueDate.getDay()];
    const day = String(dueDate.getDate()).padStart(2, '0');
    const month = String(dueDate.getMonth() + 1).padStart(2, '0');
    const year = dueDate.getFullYear();
    return `${weekday}, ${day}/${month}/${year}`;
  };

  const mowingNextDueIso = lastMowedDate
    ? addDaysToDateString(lastMowedDate, dynamicMowingDays)
    : null;
  const wateringNextDueIso = lastWateredDate
    ? addDaysToDateString(lastWateredDate, dynamicWateringDays)
    : null;
  const mowingLockedUntilIso =
    seedEstablishmentActive && springSeedDate
      ? addDaysToDateString(springSeedDate, SEED_ESTABLISHMENT_DAYS)
      : null;

  const mowingNextDate = getNextDueDate(lastMowedDate, dynamicMowingDays);
  const wateringNextDate = getNextDueDate(lastWateredDate, dynamicWateringDays);
  const seedLockEndDate = getNextDueDate(springSeedDate, SEED_ESTABLISHMENT_DAYS);

  const activeSeasonStep =
    activeSeason.steps.find((step) => !userLogs[makeStepKey(currentSeason, step.id)]) ?? null;
  const isOnScarificationPrepStep =
    currentSeason === 'AUTUMN' && activeSeasonStep?.id === 'prep';

  let recommendedSetting =
    'Height: Setting 3 (45mm) - Standard safe maintenance cut to prevent scalping';
  if (isDormantSeason) {
    recommendedSetting = 'Height: N/A - Growth Dormant';
  } else if (currentSeason === 'SPRING' && seedEstablishmentActive) {
    recommendedSetting = 'Height: 🚫 LOCKED - Do not mow fresh seed';
  } else if (isOnScarificationPrepStep) {
    recommendedSetting = 'Height: Setting 1 (25mm) - Scalp for renovation';
  } else if (lawnSurface === 'FLAT') {
    recommendedSetting = 'Height: Setting 2 (35mm) - Standard low maintenance cut';
  } else if (lawnSurface === 'UNEVEN') {
    recommendedSetting =
      'Height: Setting 3 (45mm) - Standard safe maintenance cut to prevent scalping';
  }

  const maintenanceDueDates = {
    mowingNextDue: mowingNextDueIso,
    mowingLockedUntil: mowingLockedUntilIso,
    mowingIntervalDays: dynamicMowingDays,
    wateringNextDue: wateringNextDueIso,
    wateringIntervalDays: dynamicWateringDays,
    wateringMinutes: dynamicMinutes,
    forecastedRainSum,
    netWaterNeeded,
    currentSoilTemp,
    lastGypsumDate,
    gypsumDaysRemaining,
    gypsumDue,
    mowerModel,
    lawnSurface,
    recommendedSetting,
    mowingStatus: isDormantSeason ? 'dormant' : seedEstablishmentActive ? 'locked' : 'active',
    wateringStatus: isDormantSeason
      ? 'dormant'
      : isNatureProvidingFullSoak
        ? 'paused'
        : 'active',
    scheduleReason,
  };
  const mowingDue =
    !isDormantSeason &&
    !seedEstablishmentActive &&
    (daysSinceMow === null || daysSinceMow >= dynamicMowingDays);
  const wateringDue =
    !isDormantSeason &&
    !isNatureProvidingFullSoak &&
    (daysSinceWater === null || daysSinceWater >= dynamicWateringDays);

  const summerGranularRepeat = getGranularRepeatDate('SUMMER', userLogs);
  const granularRepeatDue =
    summerGranularRepeat !== null &&
    daysBetween(summerGranularRepeat, todayStr) >= 0;

  const recascadeSeason = useCallback(
    (seasonKey, anchorDate, logs) => {
      setPendingDates((prev) => ({
        ...prev,
        [seasonKey]: cascadeSeasonDates(seasonKey, anchorDate, logs, prev),
      }));
    },
    []
  );

  const compileLawnTasksExport = useCallback(
    (overrides = {}) => {
      const nextLastMowedDate =
        overrides.lastMowedDate !== undefined ? overrides.lastMowedDate : lastMowedDate;
      const nextLastWateredDate =
        overrides.lastWateredDate !== undefined ? overrides.lastWateredDate : lastWateredDate;
      const nextLastGypsumDate =
        overrides.lastGypsumDate !== undefined ? overrides.lastGypsumDate : lastGypsumDate;
      const nextGypsumPostponedUntil =
        overrides.gypsumPostponedUntil !== undefined
          ? overrides.gypsumPostponedUntil
          : userLogs[GYPSUM_POSTPONE_KEY] ?? null;

      const nextMowingNextDueIso = nextLastMowedDate
        ? addDaysToDateString(nextLastMowedDate, dynamicMowingDays)
        : null;
      const nextWateringNextDueIso = nextLastWateredDate
        ? addDaysToDateString(nextLastWateredDate, dynamicWateringDays)
        : null;

      return compileAllLawnTasks({
        todayStr,
        userLogs,
        pendingDates,
        isDormantSeason,
        isNatureProvidingFullSoak,
        seedEstablishmentActive,
        mowingLockedUntilIso,
        mowingNextDueIso: nextMowingNextDueIso,
        wateringNextDueIso: nextWateringNextDueIso,
        lastGypsumDate: nextLastGypsumDate,
        gypsumPostponedUntil: nextGypsumPostponedUntil,
        scheduleReason,
      });
    },
    [
      lastMowedDate,
      lastWateredDate,
      lastGypsumDate,
      todayStr,
      userLogs,
      pendingDates,
      isDormantSeason,
      isNatureProvidingFullSoak,
      seedEstablishmentActive,
      mowingLockedUntilIso,
      scheduleReason,
      dynamicMowingDays,
      dynamicWateringDays,
    ]
  );

  const pushLawnTasksToSupabase = useCallback(
    async (overrides = {}, options = {}) => {
      const { quiet = true, force = false } = options;
      const compiledTasks = compileLawnTasksExport(overrides);
      const fingerprint = JSON.stringify(compiledTasks);

      if (
        !force &&
        (syncInFlightRef.current || fingerprint === lastSyncFingerprintRef.current)
      ) {
        setLawnTasksSnapshot(compiledTasks);
        return;
      }

      syncInFlightRef.current = true;
      setLawnTasksSnapshot(compiledTasks);
      if (!quiet) {
        setCloudSyncStatus('pushing');
      }

      try {
        const syncedMow =
          overrides.lastMowedDate !== undefined ? overrides.lastMowedDate : lastMowedDate;
        const syncedWater =
          overrides.lastWateredDate !== undefined ? overrides.lastWateredDate : lastWateredDate;

        await syncLawnTasksToSupabase(
          compiledTasks,
          {
            lastMowedDate: syncedMow,
            lastWateredDate: syncedWater,
          },
          todayStr
        );

        try {
          await saveLawnScheduleSnapshot(
            {
              lastMowedDate: syncedMow,
              lastWateredDate: syncedWater,
              mowingNextDueIso: mowingNextDueIso ?? null,
              wateringNextDueIso: wateringNextDueIso ?? null,
              forecastedRainSum,
              currentSoilTemp: currentSoilTemp ?? null,
              isNatureProvidingFullSoak,
              pendingDates,
            },
            userLogs
          );
          await saveLawnWeatherSnapshot({
            forecastedRainSum,
            currentSoilTemp: currentSoilTemp ?? null,
            currentSoilTempMin: currentSoilTempMin ?? null,
            isRainForecasted,
            isNatureProvidingFullSoak,
            netWaterNeeded,
            fetchedAt: new Date().toISOString(),
            source: 'open-meteo',
          });
        } catch (snapshotError) {
          console.warn('[Lawn Care] Schedule snapshot save failed:', snapshotError);
        }

        lastSyncFingerprintRef.current = fingerprint;
        setSupabaseSyncError(null);
        setLastCloudSyncAt(new Date());
        setCloudSyncStatus('synced');
        setMaintenanceHints({ mow: null, water: null });
      } catch (error) {
        console.error('[Lawn Care] Supabase sync failed:', error);
        setCloudSyncStatus('error');
        if (isMissingLastCompletedColumnError(error)) {
          setSupabaseSyncError(getLastCompletedColumnHint());
        } else {
          setSupabaseSyncError(formatSupabaseSyncError(error));
        }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [
      compileLawnTasksExport,
      lastMowedDate,
      lastWateredDate,
      userLogs,
      pendingDates,
      forecastedRainSum,
      currentSoilTemp,
      isNatureProvidingFullSoak,
    ]
  );

  const pullCloudState = useCallback(async () => {
    if (getSupabaseConfigError()) return null;

    const supabase = getSupabase();
    if (supabase) {
      const linked = await probeLastCompletedColumn(supabase);
      if (!linked) {
        setSupabaseSyncError(getLastCompletedColumnHint());
      }
    }

    let nextUserLogs = stripStalePetLockout(readStoredJson('lawnPackUserLogs', {}), todayStr);
    let nextMow = localStorage.getItem('lawnPackLastMowedDate');
    let nextWater = localStorage.getItem('lawnPackLastWateredDate');
    let inboundPack = 0;
    let inboundMaintenance = false;

    try {
      const remote = await fetchLawnUserLogsFromSupabase();
      if (remote !== null) {
        nextUserLogs = stripStalePetLockout(mergeLawnUserLogs(remote, nextUserLogs), todayStr);
      } else {
        setSupabaseSyncError((prev) => prev ?? getLawnAppStateSetupHint());
      }
    } catch (error) {
      console.warn('[Lawn Care] Lawn pack state pull failed:', error);
    }

    try {
      const rows = await fetchLawnTasksForInboundSync();
      const inbound = applyInboundTaskCompletions(rows, todayStr, nextUserLogs, {
        lastMowedDate: nextMow,
        lastWateredDate: nextWater,
      });
      nextUserLogs = stripStalePetLockout(inbound.userLogs, todayStr);
      nextMow = inbound.lastMowedDate ?? nextMow;
      nextWater = inbound.lastWateredDate ?? nextWater;
      inboundPack = inbound.packStepsUpdated;
      inboundMaintenance = inbound.maintenanceUpdated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Lawn Care] Task inbound pull failed:', error);
      if (!isMissingLastCompletedColumnError(error)) {
        setSupabaseSyncError(`Could not load tasks from shared database: ${message}`);
      }
    }

    try {
      const inferred = await pullMaintenanceDatesFromSupabase(todayStr);
      if (inferred.lastMowedDate) {
        nextMow = mergeMaintenanceDate(nextMow, inferred.lastMowedDate);
        inboundMaintenance = true;
      }
      if (inferred.lastWateredDate) {
        nextWater = mergeMaintenanceDate(nextWater, inferred.lastWateredDate);
        inboundMaintenance = true;
      }

      if (inboundMaintenance) {
        setMaintenanceHints({
          mow: nextMow ? `Last mow updated from shared log (${formatDisplayDate(nextMow)}).` : null,
          water: nextWater
            ? `Last water updated from shared log (${formatDisplayDate(nextWater)}).`
            : null,
        });
      } else {
        setMaintenanceHints({ mow: null, water: null });
      }
    } catch (error) {
      console.warn('[Lawn Care] Maintenance pull failed:', error);
    }

    setUserLogs(nextUserLogs);
    localStorage.setItem('lawnPackUserLogs', JSON.stringify(nextUserLogs));
    if (nextMow) setLastMowedDate(nextMow);
    if (nextWater) setLastWateredDate(nextWater);

    try {
      await saveLawnUserLogsToSupabase(nextUserLogs);
    } catch (error) {
      console.warn('[Lawn Care] Lawn pack state save failed:', error);
    }

    const supabaseClient = getSupabase();
    if (supabaseClient && (await probeLastCompletedColumn(supabaseClient))) {
      setSupabaseSyncError((prev) =>
        prev?.includes('maintenance_link.sql') || prev?.includes('lawn_app_state.sql')
          ? prev
          : null
      );
    }

    return { inboundPack, inboundMaintenance };
  }, [todayStr]);

  const runFullCloudSync = useCallback(
    async (options = {}) => {
      const { forcePush = true } = options;
      if (getSupabaseConfigError()) {
        setCloudSyncStatus('error');
        return;
      }

      setCloudSyncStatus('pulling');
      try {
        await pullCloudState();
        if (forcePush) {
          lastSyncFingerprintRef.current = '';
          await pushLawnTasksToSupabase({}, { quiet: false, force: true });
        } else {
          setLastCloudSyncAt(new Date());
          setCloudSyncStatus('synced');
        }
      } catch (error) {
        console.error('[Lawn Care] Cloud sync failed:', error);
        setCloudSyncStatus('error');
      }
    },
    [pullCloudState, pushLawnTasksToSupabase]
  );

  const handleCopyTasksJson = async () => {
    try {
      const payload = await fetchLawnTasksFromSupabase();
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      const fallback = lawnTasksSnapshot.length > 0 ? lawnTasksSnapshot : compileLawnTasksExport();
      try {
        await navigator.clipboard.writeText(JSON.stringify(fallback, null, 2));
        setJsonCopied(true);
        setTimeout(() => setJsonCopied(false), 2000);
      } catch {
        setJsonCopied(false);
      }
    }
  };

  useEffect(() => {
    setSqm(length * width);
  }, [length, width]);

  useEffect(() => {
    if (seasonManuallySelected) return;
    setCurrentSeason(getWorkflowSeasonForDate(todayStr, userLogs));
  }, [todayStr, seasonManuallySelected, userLogs]);

  useEffect(() => {
    if (!userLogsHydrated) return;

    const sanitized = stripStalePetLockout(userLogs, todayStr);
    if (sanitized !== userLogs) {
      setUserLogs(sanitized);
      return;
    }

    localStorage.setItem('lawnPackUserLogs', JSON.stringify(userLogs));

    if (userLogsSaveTimerRef.current) {
      clearTimeout(userLogsSaveTimerRef.current);
    }

    userLogsSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        if (getSupabaseConfigError()) return;
        const saved = await saveLawnUserLogsToSupabase(userLogs);
        if (saved === false) {
          setSupabaseSyncError((prev) =>
            prev?.includes('maintenance_link.sql') ? prev : getLawnAppStateSetupHint()
          );
        }
      })();
    }, 800);

    return () => {
      if (userLogsSaveTimerRef.current) {
        clearTimeout(userLogsSaveTimerRef.current);
      }
    };
  }, [userLogs, userLogsHydrated]);

  useEffect(() => {
    if (lastMowedDate) {
      localStorage.setItem('lawnPackLastMowedDate', lastMowedDate);
    } else {
      localStorage.removeItem('lawnPackLastMowedDate');
    }
  }, [lastMowedDate]);

  useEffect(() => {
    if (lastWateredDate) {
      localStorage.setItem('lawnPackLastWateredDate', lastWateredDate);
    } else {
      localStorage.removeItem('lawnPackLastWateredDate');
    }
  }, [lastWateredDate]);

  useEffect(() => {
    if (!enlargedSprinkler) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') setEnlargedSprinkler(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [enlargedSprinkler]);

  useEffect(() => {
    localStorage.setItem('lawnPackSelectedSprinkler', selectedSprinkler);
  }, [selectedSprinkler]);

  useEffect(() => {
    localStorage.setItem('lawnPackMowerModel', mowerModel);
  }, [mowerModel]);

  useEffect(() => {
    localStorage.setItem('lawnPackLawnSurface', lawnSurface);
  }, [lawnSurface]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromSupabase() {
      await pullCloudState();
      if (cancelled) return;
      setUserLogsHydrated(true);
      setMaintenanceHydrated(true);
      lastSyncFingerprintRef.current = '';
      await pushLawnTasksToSupabase({}, { quiet: true, force: true });
    }

    void hydrateFromSupabase();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runFullCloudSync();
      }
    };

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runFullCloudSync]);

  useEffect(() => {
    if (!maintenanceHydrated) return;

    const timer = setTimeout(() => {
      void pushLawnTasksToSupabase({}, { quiet: true });
    }, 600);

    return () => clearTimeout(timer);
  }, [
    maintenanceHydrated,
    userLogsHydrated,
    lastMowedDate,
    lastWateredDate,
    lastGypsumDate,
    userLogs,
    pendingDates,
    currentSeason,
    isDormantSeason,
    isNatureProvidingFullSoak,
    seedEstablishmentActive,
    forecastedRainSum,
    compileLawnTasksExport,
  ]);

  const applyWeatherSnapshot = useCallback((snapshot) => {
    setForecastedRainSum(snapshot.forecastedRainSum);
    setCurrentSoilTemp(snapshot.currentSoilTemp);
    setCurrentSoilTempMin(snapshot.currentSoilTempMin);
    setIsRainForecasted(snapshot.isRainForecasted);
    setWeatherStatus('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setWeatherStatus('loading');

      let cached = null;
      try {
        cached = await fetchLawnWeatherSnapshotFromSupabase();
        if (!cancelled && cached && isWeatherSnapshotFresh(cached.fetchedAt, 3)) {
          applyWeatherSnapshot(cached);
        }
      } catch {
        /* use live fetch below */
      }

      try {
        const snapshot = await fetchLawnWeatherFromOpenMeteo();
        if (cancelled) return;

        applyWeatherSnapshot(snapshot);
        try {
          await saveLawnWeatherSnapshot(snapshot);
        } catch (saveError) {
          console.warn('[Lawn Care] Weather snapshot save failed:', saveError);
        }
      } catch (fetchError) {
        console.warn('[Lawn Care] Live weather fetch failed:', fetchError);
        if (!cancelled) {
          if (cached) {
            applyWeatherSnapshot(cached);
            setWeatherStatus('ready');
          } else {
            setWeatherStatus('error');
          }
        }
      }
    }

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [applyWeatherSnapshot]);

  const handlePendingDateChange = (stepId, value) => {
    const steps = SEASONS[currentSeason].steps;
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isFirstStep = stepIndex === 0;

    setPendingDates((prev) => {
      const nextSeason = { ...prev[currentSeason], [stepId]: value };

      if (isFirstStep) {
        const cascaded = cascadeSeasonDates(currentSeason, value, userLogs, {
          ...prev,
          [currentSeason]: nextSeason,
        });
        return { ...prev, [currentSeason]: cascaded };
      }

      return { ...prev, [currentSeason]: nextSeason };
    });
  };

  const handleLogTask = (stepId) => {
    const dateValue = pendingDates[currentSeason]?.[stepId];
    if (!dateValue) return;

    const steps = SEASONS[currentSeason].steps;
    const step = steps.find((s) => s.id === stepId);
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isFirstStep = stepIndex === 0;

    const nextLogs = {
      ...userLogs,
      [makeStepKey(currentSeason, stepId)]: dateValue,
    };

    if (step && stepTriggersPetLockout(step)) {
      if (dateValue === todayStr) {
        nextLogs[PET_LOCKOUT_KEY] = new Date(
          Date.now() + PET_LOCKOUT_HOURS * MS_PER_HOUR
        ).toISOString();
      } else {
        delete nextLogs[PET_LOCKOUT_KEY];
      }
    }

    setUserLogs(nextLogs);
    lastSyncFingerprintRef.current = '';
    void pushLawnTasksToSupabase({}, { quiet: true, force: true });

    if (isFirstStep) {
      recascadeSeason(currentSeason, dateValue, nextLogs);
    } else {
      const anchor = getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);
      recascadeSeason(currentSeason, anchor, nextLogs);
    }
  };

  const handleClearLog = (stepId) => {
    const key = makeStepKey(currentSeason, stepId);
    const step = SEASONS[currentSeason].steps.find((s) => s.id === stepId);
    const nextLogs = { ...userLogs };
    delete nextLogs[key];
    setUserLogs(nextLogs);

    if (step) {
      void clearLawnTaskCompletion(step.label).then(() => {
        lastSyncFingerprintRef.current = '';
        void pushLawnTasksToSupabase({}, { quiet: true, force: true });
      });
    }

    const isFirstStep = SEASONS[currentSeason].steps[0].id === stepId;
    const anchor = isFirstStep
      ? SEASON_START_DATES[currentSeason]
      : getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);

    recascadeSeason(currentSeason, anchor, nextLogs);
  };

  const showsWeedolAdvisory = (step) =>
    currentSeason === 'SPRING' &&
    weedolLoggedDate !== null &&
    step.id !== 'weedol' &&
    !userLogs[makeStepKey('SPRING', step.id)] &&
    (weedolBarrierActive || ['prep', 'seed'].includes(step.id));

  const weedolClearanceLabel = weedolClearanceDate
    ? formatDisplayDate(weedolClearanceDate)
    : null;

  const weatherStatusText =
    weatherStatus === 'loading'
      ? 'Fetching 7-day rainfall forecast…'
      : weatherStatus === 'error'
        ? '⚠️ Forecast unavailable — tap Sync to retry'
        : isRainForecasted
          ? '🌧️ Rain Forecasted - Watering Paused'
          : '☀️ Dry Week Predicted - Timers Active';

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl m-4 p-6 border border-green-100">
      {activeScreen === 'settings' ? (
        <>
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h2 className="text-xl font-black text-green-800">⚙️ Lawn Setup</h2>
              <p className="text-sm text-green-700 mt-1">
                Configure your lawn size, equipment, and surface profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('main')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-all"
            >
              ← Back to Workflow
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-green-900 mb-1">
                Lawn Length: <span className="font-bold text-green-700">{length}m</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={length}
                onChange={(e) => setLength(parseInt(e.target.value, 10))}
                className="w-full accent-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-900 mb-1">
                Lawn Width: <span className="font-bold text-green-700">{width}m</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                className="w-full accent-green-600"
              />
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800">
              <span className="font-black">{sqm} SQM</span>
              <span className="text-green-600 ml-1.5">({length}m × {width}m)</span>
            </div>
            <div>
              <label htmlFor="mower-select" className="block text-sm font-medium text-green-900 mb-1">
                Lawnmower Model
              </label>
              <select
                id="mower-select"
                value={mowerModel}
                onChange={(e) => setMowerModel(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-700 font-medium focus:ring-2 focus:ring-green-500"
              >
                {Object.values(MOWER_OPTIONS).map((mower) => (
                  <option key={mower.id} value={mower.id}>
                    {mower.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mb-2">
                <p className="text-sm font-medium text-green-900">Lawn Surface Condition</p>
                <button
                  type="button"
                  onClick={() => setShowLevellingGuide((open) => !open)}
                  aria-expanded={showLevellingGuide}
                  className="ml-2 text-emerald-600 hover:text-emerald-800 text-xs underline font-medium"
                >
                  ℹ️ How to fix a bumpy lawn
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(LAWN_SURFACE_OPTIONS).map((option) => {
                  const isSelected = lawnSurface === option.id;

                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-green-600 bg-green-100/80 text-green-900 ring-1 ring-green-500/30'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="lawn-surface"
                        value={option.id}
                        checked={isSelected}
                        onChange={(e) => setLawnSurface(e.target.value)}
                        className="accent-green-600"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  showLevellingGuide
                    ? 'grid-rows-[1fr] opacity-100 mt-3'
                    : 'grid-rows-[0fr] opacity-0 mt-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">Lawn Levelling Guide</h4>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          Choose the method that matches your dip depth. Once levelled, switch your
                          surface setting to &ldquo;Perfectly Flat / Smooth&rdquo; for a lower cut
                          height recommendation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLevellingGuide(false)}
                        className="shrink-0 text-xs font-bold text-gray-400 hover:text-gray-600"
                        aria-label="Close levelling guide"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-3">
                      {LEVELLING_GUIDE_METHODS.map((method) => (
                        <div
                          key={method.title}
                          className="rounded-lg border border-green-100 bg-green-50/40 p-3.5"
                        >
                          <p className="text-xs font-bold text-green-900 mb-1.5">{method.title}</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{method.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="equipment-select" className="block text-sm font-bold text-gray-700 mb-1.5">
                Application Tool Profile:
              </label>
              <select
                id="equipment-select"
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-700 font-medium focus:ring-2 focus:ring-green-500"
              >
                {Object.values(EQUIPMENT_OPTIONS).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="block text-sm font-bold text-gray-700 mb-1">
                Irrigation Profile — Select Your Primary Sprinkler:
              </p>
              <p className="text-[11px] text-gray-500 mb-2 leading-snug">
                Match the photo and description to the sprinkler you own. Tap a photo to enlarge it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(SPRINKLER_OPTIONS).map((sprinkler) => {
                  const isSelected = selectedSprinkler === sprinkler.id;

                  return (
                    <button
                      key={sprinkler.id}
                      type="button"
                      onClick={() => setSelectedSprinkler(sprinkler.id)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        isSelected
                          ? 'border-green-600 bg-green-100/80 shadow-sm ring-1 ring-green-500/30'
                          : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                      }`}
                    >
                      <img
                        src={sprinkler.image}
                        alt={sprinkler.name}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEnlargedSprinkler({
                            image: sprinkler.image,
                            name: sprinkler.name,
                          });
                        }}
                        className="w-16 h-16 object-cover rounded-md mb-2 mx-auto border border-gray-200 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                      />
                      <span className="text-xs font-bold text-gray-900 leading-snug block">
                        {sprinkler.name}
                      </span>
                      <span className="text-[10px] font-semibold text-green-700 block mb-1.5">
                        ~{sprinkler.ratePerHour}mm / hour
                      </span>
                      <p className="text-[10px] text-gray-700 leading-snug mb-1">
                        {sprinkler.description}
                      </p>
                      <p className="text-[10px] text-gray-500 leading-snug italic">
                        {sprinkler.identification}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-green-200 pt-4 mt-2">
              <p className="text-sm font-bold text-gray-700 mb-2">Developer / Debug Mode</p>
              {supabaseSyncError && (
                <p className="mb-2 text-[11px] font-medium text-red-700">{supabaseSyncError}</p>
              )}
              <button
                type="button"
                onClick={handleCopyTasksJson}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
              >
                {jsonCopied ? 'Copied!' : '📋 Copy Live JSON Payload to Clipboard'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {supabaseSyncError && (
            <div
              className={`mb-4 rounded-lg border p-3 text-xs font-semibold leading-relaxed ${
                supabaseSyncError.includes('maintenance_link.sql')
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {supabaseSyncError.includes('maintenance_link.sql') ||
              supabaseSyncError.includes('lawn_app_state.sql') ? (
                <>
                  <p className="font-bold mb-1">One-time database setup</p>
                  <p>{supabaseSyncError}</p>
                  {supabaseSyncError.includes('lawn_app_state.sql') ? (
                    <p className="mt-2 text-[10px]">
                      Run the SQL file <strong>supabase/lawn_app_state.sql</strong> in Supabase (creates
                      the lawn progress table).
                    </p>
                  ) : (
                    <p className="mt-2 font-mono text-[10px] break-all">
                      alter table public.tasks add column if not exists last_completed_date date;
                    </p>
                  )}
                </>
              ) : (
                <>Supabase sync failed: {supabaseSyncError}</>
              )}
            </div>
          )}
          {petLockoutActive && (
            <div className="mb-4 rounded-lg border border-orange-300 bg-gradient-to-r from-red-50 to-orange-50 p-3 text-sm font-bold text-orange-900 shadow-sm">
              🚫 PAWS OFF: Chemical drying in progress. Safe in {petLockoutHoursRemaining} hour
              {petLockoutHoursRemaining !== 1 ? 's' : ''}.
            </div>
          )}
          {springPackIncomplete && currentSeason !== 'SPRING' && (
            <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 leading-relaxed">
              <p className="font-bold mb-1">
                📋 Spring Pack still in progress ({incompleteSpringSteps.length} step
                {incompleteSpringSteps.length !== 1 ? 's' : ''} left)
              </p>
              <p className="mb-2">
                The calendar says {SEASONS[calendarSeason].name}, but you have unfinished Spring
                work — we won&apos;t skip ahead until those steps are logged.
              </p>
              {weedolLoggedDate && springRenovationPending && (
                <p className="mb-2 font-semibold">
                  {weedolBarrierActive ? (
                    <>
                      ⏳ Weedol barrier: scarify &amp; seed locked until{' '}
                      <strong>{formatDisplayDate(weedolClearanceDate)}</strong> (
                      {weedolDaysRemaining} day{weedolDaysRemaining !== 1 ? 's' : ''} left).
                    </>
                  ) : (
                    <>
                      ✅ Weedol clearance passed ({formatDisplayDate(weedolClearanceDate)}) —
                      you can scarify and seed when ready.
                    </>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setCurrentSeason('SPRING');
                  setSeasonManuallySelected(true);
                }}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                Open Spring Pack timeline
              </button>
            </div>
          )}
          {currentSeason === 'SPRING' && isCatchUpMode && !seasonManuallySelected && (
            <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 leading-relaxed">
              📅 Catch-up mode: calendar is {SEASONS[calendarSeason].name}, but Spring Pack steps
              remain — complete them before Summer tasks unlock here.
              {weedolBarrierActive && springRenovationPending && weedolClearanceDate && (
                <span className="block mt-1 font-bold text-amber-900">
                  ⏳ Weedol barrier until {formatDisplayDate(weedolClearanceDate)} — prep &amp; seed
                  steps below show the countdown.
                </span>
              )}
            </div>
          )}
          <div className="flex justify-between items-start gap-2 mb-6 border-b pb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-green-800">📋 Lawn Pack Workflow</h2>
              <p className="text-sm text-green-700 mt-1">
                <span className="font-black">{sqm} SQM</span>
                <span className="text-green-600 ml-1.5">({length}m × {width}m)</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void runFullCloudSync()}
                disabled={cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing'}
                title={
                  cloudSyncStatus === 'synced' && lastCloudSyncAt
                    ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)} — tap to refresh`
                    : cloudSyncStatus === 'error'
                      ? 'Sync problem — tap to retry'
                      : 'Sync schedule to cloud'
                }
                className={`flex flex-col items-center justify-center min-w-[2.75rem] py-1 px-2 rounded-lg border text-[10px] font-bold leading-tight transition-all disabled:opacity-60 ${
                  cloudSyncStatus === 'synced'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : cloudSyncStatus === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Sync with shared database"
              >
                <span
                  className={`text-base leading-none ${
                    cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing'
                      ? 'inline-block animate-spin'
                      : ''
                  }`}
                >
                  {cloudSyncStatus === 'synced' ? '☁️✓' : cloudSyncStatus === 'error' ? '☁️!' : '☁️↻'}
                </span>
                <span>
                  {cloudSyncStatus === 'pulling'
                    ? 'Pull…'
                    : cloudSyncStatus === 'pushing'
                      ? 'Push…'
                      : cloudSyncStatus === 'synced'
                        ? 'Synced'
                        : cloudSyncStatus === 'error'
                          ? 'Retry'
                          : 'Sync'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('settings')}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-all"
              >
                ⚙️ Setup
              </button>
            </div>
          </div>
      <section
        id="maintenance-panel"
        data-maintenance-due-dates={JSON.stringify(maintenanceDueDates)}
        data-app-source={LAWN_APP_SOURCE}
        data-pet-lockout-until={petLockoutUntil ?? ''}
        className="mb-6 rounded-xl border border-sky-100 bg-sky-50/40 p-4"
      >
        <h3 className="text-sm font-bold text-gray-800 mb-3">🔧 Maintenance Panel</h3>

        <div
          className={`mb-3 rounded-lg border p-3 text-xs font-semibold ${
            weatherStatus === 'loading'
              ? 'bg-gray-50 border-gray-200 text-gray-700'
              : isRainForecasted
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          🌦️ 7-Day Weather Radar: {weatherStatusText}
        </div>

        <div
          id="environmental-status-card"
          data-current-soil-temp={currentSoilTemp ?? ''}
          data-current-soil-temp-min={currentSoilTempMin ?? ''}
          data-soil-seed-ready={isSoilPrimeForSeed ? 'true' : 'false'}
          className={`mb-3 rounded-lg border p-3 ${
            weatherStatus === 'loading'
              ? 'bg-gray-50 border-gray-200'
              : isSoilTooColdForSeed
                ? 'bg-red-50 border-red-200'
                : isSoilTooHotForSeed
                  ? 'bg-amber-50 border-amber-200'
                  : isSoilPrimeForSeed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-xs font-bold text-gray-800 mb-2">🌡️ Environmental Status</p>
          {weatherStatus === 'loading' ? (
            <p className="text-xs font-medium text-gray-600 leading-snug">
              Fetching 10cm soil temperature…
            </p>
          ) : currentSoilTemp === null && currentSoilTempMin === null ? (
            <p className="text-xs font-medium text-gray-600 leading-snug">
              Soil temperature unavailable. Check your connection and refresh.
            </p>
          ) : (
            <>
              {currentSoilTemp !== null && (
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  Today&apos;s 10cm soil max:{' '}
                  <span className="font-black text-gray-900">{currentSoilTemp.toFixed(1)}°C</span>
                </p>
              )}
              {currentSoilTempMin !== null && (
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Today&apos;s 10cm soil min:{' '}
                  <span className="font-black text-gray-900">{currentSoilTempMin.toFixed(1)}°C</span>
                </p>
              )}
              {isSoilTooColdForSeed ? (
                <p className="text-xs font-bold text-red-800 leading-snug">
                  🔴 Too cold — wait for {SEED_GERMINATION_SOIL_TEMP_MIN_C}°C+
                </p>
              ) : isSoilTooHotForSeed ? (
                <p className="text-xs font-bold text-amber-900 leading-snug">
                  🟠 Too warm — outside ideal range (max {SEED_GERMINATION_SOIL_TEMP_MAX_C}°C)
                </p>
              ) : (
                <p className="text-xs font-bold text-emerald-800 leading-snug">
                  🟢 Prime germination window ({SEED_GERMINATION_SOIL_TEMP_MIN_C}–
                  {SEED_GERMINATION_SOIL_TEMP_MAX_C}°C)
                </p>
              )}
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
          <div
            id="maintenance-mowing-tracker"
            data-maintenance-due-dates={JSON.stringify(maintenanceDueDates)}
            data-next-mow-due={mowingNextDueIso ?? ''}
            data-mow-locked-until={mowingLockedUntilIso ?? ''}
            data-mow-status={maintenanceDueDates.mowingStatus}
            data-mower-model={mowerModel}
            data-lawn-surface={lawnSurface}
            data-recommended-mower-setting={recommendedSetting}
            className={`flex flex-col rounded-lg border p-3 ${
              isDormantSeason
                ? 'bg-gray-100 border-gray-300 text-gray-500'
                : seedEstablishmentActive
                  ? 'bg-red-50 border-red-300'
                  : mowingDue
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
            }`}
          >
            <p className="text-xs font-bold text-gray-800 mb-1">✂️ Mowing Tracker</p>

            <div className="min-h-[2.75rem] mb-3">
              {isDormantSeason ? (
                <>
                  <p className="text-xs font-medium leading-snug">
                    ❄️ WINTER DORMANT: Mowing suspended – grass not actively growing.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-gray-600">
                    Next Due: N/A (Dormant)
                  </p>
                </>
              ) : seedEstablishmentActive ? (
                <>
                  <p className="text-xs font-bold text-red-900 leading-snug">
                    🌱 SEED ESTABLISHING: Absolutely NO mowing for 21 days! ({seedDaysRemaining}{' '}
                    day{seedDaysRemaining !== 1 ? 's' : ''} remaining)
                  </p>
                  <p className="mt-2 text-xs font-semibold text-red-800">
                    Next Due: Locked until {seedLockEndDate}
                  </p>
                </>
              ) : mowingDue ? (
                <>
                  <p className="text-xs font-bold text-amber-900 leading-snug">
                    🚨 MOWING DUE: It has been {formatDaysSinceLabel(daysSinceMow)} since your last
                    cut.
                  </p>
                  {lastMowedDate ? (
                    <p className="mt-1 text-xs text-gray-600">
                      Last cut: {formatDisplayDate(lastMowedDate)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-600">
                      No cut logged here yet — use Log below.
                    </p>
                  )}
                  {maintenanceHints.mow && (
                    <p className="mt-1 text-xs font-medium text-emerald-800">{maintenanceHints.mow}</p>
                  )}
                  {scheduleReason.mow && (
                    <p className="mt-1 text-xs text-blue-700 italic">
                      📊 {dynamicMowingDays}-day interval: {scheduleReason.mow}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-600 leading-snug">
                    Last cut:{' '}
                    {lastMowedDate
                      ? `${formatDisplayDate(lastMowedDate)} (${formatDaysSinceLabel(daysSinceMow)} ago)`
                      : 'not logged yet'}
                  </p>
                  {maintenanceHints.mow && (
                    <p className="mt-1 text-xs font-medium text-emerald-800">{maintenanceHints.mow}</p>
                  )}
                  {scheduleReason.mow && (
                    <p className="mt-1 text-xs text-blue-700 italic">
                      📊 {dynamicMowingDays}-day interval: {scheduleReason.mow}
                    </p>
                  )}
                  {mowingNextDate && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-semibold">
                      📅 Next Cut Due: {mowingNextDate}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mb-3">
              <p
                className={`text-xs leading-snug ${
                  currentSeason === 'SPRING' && seedEstablishmentActive
                    ? 'font-bold text-red-800'
                    : isOnScarificationPrepStep
                      ? 'font-bold text-amber-900'
                      : isDormantSeason
                        ? 'font-medium text-gray-500'
                        : 'font-medium text-gray-600'
                }`}
              >
                {recommendedSetting}
              </p>
            </div>

            <div className="mt-auto space-y-2">
              <div>
                <label
                  htmlFor="mow-log-date"
                  className="block text-xs font-semibold text-gray-600 mb-1"
                >
                  Log Date (DD/MM/YYYY)
                </label>
                <UkDateInput
                  id="mow-log-date"
                  value={pendingMowLogDate}
                  max={todayStr}
                  onChange={setPendingMowLogDate}
                  disabled={isDormantSeason || seedEstablishmentActive}
                  className="w-full min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingMowLogDate) return;
                  const loggedDate = pendingMowLogDate;
                  setLastMowedDate(loggedDate);
                  setPendingMowLogDate(todayStr);
                  void pushLawnTasksToSupabase({ lastMowedDate: loggedDate }, { quiet: true });
                  setMaintenanceHints((prev) => ({ ...prev, mow: null }));
                }}
                disabled={isDormantSeason || seedEstablishmentActive || !pendingMowLogDate}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✂️ Log
              </button>
            </div>
          </div>

          <div
            id="maintenance-watering-tracker"
            data-next-water-due={wateringNextDueIso ?? ''}
            data-water-minutes={dynamicMinutes}
            data-forecasted-rain-sum={forecastedRainSum}
            data-net-water-needed={netWaterNeeded}
            data-water-status={maintenanceDueDates.wateringStatus}
            className={`flex flex-col rounded-lg border p-3 ${
              isDormantSeason
                ? 'bg-gray-100 border-gray-300 text-gray-500'
                : isNatureProvidingFullSoak
                  ? 'bg-sky-100 border-sky-300 text-sky-900'
                  : wateringDue
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
            }`}
          >
            <p className="text-xs font-bold text-gray-800 mb-1">🚰 Watering Tracker</p>

            <div className={`mb-3 ${wateringDue ? 'min-h-[6rem]' : 'min-h-[2.75rem]'}`}>
              {isDormantSeason ? (
                <>
                  <p className="text-xs font-medium leading-snug">
                    ❄️ WINTER DORMANT: Watering suspended – frost risk.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-gray-600">Next Due: N/A</p>
                </>
              ) : isNatureProvidingFullSoak ? (
                <>
                  <p className="text-xs font-bold leading-snug">
                    🌧️ NATURE HAS IT: Heavy rain inbound. Timers paused.
                  </p>
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 font-semibold">
                    🌧️ Next Water: Paused (Nature is providing a full 10mm+ soak this week!)
                  </div>
                </>
              ) : wateringDue ? (
                <>
                  <p className="text-xs font-bold text-amber-900 leading-snug">
                    🚰 IRRIGATION DUE: The soil needs a {netWaterNeeded.toFixed(1)}mm soak. Based on
                    your location&apos;s weather, turn on your {activeSprinkler.name} for exactly{' '}
                    {dynamicMinutes} minutes to achieve optimal root depth without wasting water.
                  </p>
                  {lastWateredDate ? (
                    <p className="mt-1 text-xs text-gray-600">
                      Last water: {formatDisplayDate(lastWateredDate)} (
                      {formatDaysSinceLabel(daysSinceWater)} ago)
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-600">
                      No watering logged here yet — use Log below.
                    </p>
                  )}
                  {maintenanceHints.water && (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      {maintenanceHints.water}
                    </p>
                  )}
                  {scheduleReason.water && (
                    <p className="mt-1 text-xs text-blue-700 italic">
                      📊 {dynamicWateringDays}-day interval: {scheduleReason.water}
                    </p>
                  )}
                  {DECKING_EDGE_WATERING_SUBTASK}
                  {wateringNextDate && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 font-semibold">
                      🚰 Next Water Due: {wateringNextDate} ({dynamicMinutes} min soak).{' '}
                      <span className="font-medium italic">
                        *Adjusted for {forecastedRainSum.toFixed(1)}mm of forecasted rain over the
                        next 7 days.*
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-600 leading-snug">
                    Last water:{' '}
                    {lastWateredDate
                      ? `${formatDisplayDate(lastWateredDate)} (${formatDaysSinceLabel(daysSinceWater)} ago)`
                      : 'not logged yet'}
                  </p>
                  {maintenanceHints.water && (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      {maintenanceHints.water}
                    </p>
                  )}
                  {scheduleReason.water && (
                    <p className="mt-1 text-xs text-blue-700 italic">
                      📊 {dynamicWateringDays}-day interval: {scheduleReason.water}
                    </p>
                  )}
                  {wateringNextDate && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 font-semibold">
                      🚰 Next Water Due: {wateringNextDate} ({dynamicMinutes} min soak).{' '}
                      <span className="font-medium italic">
                        *Adjusted for {forecastedRainSum.toFixed(1)}mm of forecasted rain over the
                        next 7 days.*
                      </span>
                    </div>
                  )}
                  {DECKING_EDGE_WATERING_SUBTASK}
                </>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <div>
                <label
                  htmlFor="water-log-date"
                  className="block text-xs font-semibold text-gray-600 mb-1"
                >
                  Log Date (DD/MM/YYYY)
                </label>
                <UkDateInput
                  id="water-log-date"
                  value={pendingWaterLogDate}
                  max={todayStr}
                  onChange={setPendingWaterLogDate}
                  disabled={isDormantSeason || isNatureProvidingFullSoak}
                  className="w-full min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingWaterLogDate) return;
                  const loggedDate = pendingWaterLogDate;
                  setLastWateredDate(loggedDate);
                  setPendingWaterLogDate(todayStr);
                  void pushLawnTasksToSupabase({ lastWateredDate: loggedDate }, { quiet: true });
                  setMaintenanceHints((prev) => ({ ...prev, water: null }));
                }}
                disabled={isDormantSeason || isNatureProvidingFullSoak || !pendingWaterLogDate}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                💦 Log Watered
              </button>
            </div>
          </div>
        </div>

        <div
          id="soil-treatments-tracker"
          data-last-gypsum-date={lastGypsumDate ?? ''}
          data-gypsum-days-remaining={gypsumDaysRemaining}
          data-gypsum-due={gypsumDue ? 'true' : 'false'}
          className={`mt-3 rounded-lg border p-3 ${
            gypsumDue ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-xs font-bold text-gray-800 mb-2">🧪 Soil Treatments</p>

          <div className="mb-3 min-h-[2.75rem]">
            <p className="text-xs text-gray-500 leading-snug mb-2 italic">
              Optional — about every 6 months for soil drainage. Mow and water stay on their
              own schedule.
            </p>
            {lastGypsumDate && (
              <p className="text-xs text-gray-600 leading-snug mb-2">
                Last Liquid Gypsum: {formatDisplayDate(lastGypsumDate)}
                {daysSinceGypsum !== null && ` (${daysSinceGypsum} days ago)`}
              </p>
            )}
            {gypsumSnoozed ? (
              <p className="text-xs font-bold text-sky-900 leading-snug">
                📅 Postponed — next reminder {formatDisplayDate(gypsumDueDate)} (
                {gypsumDaysRemaining} day{gypsumDaysRemaining !== 1 ? 's' : ''})
              </p>
            ) : gypsumDue ? (
              <p className="text-xs font-bold text-amber-900 leading-snug">
                🟠 Liquid Gypsum due: Maintain soil drainage
                {gypsumNaturalDue !== gypsumDueDate && (
                  <span className="font-normal text-amber-800">
                    {' '}
                    (cycle target {formatDisplayDate(gypsumNaturalDue)})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-800 leading-snug">
                ✅ Not due now — next reminder {formatDisplayDate(gypsumDueDate)} (
                {gypsumDaysRemaining} day{gypsumDaysRemaining !== 1 ? 's' : ''})
              </p>
            )}
          </div>

          {(gypsumDue || gypsumSnoozed) && (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-2.5">
              {gypsumDue && (
                <>
                  <p className="text-[11px] font-bold text-sky-950 mb-1.5">
                    Too much on? Postpone gypsum only
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {GYPSUM_POSTPONE_OPTIONS.map((option) => (
                      <button
                        key={option.days}
                        type="button"
                        onClick={() => {
                          const until = addDaysToDateString(todayStr, option.days);
                          setUserLogs((prev) => ({
                            ...prev,
                            [GYPSUM_POSTPONE_KEY]: until,
                          }));
                          lastSyncFingerprintRef.current = '';
                          void pushLawnTasksToSupabase(
                            { gypsumPostponedUntil: until },
                            { quiet: true, force: true }
                          );
                        }}
                        className="text-[10px] font-bold py-1.5 px-2.5 rounded-md border border-sky-300 bg-white text-sky-900 hover:bg-sky-100 transition-colors"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {gypsumSnoozed && (
                <button
                  type="button"
                  onClick={() => {
                    setUserLogs((prev) => {
                      const next = { ...prev };
                      delete next[GYPSUM_POSTPONE_KEY];
                      return next;
                    });
                    lastSyncFingerprintRef.current = '';
                    void pushLawnTasksToSupabase(
                      { gypsumPostponedUntil: null },
                      { quiet: true, force: true }
                    );
                  }}
                  className={`text-[10px] font-semibold text-sky-800 underline hover:text-sky-950 ${gypsumDue ? 'mt-2' : ''}`}
                >
                  Cancel postpone — use normal 6‑month schedule
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label
                htmlFor="gypsum-log-date"
                className="block text-xs font-semibold text-gray-600 mb-1"
              >
                Log Date (DD/MM/YYYY)
              </label>
              <UkDateInput
                id="gypsum-log-date"
                value={pendingGypsumLogDate}
                max={todayStr}
                onChange={setPendingGypsumLogDate}
                className="w-full min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!pendingGypsumLogDate) return;
                const loggedDate = pendingGypsumLogDate;
                setUserLogs((prev) => {
                  const next = { ...prev, [GYPSUM_LOG_KEY]: loggedDate };
                  delete next[GYPSUM_POSTPONE_KEY];
                  return next;
                });
                setPendingGypsumLogDate(todayStr);
                void pushLawnTasksToSupabase(
                  { lastGypsumDate: loggedDate, gypsumPostponedUntil: null },
                  { quiet: true, force: true }
                );
              }}
              disabled={!pendingGypsumLogDate}
              className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Log Liquid Gypsum Application
            </button>
          </div>
        </div>

        {summerGranularRepeat && (
          <div
            className={`mt-3 rounded-lg border p-3 text-xs ${
              granularRepeatDue
                ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            {granularRepeatDue ? (
              <span>
                🚨 GRANULAR RE-APPLY DUE — Summer Thriver repeat target:{' '}
                {formatDisplayDate(summerGranularRepeat)} (56 days after last log)
              </span>
            ) : (
              <span>
                📅 Next Summer Thriver re-apply: {formatDisplayDate(summerGranularRepeat)} (56-day
                rolling counter)
              </span>
            )}
          </div>
        )}
      </section>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(SEASONS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setCurrentSeason(key);
                setSeasonManuallySelected(key !== workflowSeason);
              }}
              className={`p-2.5 text-xs font-bold rounded-lg border transition-all ${
                currentSeason === key
                  ? 'bg-green-600 text-white border-green-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {SEASONS[key].name}
            </button>
          ))}
        </div>
        {seasonManuallySelected && currentSeason !== workflowSeason && (
          <p className="text-xs text-center text-amber-700 mt-2">
            Viewing {SEASONS[currentSeason].name}
            {isCatchUpMode ? (
              <>
                {' '}
                — finish Spring Pack first ({incompleteSpringSteps.length} step
                {incompleteSpringSteps.length !== 1 ? 's' : ''} left). Tap Spring Pack to continue
                catch-up.
              </>
            ) : (
              <>
                {' '}
                — recommended now is {SEASONS[workflowSeason].name}. Tap{' '}
                {SEASONS[workflowSeason].name} to follow the workflow.
              </>
            )}
          </p>
        )}
        {!seasonManuallySelected && isCatchUpMode && currentSeason === 'SPRING' && (
          <p className="text-xs text-center text-emerald-800 mt-2 font-medium">
            Catch-up: {SEASONS[calendarSeason].name} on the calendar — finishing Spring Pack first.
          </p>
        )}
        <p className="text-xs text-center text-gray-500 mt-2 italic">{activeSeason.focus}</p>
      </div>

      <div className="space-y-0">
        <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">
          Sequential Timeline — {sqm} SQM
        </h3>

        {activeSeason.steps.map((step, index) => {
          const stepKey = makeStepKey(currentSeason, step.id);
          const completedDate = userLogs[stepKey] ?? null;
          const isCompleted = completedDate !== null;
          const isWeedolAdvisoryStep = showsWeedolAdvisory(step);
          const amounts = getStepAmounts(step, sqm);
          const isLast = index === activeSeason.steps.length - 1;
          const dateInputValue = isCompleted
            ? completedDate
            : pendingDates[currentSeason]?.[step.id];

          return (
            <div key={stepKey} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-green-600 text-white'
                      : isWeedolAdvisoryStep
                        ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                  }`}
                >
                  {isCompleted ? '✅' : index + 1}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[1rem] ${isCompleted ? 'bg-green-300' : 'bg-gray-200'}`}
                  />
                )}
              </div>

              <div
                className={`flex-1 mb-4 p-4 rounded-xl border transition-all ${
                  isWeedolAdvisoryStep
                    ? 'bg-amber-50 border-amber-200'
                    : isCompleted
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4
                    className={`text-sm font-bold ${isWeedolAdvisoryStep ? 'text-amber-900' : 'text-gray-900'}`}
                  >
                    {step.label}
                  </h4>
                  {isCompleted && (
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      ✅ {formatDisplayDate(completedDate)}
                    </span>
                  )}
                </div>

                {isWeedolAdvisoryStep && weedolClearanceLabel && (
                  <div className="mb-3 p-3 bg-amber-100 rounded-lg border border-amber-300 text-xs text-amber-900 font-medium leading-relaxed">
                    {weedolBarrierActive ? (
                      <>
                        ⏳ TIMELINE ADVISORY: Weedol barrier active. Do not complete this step until{' '}
                        <strong>{weedolClearanceLabel}</strong> ({weedolDaysRemaining} day
                        {weedolDaysRemaining !== 1 ? 's' : ''} remaining).
                      </>
                    ) : (
                      <>
                        ✅ Weedol clearance date was <strong>{weedolClearanceLabel}</strong> — safe to
                        proceed when conditions are right (soil temp, dry weather).
                      </>
                    )}
                  </div>
                )}

                {step.dogSafety && (
                  <div className={PET_SAFETY_CLASS}>
                    <span className="shrink-0">🐶</span>
                    <span>PET SAFETY: {step.dogSafety}</span>
                  </div>
                )}

                {amounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {amounts.map((amount, amountIdx) => (
                      <span
                        key={amountIdx}
                        className="font-mono text-xs font-bold text-green-700 bg-white px-2 py-0.5 rounded border border-green-100"
                      >
                        {amount.name ? `${amount.name}: ` : 'Required Dose: '}
                        {Number.isInteger(amount.total) ? amount.total : amount.total.toFixed(1)}
                        {amount.unit}
                      </span>
                    ))}
                  </div>
                )}

                {step.toolType === 'sprayer' && step.ratePerSqm != null && (
                  <p className="text-xs text-blue-800 bg-blue-50 p-2.5 rounded-lg border border-blue-100 mt-2 leading-relaxed">
                    {activeEquipment.instructionTemplate(
                      Math.round(step.ratePerSqm * sqm),
                      step.setting
                    )}
                  </p>
                )}

                {step.note && (
                  <p className="text-xs text-gray-500 mt-2 font-medium bg-white/60 p-2 rounded">
                    {step.note}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200/60 flex flex-col sm:flex-row sm:items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor={`date-${stepKey}`}
                      className="block text-xs font-semibold text-gray-600 mb-1"
                    >
                      Target Date (DD/MM/YYYY)
                    </label>
                    <UkDateInput
                      id={`date-${stepKey}`}
                      value={dateInputValue ?? ''}
                      onChange={(nextValue) => handlePendingDateChange(step.id, nextValue)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleLogTask(step.id)}
                      className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 px-3 rounded-lg transition-all shadow-sm"
                    >
                      Log Task
                    </button>
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleClearLog(step.id)}
                        className="text-xs font-bold py-2 px-3 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeSeason.generalGuidelines && (
        <section className="mt-8 pt-6 border-t border-green-100">
          <h3 className="font-bold text-gray-800 mb-4">
            📖 Master Guide: Seasonal Maintenance & Best Practices
          </h3>

          <div className="rounded-xl border border-green-100 bg-white p-4 md:p-5 shadow-sm">
            <p className="text-sm text-gray-600 italic leading-relaxed mb-5">
              {activeSeason.generalGuidelines.overview}
            </p>

            <div className="space-y-3">
              {activeSeason.generalGuidelines.bullets.map((bullet, bulletIdx) => (
                <div
                  key={bulletIdx}
                  className="rounded-lg bg-green-50/30 border border-green-100/80 p-3.5"
                >
                  <p className="text-xs font-bold text-green-900 mb-1.5">{bullet.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{bullet.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
        </>
      )}

      {enlargedSprinkler && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setEnlargedSprinkler(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${enlargedSprinkler.name} photo preview`}
        >
          <div
            className="relative w-full max-w-lg rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedSprinkler(null)}
              className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-bold shadow-lg hover:bg-gray-700"
              aria-label="Close photo preview"
            >
              ✕
            </button>
            <img
              src={enlargedSprinkler.image}
              alt={enlargedSprinkler.name}
              className="w-full max-h-[70vh] object-contain rounded-lg border border-gray-200"
            />
            <p className="mt-2 text-center text-sm font-bold text-gray-800">
              {enlargedSprinkler.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
