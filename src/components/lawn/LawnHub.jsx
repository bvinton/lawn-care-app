import React from 'react';
import { SEASONS } from '../../data/LawnPackData';
import { formatSyncTimeAgo } from '../../utils/lawnDates';
import { CalculatorIcon } from './LawnMaterials';

/**
 * Hub home for sectioned themes.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnHub({ app }) {
  const {
    runFullCloudSync,
    cloudSyncStatus,
    lastCloudSyncAt,
    setActiveScreen,
    setActiveRoom,
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
  } = app;

  const dueItems = [
    mowingDue ? 'Mowing' : null,
    wateringDue ? 'Watering' : null,
    verticutDue ? 'Verticut' : null,
    gypsumDue ? 'Gypsum' : null,
  ].filter(Boolean);
  const dueCount = dueItems.length;

  const heroStatus = seedEstablishmentActive
    ? {
        title: 'Seed lock',
        lede: 'Mowing paused while seed establishes.',
        tone: 'alert',
      }
    : dueCount > 0
      ? {
          title: dueCount === 1 ? '1 task due' : `${dueCount} tasks due`,
          lede: dueItems.join(' · '),
          tone: 'alert',
        }
      : {
          title: 'All clear',
          lede: 'Nothing due right now.',
          tone: 'ok',
        };

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

  const rooms = [
    {
      id: 'maintenance',
      title: 'Maintenance',
      meta: dueCount > 0 ? `${dueCount} due` : seedEstablishmentActive ? 'Seed lock' : 'Up to date',
      tone: dueCount > 0 || seedEstablishmentActive ? 'alert' : 'ok',
      icon: '✂️',
    },
    {
      id: 'seasonal',
      title: 'Seasonal Pack',
      meta: springPackIncomplete
        ? `${incompleteSpringSteps.length} Spring left`
        : SEASONS[currentSeason]?.name ?? 'Open',
      tone: springPackIncomplete ? 'warn' : 'ok',
      icon: '📋',
    },
  ];

  return (
    <div className="lawn-hub">
      <header className={`lawn-hub__hero lawn-hub__hero--${heroStatus.tone}`}>
        {dueCount > 0 || seedEstablishmentActive ? (
          <button
            type="button"
            className="lawn-hub__hero-open"
            onClick={() => setActiveRoom('maintenance')}
          >
            <span className="lawn-hub__hero-open-copy">
              <span className="lawn-hub__kicker">Today</span>
              <span className="lawn-hub__title">{heroStatus.title}</span>
              <span className="lawn-hub__lede">{heroStatus.lede}</span>
            </span>
            <span className="lawn-hub__hero-open-icon" aria-hidden="true">
              →
            </span>
            <span className="sr-only">Open Maintenance</span>
          </button>
        ) : (
          <>
            <p className="lawn-hub__kicker">Today</p>
            <h2 className="lawn-hub__title">{heroStatus.title}</h2>
            <p className="lawn-hub__lede">{heroStatus.lede}</p>
          </>
        )}
      </header>

      {(petLockoutActive || springPackIncomplete) && (
        <div className="lawn-hub__notices" aria-live="polite">
          {petLockoutActive && (
            <p className="lawn-hub__notice lawn-hub__notice--alert">
              Chemical drying — pets off the lawn for now.
            </p>
          )}
          {springPackIncomplete && (
            <p className="lawn-hub__notice lawn-hub__notice--warn">
              Spring Pack still in progress — open Seasonal Pack to finish.
            </p>
          )}
        </div>
      )}

      <section className="lawn-hub__weather" aria-label="Weather">
        <p className="lawn-hub__weather-text">
          {weatherLocationLabel}: {weatherStatusText}
        </p>
      </section>

      <section className="lawn-hub__rooms" aria-label="Sections">
        <div className="lawn-hub__room-grid">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`lawn-hub__room lawn-hub__room--${room.tone}`}
              onClick={() => setActiveRoom(room.id)}
            >
              <span className="lawn-hub__room-icon" aria-hidden="true">
                {room.icon}
              </span>
              <span className="lawn-hub__room-copy">
                <span className="lawn-hub__room-title">{room.title}</span>
              </span>
              <span className="lawn-hub__room-meta">{room.meta}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="lawn-hub__tools" aria-label="Tools">
        <div className="lawn-hub__tool-grid">
          <button
            type="button"
            onClick={() => void runFullCloudSync()}
            disabled={cloudSyncStatus === 'pulling' || cloudSyncStatus === 'pushing'}
            className="lawn-hub__tool"
            title={
              cloudSyncStatus === 'synced' && lastCloudSyncAt
                ? `Synced ${formatSyncTimeAgo(lastCloudSyncAt)} — tap to refresh`
                : 'Sync schedule to cloud'
            }
          >
            <span aria-hidden="true">
              {cloudSyncStatus === 'synced' ? '☁️✓' : cloudSyncStatus === 'error' ? '☁️!' : '☁️↻'}
            </span>
            <span>{syncLabel ?? 'Synced'}</span>
          </button>
          <button type="button" onClick={() => setActiveScreen('materials')} className="lawn-hub__tool">
            <CalculatorIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Materials</span>
          </button>
          <button type="button" onClick={() => setActiveScreen('guides')} className="lawn-hub__tool">
            <span aria-hidden="true">📚</span>
            <span>Guides</span>
          </button>
          <button type="button" onClick={() => setActiveScreen('settings')} className="lawn-hub__tool">
            <span aria-hidden="true">⚙️</span>
            <span>Setup</span>
          </button>
        </div>
      </section>
    </div>
  );
}
