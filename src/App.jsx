import React from 'react';
import LawnCareApp from './components/lawn/LawnCareApp';
import LoginPage from './pages/LoginPage';
import { useAuth } from './state/AuthContext';

export default function App() {
  const { isAuthenticated, loading, signOut, user } = useAuth();

  if (loading || !isAuthenticated) {
    return <LoginPage loading={loading} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="w-full max-w-xl mx-auto px-3 sm:px-4">
        <header className="text-center mb-6">
          <div className="flex items-center justify-end mb-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 bg-white active:bg-gray-50"
              title={user?.email ?? 'Sign out'}
            >
              Sign out
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
  );
}
