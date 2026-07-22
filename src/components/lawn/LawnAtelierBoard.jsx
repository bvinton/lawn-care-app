import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatDisplayDate, formatSyncTimeAgo } from '../../utils/lawnDates';
import { CalculatorIcon } from './LawnMaterials';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';

/**
 * Atelier — field-journal spine. Not a room hub list, not bottom tabs.
 * Vertical chapter rail + one open chapter (Cover / Care / Pack / Studio).
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

  const chapters = [
    { id: 'hub', label: 'Cover', short: 'Cv' },
    { id: 'maintenance', label: 'Care', short: 'Cr', badge: dueCount > 0 ? String(dueCount) : null },
    {
      id: 'seasonal',
      label: 'Pack',
      short: 'Pk',
      badge: springPackIncomplete ? String(incompleteSpringSteps.length) : null,
    },
    { id: 'more', label: 'Studio', short: 'St' },
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
      <div className="lawn-atelier__chapter lawn-panel-surface">
        <MaintenancePanel app={app} />
      </div>
    );
  } else if (chapter === 'seasonal') {
    page = (
      <div className="lawn-atelier__chapter lawn-panel-surface">
        <SeasonTimeline app={app} />
      </div>
    );
  } else if (chapter === 'more') {
    page = (
      <div className="lawn-atelier__studio">
        <p className="lawn-atelier__studio-lede">Studio tools</p>
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
            <CalculatorIcon className="w-3.5 h-3.5" /> Materials calculator
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="lawn-atelier__studio-row"
          onClick={() => setActiveScreen('guides')}
        >
          <span>Guides & PDFs</span>
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
        <p className="lawn-atelier__kicker">{weatherLocationLabel}</p>
        <h2 className="lawn-atelier__season">{SEASONS[currentSeason]?.name ?? 'Season'}</h2>
        <p className="lawn-atelier__size">
          {sqm} m² · {length}×{width}m
        </p>
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
          {dueLines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              className={`lawn-atelier__line${line.due ? ' is-due' : ''}`}
              style={{ animationDelay: `${80 + index * 60}ms` }}
              onClick={() => setActiveRoom('maintenance')}
            >
              <span className="lawn-atelier__line-label">{line.label}</span>
              <span className="lawn-atelier__line-rule" aria-hidden="true" />
              <span className="lawn-atelier__line-state">
                {line.due ? 'Due' : line.next ? line.next : '—'}
              </span>
            </button>
          ))}
        </div>

        <div className="lawn-atelier__cover-actions">
          <button
            type="button"
            className="lawn-atelier__open"
            onClick={() => setActiveRoom('maintenance')}
          >
            Open Care chapter
          </button>
          <button
            type="button"
            className="lawn-atelier__open lawn-atelier__open--ghost"
            onClick={() => setActiveRoom('seasonal')}
          >
            Open Pack chapter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lawn-atelier" data-atelier-chapter={chapter}>
      <nav className="lawn-atelier__spine" aria-label="Journal chapters">
        {chapters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lawn-atelier__spine-btn${chapter === item.id ? ' is-active' : ''}`}
            onClick={() =>
              setActiveRoom(/** @type {'hub' | 'maintenance' | 'seasonal' | 'more'} */ (item.id))
            }
            aria-current={chapter === item.id ? 'page' : undefined}
            title={item.label}
          >
            <span className="lawn-atelier__spine-short">{item.short}</span>
            <span className="lawn-atelier__spine-label">{item.label}</span>
            {item.badge ? <span className="lawn-atelier__spine-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
      <div className="lawn-atelier__page">{page}</div>
    </div>
  );
}
