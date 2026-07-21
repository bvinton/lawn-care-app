import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';

/**
 * Signal layout — dense status board (not a room hub).
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnStatusBoard({ app }) {
  const {
    sqm,
    length,
    width,
    mowingDue,
    wateringDue,
    verticutDue,
    gypsumDue,
    seedEstablishmentActive,
    mowingNextDate,
    wateringNextDate,
    verticutNextDate,
    gypsumDueDate,
    currentSeason,
    springPackIncomplete,
    incompleteSpringSteps,
    weatherStatusText,
    weatherLocationLabel,
    currentSoilTemp,
    setActiveRoom,
    petLockoutActive,
    petLockoutHoursRemaining,
  } = app;

  const cells = [
    {
      id: 'mow',
      label: 'Mow',
      due: mowingDue,
      detail: seedEstablishmentActive ? 'Locked' : mowingNextDate ? `Next ${mowingNextDate}` : '—',
      go: 'maintenance',
    },
    {
      id: 'water',
      label: 'Water',
      due: wateringDue,
      detail: wateringNextDate ? `Next ${wateringNextDate}` : '—',
      go: 'maintenance',
    },
    {
      id: 'verticut',
      label: 'Verticut',
      due: verticutDue,
      detail: verticutNextDate ? `Next ${verticutNextDate}` : '—',
      go: 'maintenance',
    },
    {
      id: 'gypsum',
      label: 'Gypsum',
      due: gypsumDue,
      detail: gypsumDueDate ? formatDisplayDate(gypsumDueDate) : '—',
      go: 'maintenance',
    },
  ];

  return (
    <div className="lawn-signal">
      <header className="lawn-signal__head">
        <div>
          <p className="lawn-signal__kicker">{weatherLocationLabel}</p>
          <h2 className="lawn-signal__title">{sqm} m²</h2>
        </div>
        <div className="lawn-signal__meta">
          <span>
            {length}×{width}m
          </span>
          <span>{currentSoilTemp != null ? `${currentSoilTemp.toFixed(0)}°C soil` : 'Soil —'}</span>
        </div>
      </header>

      <p className="lawn-signal__weather">{weatherStatusText}</p>

      {(petLockoutActive || springPackIncomplete) && (
        <div className="lawn-signal__flags">
          {petLockoutActive && (
            <p className="lawn-signal__flag">Pets off · {petLockoutHoursRemaining}h</p>
          )}
          {springPackIncomplete && (
            <button
              type="button"
              className="lawn-signal__flag lawn-signal__flag--btn"
              onClick={() => setActiveRoom('seasonal')}
            >
              Spring Pack · {incompleteSpringSteps.length} left
            </button>
          )}
        </div>
      )}

      <div className="lawn-signal__grid" role="list">
        {cells.map((cell) => (
          <button
            key={cell.id}
            type="button"
            role="listitem"
            className={`lawn-signal__cell${cell.due ? ' is-due' : ''}`}
            onClick={() => setActiveRoom(cell.go)}
          >
            <span className="lawn-signal__cell-label">{cell.label}</span>
            <span className="lawn-signal__cell-state">{cell.due ? 'Due' : 'OK'}</span>
            <span className="lawn-signal__cell-detail">{cell.detail}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="lawn-signal__season"
        onClick={() => setActiveRoom('seasonal')}
      >
        <span>{SEASONS[currentSeason]?.name ?? 'Season'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/**
 * Tools pane for Signal "More" tab.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export function LawnSignalMore({ app }) {
  const {
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    setActiveScreen,
  } = app;

  const syncLabel =
    cloudSyncStatus === 'pulling'
      ? 'Pulling…'
      : cloudSyncStatus === 'pushing'
        ? 'Pushing…'
        : cloudSyncStatus === 'error'
          ? 'Retry sync'
          : cloudSyncStatus === 'synced' && lastCloudSyncAt
            ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)}`
            : 'Sync';

  const items = [
    {
      key: 'sync',
      label: syncLabel,
      onClick: () => void runFullCloudSync(),
      disabled: cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing',
    },
    { key: 'materials', label: 'Materials', onClick: () => setActiveScreen('materials') },
    { key: 'guides', label: 'Guides', onClick: () => setActiveScreen('guides') },
    { key: 'settings', label: 'Setup', onClick: () => setActiveScreen('settings') },
  ];

  return (
    <div className="lawn-signal-more">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="lawn-signal-more__row"
          onClick={item.onClick}
          disabled={Boolean(item.disabled)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
