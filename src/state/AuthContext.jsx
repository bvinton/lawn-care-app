import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { claimLegacyTasks } from '../lib/claimLegacyTasks';
import { signInWithGoogleAccountPicker } from '../lib/googleSignIn';
import {
  APP_OAUTH_LABEL,
  cleanAuthCallbackFromUrl,
  formatOAuthError,
  formatPendingOAuthCodeError,
  getOAuthRedirectUrl,
  hasPendingOAuthCode,
  readOAuthCallbackError,
} from '../lib/oauthRedirect';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }

    const redirectUrl = getOAuthRedirectUrl();
    const callbackError = readOAuthCallbackError();
    if (callbackError) {
      setAuthError(formatOAuthError(APP_OAUTH_LABEL, redirectUrl, callbackError));
      cleanAuthCallbackFromUrl();
    }

    const pendingCode = hasPendingOAuthCode();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (data.session) {
        cleanAuthCallbackFromUrl();
        return;
      }

      if (pendingCode && !callbackError) {
        setAuthError(formatPendingOAuthCodeError(APP_OAUTH_LABEL, redirectUrl));
        cleanAuthCallbackFromUrl();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (nextSession) {
        setAuthError(null);
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        cleanAuthCallbackFromUrl();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!session || !supabase) {
      return;
    }

    void claimLegacyTasks(supabase);
  }, [session]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    await signInWithGoogleAccountPicker(supabase);
  };

  const signOut = async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut({ scope: 'local' });
  };

  const value = {
    session: session ?? null,
    user: session?.user ?? null,
    loading: session === undefined,
    isAuthenticated: Boolean(session),
    authError,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
