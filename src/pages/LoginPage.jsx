import { useState } from 'react';
import { useAuth } from '../state/AuthContext';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

export default function LoginPage({ loading }) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in');
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-100 px-6 text-center">
      <div className="mb-8">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-green-100 text-3xl">
          🌿
        </div>
        <h1 className="text-2xl font-black text-green-950 tracking-tight">Lawn Pack Companion</h1>
        <p className="mt-2 text-sm text-green-800">Seasonal lawn workflow & reminders</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="w-full max-w-xs space-y-4">
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={signingIn}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4 text-base font-semibold text-gray-900 shadow-sm active:bg-gray-50 disabled:opacity-60"
          >
            <GoogleIcon />
            {signingIn ? 'Signing in…' : 'Continue with Google'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs leading-relaxed text-gray-500">
            Sign in to sync your lawn schedule and tasks. Your data is private and only visible to you.
            To use a different Google account, tap Sign out first, then sign in again.
          </p>
        </div>
      )}
    </div>
  );
}
