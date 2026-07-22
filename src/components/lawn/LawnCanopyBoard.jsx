import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';

/**
 * Canopy — bright daylight timeline. Not a dark shell, not bottom tabs.
 * Vertical due ribbon under a sky hero; Care/Pack open as sheets via floating dock.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnCanopyBoard({ app }) {
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
    currentSoilTemp,
    setActiveRoom,
    setActiveScreen,
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    petLockoutActive,
    petLockoutHoursRemaining,
    todayStr,
  } = app;

  /** @type {{ id: string, title: string, detail: string, go: 'maintenance' | 'seasonal', urgent: boolean }[]} */
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
      title: 'Mow the lawn',
      detail: mowingNextDate ? `Was due ${mowingNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (wateringDue) {
    queue.push({
      id: 'water',
      title: 'Water',
      detail: wateringNextDate ? `Was due ${wateringNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (verticutDue) {
    queue.push({
      id: 'verticut',
      title: 'Verticut',
      detail: verticutNextDate ? `Was due ${verticutNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (gypsumDue) {
    queue.push({
      id: 'gypsum',
      title: 'Liquid gypsum',
      detail: gypsumDueDate ? formatDisplayDate(gypsumDueDate) : 'Due now',
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
      title: 'Clear skies',
      detail: `${SEASONS[currentSeason]?.name ?? 'Season'} · ${sqm} m² — nothing due today`,
      go: 'maintenance',
      urgent: false,
    });
  }

  const dateLabel = formatDisplayDate(todayStr);
  const syncBusy = cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing';
  const urgentCount = queue.filter((item) => item.urgent).length;

  return (
    <div className="lawn-canopy">
      <header className="lawn-canopy__sky">
        <div className="lawn-canopy__sky-glow" aria-hidden="true" />
        <p className="lawn-canopy__date">{dateLabel}</p>
        <h2 className="lawn-canopy__place">{weatherLocationLabel}</h2>
        <p className="lawn-canopy__weather">{weatherStatusText}</p>
        <div className="lawn-canopy__vitals">
          <span>{sqm} m²</span>
          <span>{currentSoilTemp != null ? `${currentSoilTemp.toFixed(0)}°C soil` : 'Soil —'}</span>
          <span>
            {urgentCount > 0 ? `${urgentCount} due` : 'All clear'}
          </span>
        </div>
      </header>

      <section className="lawn-canopy__ribbon" aria-label="Today">
        <p className="lawn-canopy__ribbon-title">Today</p>
        <ol className="lawn-canopy__timeline">
          {queue.map((item, index) => (
            <li key={item.id} style={{ animationDelay: `${100 + index * 70}ms` }}>
              <button
                type="button"
                className={`lawn-canopy__node${item.urgent ? ' is-urgent' : ''}`}
                onClick={() => setActiveRoom(item.go)}
              >
                <span className="lawn-canopy__node-dot" aria-hidden="true" />
                <span className="lawn-canopy__node-copy">
                  <span className="lawn-canopy__node-title">{item.title}</span>
                  <span className="lawn-canopy__node-detail">{item.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="lawn-canopy__dock" role="navigation" aria-label="Open sheets">
        <button type="button" className="lawn-canopy__dock-main" onClick={() => setActiveRoom('maintenance')}>
          Care
        </button>
        <button type="button" className="lawn-canopy__dock-main" onClick={() => setActiveRoom('seasonal')}>
          Pack
        </button>
        <button type="button" onClick={() => void runFullCloudSync()} disabled={syncBusy}>
          {syncBusy
            ? '…'
            : cloudSyncStatus === 'synced' && lastCloudSyncAt
              ? formatSyncTimeAgo(lastCloudSyncAt)
              : 'Sync'}
        </button>
        <button type="button" onClick={() => setActiveScreen('materials')}>
          Kit
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
