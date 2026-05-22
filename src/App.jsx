import React from 'react';
import SprayerCalculator from './components/SprayerCalculator';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4 sm:px-0">
        <header className="text-center mb-6">
          <h1 className="text-2xl font-black text-green-950 tracking-tight">
            🌿 THE LAWN PACK COMPANION
          </h1>
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mt-1">
            Data-Driven Multi-Season Task Tracker
          </p>
        </header>

        <main>
          <SprayerCalculator />
        </main>

        <footer className="text-center text-[10px] text-gray-400 mt-6 font-semibold">
          Lawn Pack Engine v2.0.0 • Verified Sequence Matrix
        </footer>
      </div>
    </div>
  );
}
