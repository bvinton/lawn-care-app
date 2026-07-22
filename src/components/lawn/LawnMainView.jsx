import React from 'react';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import LawnWorkflow from './LawnWorkflow';
import LawnAlerts from './LawnAlerts';
import LawnStatusBoard, { LawnSignalMore } from './LawnStatusBoard';
import LawnAtelierBoard from './LawnAtelierBoard';
import LawnCanopyBoard from './LawnCanopyBoard';

/**
 * Signal — bottom tabs (unchanged).
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnTabsLayout({ app }) {
  const { activeRoom, setActiveRoom } = app;
  const tab =
    activeRoom === 'maintenance' || activeRoom === 'seasonal' || activeRoom === 'more'
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
            onClick={() =>
              setActiveRoom(/** @type {'hub' | 'maintenance' | 'seasonal' | 'more'} */ (item.id))
            }
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
 * Atelier — journal spine + chapter page.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnRoomsLayout({ app }) {
  return (
    <div className="lawn-atelier-shell">
      <LawnAlerts app={app} />
      <LawnAtelierBoard app={app} />
    </div>
  );
}

/**
 * Canopy — daylight timeline + sheet overlays for Care/Pack.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnTodayLayout({ app }) {
  const { activeRoom, setActiveRoom } = app;
  const sheet = activeRoom === 'maintenance' || activeRoom === 'seasonal' ? activeRoom : null;

  if (sheet) {
    return (
      <div className="lawn-canopy-sheet">
        <div className="lawn-canopy-sheet__bar">
          <button type="button" className="lawn-canopy-sheet__back" onClick={() => setActiveRoom('hub')}>
            ← Today
          </button>
          <h2 className="lawn-canopy-sheet__title">{sheet === 'maintenance' ? 'Care' : 'Pack'}</h2>
          <button
            type="button"
            className="lawn-canopy-sheet__setup"
            onClick={() => app.setActiveScreen('settings')}
          >
            Setup
          </button>
        </div>
        <LawnAlerts app={app} />
        <div className="lawn-panel-surface">
          {sheet === 'maintenance' ? <MaintenancePanel app={app} /> : <SeasonTimeline app={app} />}
        </div>
      </div>
    );
  }

  return (
    <>
      <LawnAlerts app={app} />
      <LawnCanopyBoard app={app} />
    </>
  );
}

/**
 * Main content switcher across classic / rooms / tabs / today.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnMainView({ app }) {
  const { activeTheme } = app;
  const layout = activeTheme.layout;

  if (layout === 'tabs') {
    return <LawnTabsLayout app={app} />;
  }

  if (layout === 'rooms') {
    return <LawnRoomsLayout app={app} />;
  }

  if (layout === 'today') {
    return <LawnTodayLayout app={app} />;
  }

  return <LawnWorkflow app={app} />;
}
