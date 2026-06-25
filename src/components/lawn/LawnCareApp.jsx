import React, { useCallback, useEffect } from 'react';
import { useLawnCareApp } from '../../hooks/useLawnCareApp';
import {
  useMobileBackNavigation,
  useRegisterBackHandler,
} from '../../hooks/useMobileBackNavigation';
import { pushAppHistoryState } from '../../utils/backNavigation';
import LawnSettings from './LawnSettings';
import LawnWorkflow from './LawnWorkflow';
import LawnGuides from './LawnGuides';
import SprinklerLightbox from './SprinklerLightbox';

export default function LawnCareApp() {
  const app = useLawnCareApp();

  const isAtRoot = useCallback(
    () =>
      app.activeScreen === 'main' &&
      !app.enlargedSprinkler &&
      !app.showLevellingGuide,
    [app.activeScreen, app.enlargedSprinkler, app.showLevellingGuide]
  );

  const onReturnToMain = useCallback(() => {
    app.setActiveScreen('main');
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

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-4 sm:p-6 border border-green-100">
      {app.activeScreen === 'settings' ? (
        <LawnSettings app={app} />
      ) : app.activeScreen === 'guides' ? (
        <LawnGuides setActiveScreen={app.setActiveScreen} />
      ) : (
        <LawnWorkflow app={app} />
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
