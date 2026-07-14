import React from 'react';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import LawnCareApp from './components/lawn/LawnCareApp';
import LoginPage from './pages/LoginPage';
import { useAuth } from './state/AuthContext';

export default function App() {
  const { isAuthenticated, loading, signOut, user } = useAuth();

  if (loading || !isAuthenticated) {
    return (
      <>
        <AppUpdatePrompt />
        <LoginPage loading={loading} />
      </>
    );
  }

  return (
    <>
    <AppUpdatePrompt />
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="w-full max-w-xl mx-auto px-3 sm:px-4">
        <header className="text-center mb-6">
          <div className="flex items-center justify-end mb-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-500 active:bg-gray-50"
              aria-label="Sign out"
              title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
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
    </>
  );
}
