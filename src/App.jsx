import React from 'react';
import LawnCareApp from './components/lawn/LawnCareApp';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="w-full max-w-xl mx-auto px-3 sm:px-4">
        <header className="text-center mb-6">
          <h1 className="text-2xl font-black text-green-950 tracking-tight">
            🌿 THE LAWN PACK COMPANION
          </h1>
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mt-1">
            Data-Driven Multi-Season Task Tracker
          </p>
        </header>

        <main>
          <LawnCareApp />
        </main>

        <footer className="text-center text-[10px] text-gray-400 mt-6 font-semibold">
          Lawn Pack Engine v2.0.0 • Verified Sequence Matrix
        </footer>
      </div>
    </div>
  );
}
