import React from 'react';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import LawnWorkflow from './LawnWorkflow';
import LawnAlerts from './LawnAlerts';
import LawnStatusBoard, { LawnSignalMore } from './LawnStatusBoard';

/**
 * Signal — bottom tabs.
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
 * Main content switcher across classic long page and Signal tabs.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnMainView({ app }) {
  const { activeTheme } = app;
  const layout = activeTheme.layout;

  if (layout === 'tabs') {
    return <LawnTabsLayout app={app} />;
  }

  return <LawnWorkflow app={app} />;
}
