import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';

/**
 * Canopy — neon yard board with giant billboard due cards (not sky timeline, not bottom tabs).
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
      title: 'PETS OFF',
      detail: `Safe in ${petLockoutHoursRemaining}h`,
      go: 'maintenance',
      urgent: true,
    });
  }
  if (seedEstablishmentActive) {
    queue.push({
      id: 'seed',
      title: 'NO MOW',
      detail: `${seedDaysRemaining}d seed lock`,
      go: 'maintenance',
      urgent: true,
    });
  }
  if (mowingDue && !seedEstablishmentActive) {
    queue.push({
      id: 'mow',
      title: 'MOW',
      detail: mowingNextDate ? `Was due ${mowingNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (wateringDue) {
    queue.push({
      id: 'water',
      title: 'WATER',
      detail: wateringNextDate ? `Was due ${wateringNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (verticutDue) {
    queue.push({
      id: 'verticut',
      title: 'VERTICUT',
      detail: verticutNextDate ? `Was due ${verticutNextDate}` : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (gypsumDue) {
    queue.push({
      id: 'gypsum',
      title: 'GYPSUM',
      detail: gypsumDueDate ? formatDisplayDate(gypsumDueDate) : 'Due now',
      go: 'maintenance',
      urgent: true,
    });
  }
  if (springPackIncomplete) {
    queue.push({
      id: 'spring',
      title: 'SPRING PACK',
      detail: `${incompleteSpringSteps.length} step${incompleteSpringSteps.length !== 1 ? 's' : ''} left`,
      go: 'seasonal',
      urgent: true,
    });
  }

  if (queue.length === 0) {
    queue.push({
      id: 'clear',
      title: 'ALL CLEAR',
      detail: `${SEASONS[currentSeason]?.name ?? 'Season'} · ${sqm} m²`,
      go: 'maintenance',
      urgent: false,
    });
  }

  const dateLabel = formatDisplayDate(todayStr);
  const syncBusy = cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing';
  const urgentCount = queue.filter((item) => item.urgent).length;

  return (
    <div className="lawn-canopy">
      <nav className="lawn-canopy__strip" aria-label="Yard board">
        <button type="button" className="is-active" onClick={() => setActiveRoom('hub')}>
          Today
        </button>
        <button type="button" onClick={() => setActiveRoom('maintenance')}>
          Care
        </button>
        <button type="button" onClick={() => setActiveRoom('seasonal')}>
          Pack
        </button>
      </nav>

      <header className="lawn-canopy__boardhead">
        <p className="lawn-canopy__date">{dateLabel}</p>
        <h2 className="lawn-canopy__place">{weatherLocationLabel}</h2>
        <p className="lawn-canopy__weather">{weatherStatusText}</p>
        <p className="lawn-canopy__meta">
          {sqm} m² · {currentSoilTemp != null ? `${currentSoilTemp.toFixed(0)}°C` : 'Soil —'} ·{' '}
          {urgentCount > 0 ? `${urgentCount} DUE` : 'CLEAR'}
        </p>
      </header>

      <section className="lawn-canopy__bills" aria-label="Due billboards">
        {queue.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`lawn-canopy__bill${item.urgent ? ' is-urgent' : ''}`}
            style={{ animationDelay: `${80 + index * 80}ms` }}
            onClick={() => setActiveRoom(item.go)}
          >
            <span className="lawn-canopy__bill-title">{item.title}</span>
            <span className="lawn-canopy__bill-detail">{item.detail}</span>
          </button>
        ))}
      </section>

      <div className="lawn-canopy__tools">
        <button type="button" onClick={() => void runFullCloudSync()} disabled={syncBusy}>
          {syncBusy
            ? 'SYNC…'
            : cloudSyncStatus === 'synced' && lastCloudSyncAt
              ? formatSyncTimeAgo(lastCloudSyncAt).toUpperCase()
              : 'SYNC'}
        </button>
        <button type="button" onClick={() => setActiveScreen('materials')}>
          KIT
        </button>
        <button type="button" onClick={() => setActiveScreen('guides')}>
          GUIDES
        </button>
        <button type="button" onClick={() => setActiveScreen('settings')}>
          SETUP
        </button>
      </div>
    </div>
  );
}
