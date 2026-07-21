import React from 'react';
import MaintenancePanel from './MaintenancePanel';
import SeasonTimeline from './SeasonTimeline';
import LawnWorkflow from './LawnWorkflow';
import LawnHub from './LawnHub';
import LawnAlerts from './LawnAlerts';

/**
 * Room chrome for sectioned themes — keeps deep-link DOM ids mounted inside the active room.
 * @param {{
 *   app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp>,
 *   title: string,
 *   children: React.ReactNode,
 * }} props
 */
function LawnRoomFrame({ app, title, children }) {
  return (
    <div className="lawn-room">
      <div className="lawn-room__bar">
        <button
          type="button"
          className="lawn-room__back"
          onClick={() => app.setActiveRoom('hub')}
        >
          ← Home
        </button>
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
 * Main content switcher: classic long page vs sectioned rooms.
 * @param {{ app: ReturnType<import('../../hooks/useLawnCareApp').useLawnCareApp> }} props
 */
export default function LawnMainView({ app }) {
  const { activeTheme, activeRoom } = app;

  if (activeTheme.layout === 'classic') {
    return <LawnWorkflow app={app} />;
  }

  if (activeRoom === 'maintenance') {
    return (
      <LawnRoomFrame app={app} title="Maintenance">
        <MaintenancePanel app={app} />
      </LawnRoomFrame>
    );
  }

  if (activeRoom === 'seasonal') {
    return (
      <LawnRoomFrame app={app} title="Seasonal Pack">
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
