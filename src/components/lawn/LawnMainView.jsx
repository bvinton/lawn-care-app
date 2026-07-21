import React from 'react';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import LawnWorkflow from './LawnWorkflow';
import LawnHub from './LawnHub';
import LawnAlerts from './LawnAlerts';
import LawnStatusBoard, { LawnSignalMore } from './LawnStatusBoard';
import LawnTodayBoard from './LawnTodayBoard';

/**
 * @param {{
 *   app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp>,
 *   title: string,
 *   onBack?: (() => void) | null,
 *   children: React.ReactNode,
 * }} props
 */
function LawnRoomFrame({ app, title, onBack = null, children }) {
  return (
    <div className="lawn-room">
      <div className="lawn-room__bar">
        {onBack ? (
          <button type="button" className="lawn-room__back" onClick={onBack}>
            ← Back
          </button>
        ) : (
          <span className="lawn-room__back lawn-room__back--spacer" aria-hidden="true" />
        )}
        <h2 className="lawn-room__title">{title}</h2>
        <button
          type="button"
          className="lawn-room__setup"
          onClick={() => app.setActiveScreen('settings')}
        >
          Setup
        </button>
      </div>
      <LawnAlerts app={app} />
      <div className="lawn-room__body">{children}</div>
    </div>
  );
}

/**
 * Signal — bottom tabs.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnTabsLayout({ app }) {
  const { activeRoom, setActiveRoom } = app;
  const tab = activeRoom === 'maintenance' || activeRoom === 'seasonal' || activeRoom === 'more'
    ? activeRoom
    : 'hub';

  const tabs = [
    { id: 'hub', label: 'Status' },
    { id: 'maintenance', label: 'Care' },
    { id: 'seasonal', label: 'Pack' },
    { id: 'more', label: 'More' },
  ];

  let body = null;
  if (tab === 'maintenance') {
    body = (
      <div className="lawn-panel-surface">
        <MaintenancePanel app={app} />
      </div>
    );
  } else if (tab === 'seasonal') {
    body = (
      <div className="lawn-panel-surface">
        <SeasonTimeline app={app} />
      </div>
    );
  } else if (tab === 'more') {
    body = <LawnSignalMore app={app} />;
  } else {
    body = (
      <>
        <LawnAlerts app={app} />
        <LawnStatusBoard app={app} />
      </>
    );
  }

  return (
    <div className="lawn-tabs">
      <div className="lawn-tabs__body">{body}</div>
      <nav className="lawn-tabs__nav" aria-label="Primary">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lawn-tabs__tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setActiveRoom(/** @type {'hub' | 'maintenance' | 'seasonal' | 'more'} */ (item.id))}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * Canopy — top segments + today queue.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnTodayLayout({ app }) {
  const { activeRoom, setActiveRoom } = app;
  const segment =
    activeRoom === 'maintenance' || activeRoom === 'seasonal' ? activeRoom : 'hub';

  const segments = [
    { id: 'hub', label: 'Today' },
    { id: 'maintenance', label: 'Care' },
    { id: 'seasonal', label: 'Pack' },
  ];

  return (
    <div className="lawn-today-layout">
      <nav className="lawn-today-layout__segments" aria-label="Primary">
        {segments.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lawn-today-layout__seg${segment === item.id ? ' is-active' : ''}`}
            onClick={() => setActiveRoom(/** @type {'hub' | 'maintenance' | 'seasonal'} */ (item.id))}
            aria-current={segment === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="lawn-today-layout__body">
        {segment === 'maintenance' ? (
          <>
            <LawnAlerts app={app} />
            <div className="lawn-panel-surface">
              <MaintenancePanel app={app} />
            </div>
          </>
        ) : segment === 'seasonal' ? (
          <>
            <LawnAlerts app={app} />
            <div className="lawn-panel-surface">
              <SeasonTimeline app={app} />
            </div>
          </>
        ) : (
          <>
            <LawnAlerts app={app} />
            <LawnTodayBoard app={app} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Main content switcher across classic / rooms / tabs / today.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnMainView({ app }) {
  const { activeTheme, activeRoom, setActiveRoom } = app;
  const layout = activeTheme.layout;

  if (layout === 'classic') {
    return <LawnWorkflow app={app} />;
  }

  if (layout === 'tabs') {
    return <LawnTabsLayout app={app} />;
  }

  if (layout === 'today') {
    return <LawnTodayLayout app={app} />;
  }

  // rooms (Atelier)
  if (activeRoom === 'maintenance') {
    return (
      <LawnRoomFrame app={app} title="Maintenance" onBack={() => setActiveRoom('hub')}>
        <MaintenancePanel app={app} />
      </LawnRoomFrame>
    );
  }

  if (activeRoom === 'seasonal') {
    return (
      <LawnRoomFrame app={app} title="Seasonal Pack" onBack={() => setActiveRoom('hub')}>
        <SeasonTimeline app={app} />
      </LawnRoomFrame>
    );
  }

  return (
    <>
      <LawnAlerts app={app} />
      <LawnHub app={app} />
    </>
  );
}
