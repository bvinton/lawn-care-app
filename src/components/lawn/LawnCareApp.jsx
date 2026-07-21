import React, { useCallback, useEffect } from 'react';
import { useLawnCareApp } from '../../hooks/useLawnCareApp';
import {
  useMobileBackNavigation,
  useRegisterBackHandler,
} from '../../hooks/useMobileBackNavigation';
import { pushAppHistoryState } from '../../utils/backNavigation';
import LawnSettings from './LawnSettings';
import LawnMainView from './LawnMainView';
import LawnGuides from './LawnGuides';
import LawnMaterials from './LawnMaterials';
import SprinklerLightbox from './SprinklerLightbox';

export default function LawnCareApp() {
  const app = useLawnCareApp();

  const isAtRoot = useCallback(
    () =>
      app.activeScreen === 'main' &&
      (app.activeTheme.layout === 'classic' || app.activeRoom === 'hub') &&
      !app.enlargedSprinkler &&
      !app.showLevellingGuide,
    [
      app.activeScreen,
      app.activeTheme.layout,
      app.activeRoom,
      app.enlargedSprinkler,
      app.showLevellingGuide,
    ]
  );

  const onReturnToMain = useCallback(() => {
    app.setActiveScreen('main');
    if (app.activeTheme.layout === 'rooms') {
      app.setActiveRoom('hub');
    }
    app.setShowLevellingGuide(false);
    app.setEnlargedSprinkler(null);
  }, [app]);

  useMobileBackNavigation({ isAtRoot, onReturnToMain });

  useEffect(() => {
    if (app.activeScreen !== 'main') {
      pushAppHistoryState({ screen: app.activeScreen });
    }
  }, [app.activeScreen]);

  useEffect(() => {
    if (app.activeTheme.layout === 'rooms' && app.activeRoom !== 'hub' && app.activeScreen === 'main') {
      pushAppHistoryState({ room: app.activeRoom });
    }
  }, [app.activeRoom, app.activeTheme.layout, app.activeScreen]);

  useEffect(() => {
    if (app.enlargedSprinkler) {
      pushAppHistoryState({ overlay: 'sprinkler' });
    }
  }, [app.enlargedSprinkler]);

  useEffect(() => {
    if (app.showLevellingGuide) {
      pushAppHistoryState({ overlay: 'levelling' });
    }
  }, [app.showLevellingGuide]);

  useRegisterBackHandler(() => {
    if (app.enlargedSprinkler) {
      app.setEnlargedSprinkler(null);
      return true;
    }
    return false;
  }, Boolean(app.enlargedSprinkler));

  useRegisterBackHandler(() => {
    if (app.showLevellingGuide) {
      app.setShowLevellingGuide(false);
      return true;
    }
    return false;
  }, Boolean(app.showLevellingGuide));

  useRegisterBackHandler(() => {
    if (
      app.activeTheme.layout === 'rooms' &&
      app.activeScreen === 'main' &&
      app.activeRoom !== 'hub'
    ) {
      app.setActiveRoom('hub');
      return true;
    }
    return false;
  }, app.activeTheme.layout === 'rooms' && app.activeScreen === 'main' && app.activeRoom !== 'hub');

  return (
    <div
      className="lawn-app-shell w-full max-w-xl mx-auto overflow-hidden"
      data-lawn-theme={app.activeTheme.id}
      data-lawn-layout={app.activeTheme.layout}
    >
      {app.activeScreen === 'settings' ? (
        <LawnSettings app={app} />
      ) : app.activeScreen === 'guides' ? (
        <LawnGuides setActiveScreen={app.setActiveScreen} />
      ) : app.activeScreen === 'materials' ? (
        <LawnMaterials app={app} />
      ) : (
        <LawnMainView app={app} />
      )}

      {app.enlargedSprinkler && (
        <SprinklerLightbox
          enlargedSprinkler={app.enlargedSprinkler}
          onClose={() => app.setEnlargedSprinkler(null)}
        />
      )}
    </div>
  );
}
