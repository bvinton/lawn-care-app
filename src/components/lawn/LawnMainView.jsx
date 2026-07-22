import React from 'react';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import LawnWorkflow from './LawnWorkflow';
import LawnHub from './LawnHub';
import LawnAlerts from './LawnAlerts';
import LawnStatusBoard, { LawnSignalMore } from './LawnStatusBoard';
import LawnFolioBoard from './LawnFolioBoard';
import LawnCanopyBoard from './LawnCanopyBoard';

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
 * Atelier — original moss home hub with separate rooms.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnRoomsLayout({ app }) {
  const { activeRoom, setActiveRoom } = app;

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

/**
 * Folio — paper desk with folder tabs.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
function LawnDeskLayout({ app }) {
  return (
    <div className="lawn-folio-shell">
      <LawnAlerts app={app} />
      <LawnFolioBoard app={app} />
    </div>
  );
}

/**
 * Canopy — neon yard board + sheet overlays for Care/Pack.
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
 * Main content switcher across classic / rooms / tabs / today / desk.
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

  if (layout === 'desk') {
    return <LawnDeskLayout app={app} />;
  }

  if (layout === 'today') {
    return <LawnTodayLayout app={app} />;
  }

  return <LawnWorkflow app={app} />;
}
