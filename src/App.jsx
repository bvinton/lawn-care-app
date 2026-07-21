import React from 'react';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import LawnCareApp from './components/lawn/LawnCareApp';
import LoginPage from './pages/LoginPage';
import { useAuth } from './state/AuthContext';
import { getLawnTheme, LAWN_THEME_STORAGE_KEY, readStoredLawnThemeId } from './data/lawnThemes';

function useDocumentLawnTheme() {
  const [themeId, setThemeId] = React.useState(() => readStoredLawnThemeId());

  React.useEffect(() => {
    const onStorage = (event) => {
      if (event.key === LAWN_THEME_STORAGE_KEY && event.newValue) {
        setThemeId(event.newValue);
      }
    };
    const onThemeChange = (event) => {
      if (event?.detail?.themeId) setThemeId(event.detail.themeId);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('lawn-theme-change', onThemeChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('lawn-theme-change', onThemeChange);
    };
  }, []);

  return getLawnTheme(themeId);
}

export default function App() {
  const { isAuthenticated, loading, signOut, user } = useAuth();
  const theme = useDocumentLawnTheme();

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
      <div
        className="lawn-app-page min-h-screen py-4 sm:py-8"
        data-lawn-theme={theme.id}
        data-lawn-layout={theme.layout}
        style={{
          ['--lawn-font-display']: theme.fontDisplay,
          ['--lawn-font-body']: theme.fontBody,
        }}
      >
        <div className="w-full max-w-xl mx-auto px-3 sm:px-4">
          <header className="lawn-app-header text-center mb-6">
            <div className="flex items-center justify-end mb-2">
              <button
                type="button"
                onClick={() => void signOut()}
                className="lawn-sign-out inline-flex items-center justify-center w-10 h-10 rounded-xl border"
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
            <h1 className="lawn-app-brand">Lawn Pack</h1>
            <p className="lawn-app-subhead">Companion</p>
          </header>

          <main>
            <LawnCareApp />
          </main>

          <footer className="lawn-app-footer text-center text-[10px] mt-6 font-semibold">
            Switch look &amp; layout anytime in Setup → Appearance
          </footer>
        </div>
      </div>
    </>
  );
}
