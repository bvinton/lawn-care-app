import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate } from '../../utils/lawnDates';
import { isSectionedLayout } from '../../data/lawnThemes';

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function LawnAlerts({ app }) {
  const {
    supabaseSyncError,
    petLockoutActive,
    petLockoutHoursRemaining,
    springPackIncomplete,
    currentSeason,
    incompleteSpringSteps,
    calendarSeason,
    weedolLoggedDate,
    springRenovationPending,
    weedolBarrierActive,
    weedolClearanceDate,
    weedolDaysRemaining,
    setCurrentSeason,
    setSeasonManuallySelected,
    setActiveRoom,
    activeTheme,
    isCatchUpMode,
    seasonManuallySelected,
  } = app;

  const openSpringPack = () => {
    setCurrentSeason('SPRING');
    setSeasonManuallySelected(true);
    if (isSectionedLayout(activeTheme.layout)) {
      setActiveRoom('seasonal');
    }
  };

  return (
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
            The calendar says {SEASONS[calendarSeason].name}, but you have unfinished Spring work —
            we won&apos;t skip ahead until those steps are logged.
          </p>
          {weedolLoggedDate && springRenovationPending && (
            <p className="mb-2 font-semibold">
              {weedolBarrierActive ? (
                <>
                  ⏳ Weedol barrier: scarify &amp; seed locked until{' '}
                  <strong>{formatDisplayDate(weedolClearanceDate)}</strong> ({weedolDaysRemaining}{' '}
                  day{weedolDaysRemaining !== 1 ? 's' : ''} left).
                </>
              ) : (
                <>
                  ✅ Weedol clearance passed ({formatDisplayDate(weedolClearanceDate)}) — you can
                  scarify and seed when ready.
                </>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={openSpringPack}
            className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
          >
            Open Spring Pack timeline
          </button>
        </div>
      )}
      {currentSeason === 'SPRING' && isCatchUpMode && !seasonManuallySelected && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 leading-relaxed">
          📅 Catch-up mode: calendar is {SEASONS[calendarSeason].name}, but Spring Pack steps remain
          — complete them before Summer tasks unlock here.
          {weedolBarrierActive && springRenovationPending && weedolClearanceDate && (
            <span className="block mt-1 font-bold text-amber-900">
              ⏳ Weedol barrier until {formatDisplayDate(weedolClearanceDate)} — prep &amp; seed
              steps below show the countdown.
            </span>
          )}
        </div>
      )}
    </>
  );
}
