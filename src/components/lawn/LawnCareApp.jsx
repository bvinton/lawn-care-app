import React from 'react';
import { useLawnCareApp } from '../../hooks/useLawnCareApp';
import LawnSettings from './LawnSettings';
import LawnWorkflow from './LawnWorkflow';
import LawnGuides from './LawnGuides';
import SprinklerLightbox from './SprinklerLightbox';

export default function LawnCareApp() {
  const app = useLawnCareApp();

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-3xl m-4 p-6 border border-green-100">
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
