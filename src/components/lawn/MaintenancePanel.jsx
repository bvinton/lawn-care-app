import React from 'react';
import { addDaysToDateString } from '../../data/LawnPackData';
import { LAWN_APP_SOURCE } from '../../services/lawnTasks';
import {
  GYPSUM_LOG_KEY,
  GYPSUM_POSTPONE_KEY,
  GYPSUM_POSTPONE_OPTIONS,
} from '../../services/lawnTaskInboundSync';
import {
  NEAR_TERM_RAIN_DAYS,
  RECENT_PAST_RAIN_DAYS,
  SOAK_DEPTH_MM,
} from '../../services/lawnWeather';
import {
  formatDaysSinceLabel,
  formatDisplayDate,
} from '../../utils/lawnDates';
import {
  SEED_ESTABLISHMENT_DAYS,
  SEED_GERMINATION_SOIL_TEMP_MIN_C,
  SEED_GERMINATION_SOIL_TEMP_MAX_C,
  DECKING_EDGE_WATERING_SUBTASK,
} from '../../data/lawnUiConfig';
import { UkDateInput } from './UkDateInput';

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function MaintenancePanel({ app }) {
  const {
    maintenanceDueDates,
    petLockoutUntil,
    weatherLocationLabel,
    weatherStatus,
    weatherStatusText,
    isRainForecasted,
    currentSoilTemp,
    currentSoilTempMin,
    isSoilTooColdForSeed,
    isSoilTooHotForSeed,
    isSoilPrimeForSeed,
    mowingNextDueIso,
    mowingLockedUntilIso,
    mowerModel,
    lawnSurface,
    recommendedSetting,
    isDormantSeason,
    seedEstablishmentActive,
    mowingDue,
    daysSinceMow,
    lastMowedDate,
    maintenanceHints,
    setMaintenanceHints,
    scheduleReason,
    dynamicMowingDays,
    seedDaysRemaining,
    seedLockEndDate,
    currentSeason,
    isOnScarificationPrepStep,
    pendingMowLogDate,
    setPendingMowLogDate,
    todayStr,
    setLastMowedDate,
    pushLawnTasksToSupabase,
    wateringNextDueIso,
    dynamicMinutes,
    forecastedRainSum,
    netWaterNeeded,
    isNatureProvidingFullSoak,
    wateringDue,
    activeSprinkler,
    daysSinceWater,
    lastWateredDate,
    dynamicWateringDays,
    forecastedRainSumNearTerm,
    recentPastRainSum,
    soilRecentlyWet,
    pendingWaterLogDate,
    setPendingWaterLogDate,
    setLastWateredDate,
    lastGypsumDate,
    gypsumDaysRemaining,
    gypsumDue,
    daysSinceGypsum,
    gypsumSnoozed,
    gypsumDueDate,
    gypsumNaturalDue,
    setUserLogs,
    lastSyncFingerprintRef,
    pendingGypsumLogDate,
    setPendingGypsumLogDate,
    summerGranularRepeat,
    granularRepeatDue,
  } = app;

  return (
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
        🌦️ 7-Day Weather ({weatherLocationLabel}): {weatherStatusText}
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
                  🌱 SEED ESTABLISHING: Absolutely NO mowing for {SEED_ESTABLISHMENT_DAYS} days! ({seedDaysRemaining}{' '}
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
                {app.mowingNextDate && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800 font-semibold">
                    📅 Next Cut Due: {app.mowingNextDate}
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
                  🌧️ NATURE HAS IT:{' '}
                  {recentPastRainSum >= SOAK_DEPTH_MM
                    ? 'Recent rain has soaked the soil. Timers paused.'
                    : 'Enough rain forecast soon. Timers paused.'}
                </p>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 font-semibold">
                  🌧️ Next Water: Paused (
                  {recentPastRainSum >= SOAK_DEPTH_MM
                    ? `${recentPastRainSum.toFixed(1)}mm in last ${RECENT_PAST_RAIN_DAYS} days already covered the ${SOAK_DEPTH_MM}mm soak`
                    : `${forecastedRainSumNearTerm.toFixed(1)}mm forecast next ${NEAR_TERM_RAIN_DAYS} days covers the soak`}
                  )
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
                {app.wateringNextDate && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 font-semibold">
                    🚰 Next Water Due: {app.wateringNextDate} ({dynamicMinutes} min soak).{' '}
                    <span className="font-medium italic">
                      *{recentPastRainSum.toFixed(1)}mm rain last {RECENT_PAST_RAIN_DAYS} days;{' '}
                      {forecastedRainSumNearTerm.toFixed(1)}mm forecast next {NEAR_TERM_RAIN_DAYS} days.*
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
                {soilRecentlyWet && (
                  <p className="mt-1 text-xs font-medium text-sky-800">
                    💧 Soil still damp from recent rain — holding off until the dry spell bites.
                  </p>
                )}
                {scheduleReason.water && (
                  <p className="mt-1 text-xs text-blue-700 italic">
                    📊 {dynamicWateringDays}-day interval: {scheduleReason.water}
                  </p>
                )}
                {app.wateringNextDate && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 font-semibold">
                    🚰 Next Water Due: {app.wateringNextDate}
                    {dynamicMinutes > 0 ? ` (${dynamicMinutes} min soak)` : ''}.{' '}
                    <span className="font-medium italic">
                      *{recentPastRainSum.toFixed(1)}mm rain last {RECENT_PAST_RAIN_DAYS} days;{' '}
                      {forecastedRainSumNearTerm.toFixed(1)}mm forecast next {NEAR_TERM_RAIN_DAYS} days.*
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
  );
}
