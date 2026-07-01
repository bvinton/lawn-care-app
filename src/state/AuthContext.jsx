import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { claimLegacyTasks } from '../lib/claimLegacyTasks';
import { signInWithGoogleAccountPicker } from '../lib/googleSignIn';

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
