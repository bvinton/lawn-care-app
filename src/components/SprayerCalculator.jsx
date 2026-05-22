import React, { useState, useEffect, useCallback } from 'react';
import {
  INITIAL_LAWN_CONFIG,
  SEASONS,
  EQUIPMENT_OPTIONS,
  SPRINKLER_OPTIONS,
  WEEDOL_BARRIER_DAYS,
  SEASON_START_DATES,
  makeStepKey,
  createInitialPendingDates,
  cascadeSeasonDates,
  getSeasonAnchorDate,
  getGranularRepeatDate,
  addDaysToDateString,
} from '../data/LawnPackData';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MOWING_DUE_DAYS = 5;
const WATERING_DUE_DAYS = 3;
const SEED_ESTABLISHMENT_DAYS = 21;
const RAIN_THRESHOLD_MM = 5.0;

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=54.98&longitude=-1.53&daily=rain_sum&timezone=Europe%2FLondon&forecast_days=7';

const SOAK_DEPTH_MM = 10;

const PET_SAFETY_CLASS =
  'bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs p-3 rounded-lg flex items-center gap-2 mb-2';

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
function formatDisplayDate(dateString) {
  return startOfDay(dateString).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** @param {Date} date */
function formatInputDate(date) {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [currentSeason, setCurrentSeason] = useState('SPRING');
  const [selectedEquipment, setSelectedEquipment] = useState('BIRCHMEIER');
  const [selectedSprinkler, setSelectedSprinkler] = useState(() => {
    const saved = localStorage.getItem('lawnPackSelectedSprinkler');
    return saved && SPRINKLER_OPTIONS[saved] ? saved : 'OSCILLATING';
  });
  const [showConfig, setShowConfig] = useState(false);

  const [userLogs, setUserLogs] = useState(() =>
    /** @type {Record<string, string>} */ (readStoredJson('lawnPackUserLogs', {}))
  );
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

  const [isRainForecasted, setIsRainForecasted] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState('loading');
  const [enlargedSprinkler, setEnlargedSprinkler] = useState(
    /** @type {{ image: string, name: string } | null} */ (null)
  );

  const activeEquipment = EQUIPMENT_OPTIONS[selectedEquipment];
  const activeSprinkler = SPRINKLER_OPTIONS[selectedSprinkler];
  const irrigationRuntimeMinutes = Math.round(
    (SOAK_DEPTH_MM / activeSprinkler.ratePerHour) * 60
  );
  const activeSeason = SEASONS[currentSeason];
  const today = startOfDay(new Date());
  const todayStr = formatInputDate(today);

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

  const isWinterSeason = currentSeason === 'WINTER';
  const mowingDue =
    !isWinterSeason &&
    !seedEstablishmentActive &&
    (daysSinceMow === null || daysSinceMow >= MOWING_DUE_DAYS);
  const wateringDue =
    !isWinterSeason &&
    !isRainForecasted &&
    (daysSinceWater === null || daysSinceWater >= WATERING_DUE_DAYS);

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

  useEffect(() => {
    setSqm(length * width);
  }, [length, width]);

  useEffect(() => {
    localStorage.setItem('lawnPackUserLogs', JSON.stringify(userLogs));
  }, [userLogs]);

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
    let cancelled = false;

    async function fetchRainForecast() {
      setWeatherStatus('loading');
      try {
        const response = await fetch(OPEN_METEO_URL);
        if (!response.ok) throw new Error('Forecast unavailable');

        const data = await response.json();
        const rainTotals = data?.daily?.rain_sum ?? [];
        const totalRain = rainTotals.reduce((sum, mm) => sum + (mm ?? 0), 0);

        if (!cancelled) {
          setIsRainForecasted(totalRain >= RAIN_THRESHOLD_MM);
          setWeatherStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setIsRainForecasted(false);
          setWeatherStatus('error');
        }
      }
    }

    fetchRainForecast();

    return () => {
      cancelled = true;
    };
  }, []);

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
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const isFirstStep = stepIndex === 0;

    const nextLogs = {
      ...userLogs,
      [makeStepKey(currentSeason, stepId)]: dateValue,
    };

    setUserLogs(nextLogs);

    if (isFirstStep) {
      recascadeSeason(currentSeason, dateValue, nextLogs);
    } else {
      const anchor = getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);
      recascadeSeason(currentSeason, anchor, nextLogs);
    }
  };

  const handleClearLog = (stepId) => {
    const key = makeStepKey(currentSeason, stepId);
    const nextLogs = { ...userLogs };
    delete nextLogs[key];
    setUserLogs(nextLogs);

    const isFirstStep = SEASONS[currentSeason].steps[0].id === stepId;
    const anchor = isFirstStep
      ? SEASON_START_DATES[currentSeason]
      : getSeasonAnchorDate(currentSeason, nextLogs, pendingDates);

    recascadeSeason(currentSeason, anchor, nextLogs);
  };

  const showsWeedolAdvisory = (step) =>
    currentSeason === 'SPRING' && weedolBarrierActive && step.id !== 'weedol';

  const weedolClearanceLabel = weedolClearanceDate
    ? formatDisplayDate(weedolClearanceDate)
    : null;

  const weatherStatusText =
    weatherStatus === 'loading'
      ? 'Fetching 7-day rainfall forecast…'
      : isRainForecasted
        ? '🌧️ Rain Forecasted - Watering Paused'
        : '☀️ Dry Week Predicted - Timers Active';

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl m-4 p-6 border border-green-100">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-black text-green-800">📋 Lawn Pack Workflow</h2>
          <p className="text-sm text-green-700 mt-1">
            <span className="font-black">{sqm} SQM</span>
            <span className="text-green-600 ml-1.5">({length}m × {width}m)</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig((open) => !open)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-all"
        >
          {showConfig ? '⚙️ Hide Setup' : '⚙️ Show Setup'}
        </button>
      </div>

      {showConfig && (
        <div className="bg-green-50 p-4 rounded-lg mb-6 space-y-4 border border-green-100">
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
        </div>
      )}

      <section className="mb-6 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
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

        <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
          <div
            className={`flex flex-col rounded-lg border p-3 ${
              isWinterSeason
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
              {isWinterSeason ? (
                <p className="text-xs font-medium leading-snug">
                  ❄️ WINTER DORMANT: Mowing suspended for the season.
                </p>
              ) : seedEstablishmentActive ? (
                <p className="text-xs font-bold text-red-900 leading-snug">
                  🌱 SEED ESTABLISHING: Absolutely NO mowing for 21 days! ({seedDaysRemaining}{' '}
                  day{seedDaysRemaining !== 1 ? 's' : ''} remaining)
                </p>
              ) : mowingDue ? (
                <p className="text-xs font-bold text-amber-900 leading-snug">
                  🚨 MOWING DUE: It has been {daysSinceMow ?? '∞'} days since your last cut.
                </p>
              ) : (
                <p className="text-xs text-gray-600 leading-snug">
                  Last cut: {formatDisplayDate(lastMowedDate)} ({daysSinceMow} days ago)
                </p>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <div>
                <label
                  htmlFor="mow-log-date"
                  className="block text-xs font-semibold text-gray-600 mb-1"
                >
                  Log Date
                </label>
                <input
                  id="mow-log-date"
                  type="date"
                  value={pendingMowLogDate}
                  max={todayStr}
                  onChange={(e) => setPendingMowLogDate(e.target.value)}
                  disabled={isWinterSeason || seedEstablishmentActive}
                  className="w-full min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingMowLogDate) return;
                  setLastMowedDate(pendingMowLogDate);
                  setPendingMowLogDate(todayStr);
                }}
                disabled={isWinterSeason || seedEstablishmentActive || !pendingMowLogDate}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✂️ Log
              </button>
            </div>
          </div>

          <div
            className={`flex flex-col rounded-lg border p-3 ${
              isWinterSeason
                ? 'bg-gray-100 border-gray-300 text-gray-500'
                : isRainForecasted
                  ? 'bg-sky-100 border-sky-300 text-sky-900'
                  : wateringDue
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-200'
            }`}
          >
            <p className="text-xs font-bold text-gray-800 mb-1">🚰 Watering Tracker</p>

            <div className={`mb-3 ${wateringDue ? 'min-h-[6rem]' : 'min-h-[2.75rem]'}`}>
              {isWinterSeason ? (
                <p className="text-xs font-medium leading-snug">
                  ❄️ WINTER: Watering suspended to prevent frost expansion.
                </p>
              ) : isRainForecasted ? (
                <p className="text-xs font-bold leading-snug">
                  🌧️ NATURE HAS IT: Heavy rain inbound. Timers paused.
                </p>
              ) : wateringDue ? (
                <p className="text-xs font-bold text-amber-900 leading-snug">
                  🚰 IRRIGATION DUE: The soil needs a heavy 10mm soak. Based on your location&apos;s
                  weather, turn on your {activeSprinkler.name} for exactly{' '}
                  {irrigationRuntimeMinutes} minutes to achieve optimal root depth without wasting
                  water.
                </p>
              ) : (
                <p className="text-xs text-gray-600 leading-snug">
                  Last water: {formatDisplayDate(lastWateredDate)} ({daysSinceWater} days ago)
                </p>
              )}
            </div>

            <div className="mt-auto space-y-2">
              <div>
                <label
                  htmlFor="water-log-date"
                  className="block text-xs font-semibold text-gray-600 mb-1"
                >
                  Log Date
                </label>
                <input
                  id="water-log-date"
                  type="date"
                  value={pendingWaterLogDate}
                  max={todayStr}
                  onChange={(e) => setPendingWaterLogDate(e.target.value)}
                  disabled={isWinterSeason || isRainForecasted}
                  className="w-full min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingWaterLogDate) return;
                  setLastWateredDate(pendingWaterLogDate);
                  setPendingWaterLogDate(todayStr);
                }}
                disabled={isWinterSeason || isRainForecasted || !pendingWaterLogDate}
                className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                💦 Log Watered
              </button>
            </div>
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
              onClick={() => setCurrentSeason(key)}
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
                    ⏳ TIMELINE ADVISORY: Weedol barrier active. Do not complete this step until{' '}
                    <strong>{weedolClearanceLabel}</strong> ({weedolDaysRemaining} day
                    {weedolDaysRemaining !== 1 ? 's' : ''} remaining).
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
                      Target Date
                    </label>
                    <input
                      id={`date-${stepKey}`}
                      type="date"
                      value={dateInputValue}
                      onChange={(e) => handlePendingDateChange(step.id, e.target.value)}
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
