import React from 'react';

/** @param {{ enlargedSprinkler: { image: string, name: string }, onClose: () => void }} props */
export default function SprinklerLightbox({ enlargedSprinkler, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${enlargedSprinkler.name} photo preview`}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white p-3 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-bold shadow-lg hover:bg-gray-700"
          aria-label="Close photo preview"
        >
          ✕
        </button>
        <img
          src={enlargedSprinkler.image}
          alt={enlargedSprinkler.name}
          className="w-full max-h-[70vh] object-contain rounded-lg border border-gray-200"
        />
        <p className="mt-2 text-center text-sm font-bold text-gray-800">
          {enlargedSprinkler.name}
        </p>
      </div>
    </div>
  );
}
