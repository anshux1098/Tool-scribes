import React, { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
}

const defaultAuthState: AuthState = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isModerator: false,
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((e) => {
      console.error('[useAuth] getSession failed:', e);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !user) {
      setIsAdmin(false);
      setIsModerator(false);
      return;
    }

    Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('is_moderator'),
    ]).then(([adminRes, modRes]) => {
      if (active) {
        setIsAdmin(!!adminRes.data);
        setIsModerator(!!modRes.data);
      }
    }).catch((e) => {
      console.error('[useAuth] role check failed:', e);
      if (active) {
        setIsAdmin(false);
        setIsModerator(false);
      }
    });

    return () => { active = false; };
  }, [user]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isAdmin,
    isModerator,
  }), [user, session, loading, isAdmin, isModerator]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context) {
    return context;
  }
  // Safe fallback for tests or isolated components rendered outside AuthProvider
  return defaultAuthState;
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  return supabase.auth.signOut();
}

export async function resetPasswordForEmail(email: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const redirectTo = window.location.origin + '/auth/callback';
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(newPassword: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  return supabase.auth.updateUser({ password: newPassword });
}
