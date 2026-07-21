import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';

/**
 * Canopy layout — today queue (due-first), not a room hub or tab board.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnTodayBoard({ app }) {
  const {
    sqm,
    mowingDue,
    wateringDue,
    verticutDue,
    gypsumDue,
    seedEstablishmentActive,
    seedDaysRemaining,
    mowingNextDate,
    wateringNextDate,
    verticutNextDate,
    gypsumDueDate,
    currentSeason,
    springPackIncomplete,
    incompleteSpringSteps,
    weatherStatusText,
    weatherLocationLabel,
    setActiveRoom,
    setActiveScreen,
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    petLockoutActive,
    petLockoutHoursRemaining,
    todayStr,
  } = app;

  /** @type {{ id: string, title: string, detail: string, go: 'maintenance' | 'seasonal' | 'settings', urgent: boolean }[]} */
  const queue = [];

  if (petLockoutActive) {
    queue.push({
      id: 'pets',
      title: 'Pet lockout',
      detail: `Safe in ${petLockoutHoursRemaining}h`,
      go: 'maintenance',
      urgent: true,
    });
  }
  if (seedEstablishmentActive) {
    queue.push({
      id: 'seed',
      title: 'No mowing',
      detail: `${seedDaysRemaining} day${seedDaysRemaining !== 1 ? 's' : ''} left on seed lock`,
      go: 'maintenance',
      urgent: true,
    });
  }
  if (mowingDue && !seedEstablishmentActive) {
    queue.push({
      id: 'mow',
      title: 'Mow',
      detail: mowingNextDate ? `Was due ${mowingNextDate}` : 'Due',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (wateringDue) {
    queue.push({
      id: 'water',
      title: 'Water',
      detail: wateringNextDate ? `Was due ${wateringNextDate}` : 'Due',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (verticutDue) {
    queue.push({
      id: 'verticut',
      title: 'Verticut',
      detail: verticutNextDate ? `Was due ${verticutNextDate}` : 'Due',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (gypsumDue) {
    queue.push({
      id: 'gypsum',
      title: 'Gypsum',
      detail: gypsumDueDate ? formatDisplayDate(gypsumDueDate) : 'Due',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (springPackIncomplete) {
    queue.push({
      id: 'spring',
      title: 'Spring Pack',
      detail: `${incompleteSpringSteps.length} step${incompleteSpringSteps.length !== 1 ? 's' : ''} left`,
      go: 'seasonal',
      urgent: true,
    });
  }

  if (queue.length === 0) {
    queue.push({
      id: 'clear',
      title: 'Nothing due',
      detail: `${SEASONS[currentSeason]?.name ?? 'Season'} · ${sqm} m²`,
      go: 'maintenance',
      urgent: false,
    });
  }

  const dateLabel = formatDisplayDate(todayStr);
  const syncBusy = cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing';

  return (
    <div className="lawn-canopy">
      <header className="lawn-canopy__hero">
        <p className="lawn-canopy__date">{dateLabel}</p>
        <h2 className="lawn-canopy__place">{weatherLocationLabel}</h2>
        <p className="lawn-canopy__weather">{weatherStatusText}</p>
      </header>

      <ol className="lawn-canopy__queue">
        {queue.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`lawn-canopy__item${item.urgent ? ' is-urgent' : ''}`}
              onClick={() => setActiveRoom(item.go)}
            >
              <span className="lawn-canopy__item-title">{item.title}</span>
              <span className="lawn-canopy__item-detail">{item.detail}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="lawn-canopy__dock">
        <button type="button" onClick={() => void runFullCloudSync()} disabled={syncBusy}>
          {syncBusy
            ? 'Syncing…'
            : cloudSyncStatus === 'synced' && lastCloudSyncAt
              ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)}`
              : 'Sync'}
        </button>
        <button type="button" onClick={() => setActiveScreen('materials')}>
          Materials
        </button>
        <button type="button" onClick={() => setActiveScreen('guides')}>
          Guides
        </button>
        <button type="button" onClick={() => setActiveScreen('settings')}>
          Setup
        </button>
      </div>
    </div>
  );
}
