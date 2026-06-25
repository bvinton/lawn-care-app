import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function LawnWorkflow({ app }) {
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
    isCatchUpMode,
    seasonManuallySelected,
    sqm,
    length,
    width,
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    setActiveScreen,
  } = app;

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
      <div className="mb-6 border-b pb-4 space-y-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black text-green-800 leading-tight">
            📋 Lawn Pack Workflow
          </h2>
          <p className="text-sm text-green-700 mt-1">
            <span className="font-black">{sqm} SQM</span>
            <span className="text-green-600 ml-1.5">({length}m × {width}m)</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition-all disabled:opacity-60 ${
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
            onClick={() => setActiveScreen('guides')}
            className="text-xs bg-green-50 hover:bg-green-100 text-green-800 font-bold py-2 px-3 rounded-lg transition-all border border-green-200"
          >
            📚 Guides
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('settings')}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-3 rounded-lg transition-all"
          >
            ⚙️ Setup
          </button>
        </div>
      </div>

      <MaintenancePanel app={app} />
      <SeasonTimeline app={app} />
    </>
  );
}
