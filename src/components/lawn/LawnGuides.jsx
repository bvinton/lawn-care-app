import React, { useState } from 'react';
import { LAWN_GUIDE_SECTIONS, guideActionLabel } from '../../data/lawnGuidesData';
import { openGuide } from '../../utils/openGuide';
import SprinklerLightbox from './SprinklerLightbox';

/** @param {{ setActiveScreen: (screen: string) => void }} props */
export default function LawnGuides({ setActiveScreen }) {
  const [enlargedImage, setEnlargedImage] = useState(
    /** @type {{ image: string, name: string } | null} */ (null)
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-6 border-b pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-green-800">📚 Lawn Pack Guides</h2>
          <p className="text-sm text-green-700 mt-1">
            Official literature for seasonal packs, masterclasses, and product guides.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveScreen('main')}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 px-3 rounded-lg transition-all shrink-0 self-start"
        >
          ← Back to Workflow
        </button>
      </div>

      <div className="space-y-6">
        {LAWN_GUIDE_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-black text-gray-800 mb-1">{section.title}</h3>
            {section.description && (
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{section.description}</p>
            )}
            <ul className="space-y-2">
              {section.guides.map((guide) => (
                <li
                  key={guide.file}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{guide.title}</p>
                    {guide.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{guide.description}</p>
                    )}
                  </div>
                  {guide.kind === 'image' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEnlargedImage({ image: guide.file, name: guide.title })
                      }
                      className="text-xs font-bold bg-white border border-green-200 text-green-800 py-2 px-3 rounded-lg hover:bg-green-50 transition-all shrink-0 w-full sm:w-auto text-center"
                    >
                      {guideActionLabel(guide)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openGuide(guide)}
                      className="text-xs font-bold bg-white border border-green-200 text-green-800 py-2 px-3 rounded-lg hover:bg-green-50 transition-all shrink-0 w-full sm:w-auto text-center"
                    >
                      {guideActionLabel(guide)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 mt-6 leading-relaxed">
        Guides are hosted with the app (not on your PC). PDFs open in the viewer; Word guides
        download to your phone — open them from Files or Word.
      </p>

      {enlargedImage && (
        <SprinklerLightbox
          enlargedSprinkler={enlargedImage}
          onClose={() => setEnlargedImage(null)}
        />
      )}
    </>
  );
}
