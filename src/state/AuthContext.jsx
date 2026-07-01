import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { claimLegacyTasks } from '../lib/claimLegacyTasks';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
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
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      throw error;
    }
  };

  const switchGoogleAccount = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
  };

  const value = {
    session: session ?? null,
    user: session?.user ?? null,
    loading: session === undefined,
    isAuthenticated: Boolean(session),
    signInWithGoogle,
    switchGoogleAccount,
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
