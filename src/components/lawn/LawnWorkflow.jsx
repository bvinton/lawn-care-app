import React from 'react';
import { formatSyncTimeAgo } from '../../utils/lawnDates';
import LawnAlerts from './LawnAlerts';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import { CalculatorIcon } from './LawnMaterials';

/** @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props */
export default function LawnWorkflow({ app }) {
  const {
    sqm,
    length,
    width,
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    setActiveScreen,
  } = app;

  const syncLabel =
    cloudSyncStatus === 'pulling'
      ? 'Pull…'
      : cloudSyncStatus === 'pushing'
        ? 'Push…'
        : cloudSyncStatus === 'error'
          ? 'Retry'
          : cloudSyncStatus === 'idle'
            ? 'Sync'
            : null;

  return (
    <>
      <LawnAlerts app={app} />
      <div className="mb-6 border-b pb-4 space-y-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black text-green-800 leading-tight">
            📋 Lawn Pack Workflow
          </h2>
          <p className="text-sm text-green-700 mt-1">
            <span className="font-black">{sqm} SQM</span>
            <span className="text-green-600 ml-1.5">
              ({length}m × {width}m)
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
            className={`flex w-full items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all disabled:opacity-60 ${
              cloudSyncStatus === 'synced'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : cloudSyncStatus === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            aria-label={
              cloudSyncStatus === 'synced' && lastCloudSyncAt
                ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)} — tap to refresh`
                : 'Sync with shared database'
            }
          >
            <span
              className={`text-base leading-none ${
                cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing'
                  ? 'inline-block animate-spin'
                  : ''
              }`}
              aria-hidden="true"
            >
              {cloudSyncStatus === 'synced' ? '☁️✓' : cloudSyncStatus === 'error' ? '☁️!' : '☁️↻'}
            </span>
            {syncLabel && <span>{syncLabel}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('materials')}
            className="flex w-full items-center justify-center gap-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold py-2.5 px-3 rounded-lg transition-all border border-amber-200"
          >
            <CalculatorIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Materials</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('guides')}
            className="flex w-full items-center justify-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-800 font-bold py-2.5 px-3 rounded-lg transition-all border border-green-200"
          >
            <span>📚 Guides</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScreen('settings')}
            className="flex w-full items-center justify-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-3 rounded-lg transition-all"
          >
            <span>⚙️ Setup</span>
          </button>
        </div>
      </div>

      <MaintenancePanel app={app} />
      <SeasonTimeline app={app} />
    </>
  );
}
