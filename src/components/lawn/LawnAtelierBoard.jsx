import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';
import { CalculatorIcon } from './LawnMaterials';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';

/**
 * Atelier — paper desk with top folder tabs (not a left spine, not bottom tabs).
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnAtelierBoard({ app }) {
  const {
    sqm,
    length,
    width,
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    setActiveScreen,
    setActiveRoom,
    activeRoom,
    mowingDue,
    wateringDue,
    verticutDue,
    gypsumDue,
    seedEstablishmentActive,
    petLockoutActive,
    springPackIncomplete,
    incompleteSpringSteps,
    currentSeason,
    weatherStatusText,
    weatherLocationLabel,
    mowingNextDate,
    wateringNextDate,
    verticutNextDate,
    gypsumDueDate,
  } = app;

  const dueCount = [mowingDue, wateringDue, verticutDue, gypsumDue].filter(Boolean).length;
  const chapter =
    activeRoom === 'maintenance' || activeRoom === 'seasonal' || activeRoom === 'more'
      ? activeRoom
      : 'hub';

  const syncBusy = cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing';
  const syncLabel =
    cloudSyncStatus === 'pulling'
      ? 'Pulling…'
      : cloudSyncStatus === 'pushing'
        ? 'Pushing…'
        : cloudSyncStatus === 'error'
          ? 'Retry sync'
          : cloudSyncStatus === 'synced' && lastCloudSyncAt
            ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)}`
            : 'Sync now';

  const folders = [
    { id: 'hub', label: 'Index' },
    { id: 'maintenance', label: 'Care', badge: dueCount > 0 ? String(dueCount) : null },
    {
      id: 'seasonal',
      label: 'Pack',
      badge: springPackIncomplete ? String(incompleteSpringSteps.length) : null,
    },
    { id: 'more', label: 'Studio' },
  ];

  const dueLines = [
    { id: 'mow', label: 'Mowing', due: mowingDue && !seedEstablishmentActive, next: mowingNextDate },
    { id: 'water', label: 'Watering', due: wateringDue, next: wateringNextDate },
    { id: 'verticut', label: 'Verticut', due: verticutDue, next: verticutNextDate },
    {
      id: 'gypsum',
      label: 'Gypsum',
      due: gypsumDue,
      next: gypsumDueDate ? formatDisplayDate(gypsumDueDate) : null,
    },
  ];

  let page = null;
  if (chapter === 'maintenance') {
    page = (
      <div className="lawn-atelier__sheet lawn-panel-surface">
        <MaintenancePanel app={app} />
      </div>
    );
  } else if (chapter === 'seasonal') {
    page = (
      <div className="lawn-atelier__sheet lawn-panel-surface">
        <SeasonTimeline app={app} />
      </div>
    );
  } else if (chapter === 'more') {
    page = (
      <div className="lawn-atelier__studio">
        <p className="lawn-atelier__studio-lede">Studio</p>
        <button
          type="button"
          className="lawn-atelier__studio-row"
          onClick={() => void runFullCloudSync()}
          disabled={syncBusy}
        >
          <span>Cloud sync</span>
          <span>{syncLabel}</span>
        </button>
        <button
          type="button"
          className="lawn-atelier__studio-row"
          onClick={() => setActiveScreen('materials')}
        >
          <span className="inline-flex items-center gap-2">
            <CalculatorIcon className="w-3.5 h-3.5" /> Materials
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="lawn-atelier__studio-row"
          onClick={() => setActiveScreen('guides')}
        >
          <span>Guides</span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="lawn-atelier__studio-row"
          onClick={() => setActiveScreen('settings')}
        >
          <span>Setup</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  } else {
    page = (
      <div className="lawn-atelier__cover">
        <div className="lawn-atelier__masthead">
          <p className="lawn-atelier__kicker">{weatherLocationLabel}</p>
          <h2 className="lawn-atelier__season">{SEASONS[currentSeason]?.name ?? 'Season'}</h2>
          <p className="lawn-atelier__size">
            Vol. {sqm} m² · {length}×{width}m
          </p>
        </div>

        <p className="lawn-atelier__weather">{weatherStatusText}</p>

        {(petLockoutActive || seedEstablishmentActive || springPackIncomplete) && (
          <ul className="lawn-atelier__notices">
            {petLockoutActive && <li>Pets off the lawn — chemical drying.</li>}
            {seedEstablishmentActive && <li>Seed lock — no mowing while establishing.</li>}
            {springPackIncomplete && (
              <li>
                Spring Pack: {incompleteSpringSteps.length} step
                {incompleteSpringSteps.length !== 1 ? 's' : ''} left.
              </li>
            )}
          </ul>
        )}

        <div className="lawn-atelier__ledger" aria-label="Care ledger">
          <p className="lawn-atelier__ledger-title">Ledger</p>
          {dueLines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              className={`lawn-atelier__line${line.due ? ' is-due' : ''}`}
              style={{ animationDelay: `${90 + index * 70}ms` }}
              onClick={() => setActiveRoom('maintenance')}
            >
              <span className="lawn-atelier__line-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="lawn-atelier__line-label">{line.label}</span>
              <span className="lawn-atelier__line-state">
                {line.due ? 'Due' : line.next ? line.next : '—'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lawn-atelier" data-atelier-chapter={chapter}>
      <nav className="lawn-atelier__folders" aria-label="Desk folders">
        {folders.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lawn-atelier__folder${chapter === item.id ? ' is-active' : ''}`}
            onClick={() =>
              setActiveRoom(/** @type {'hub' | 'maintenance' | 'seasonal' | 'more'} */ (item.id))
            }
            aria-current={chapter === item.id ? 'page' : undefined}
          >
            {item.label}
            {item.badge ? <span className="lawn-atelier__folder-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
      <div className="lawn-atelier__desk">{page}</div>
    </div>
  );
}
