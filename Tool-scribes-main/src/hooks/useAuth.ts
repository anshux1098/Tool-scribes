import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  const checkRoles = async () => {
    if (!isSupabaseConfigured || !user) { setIsAdmin(false); setIsModerator(false); return; }
    const [adminRes, modRes] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.rpc('is_moderator'),
    ]);
    setIsAdmin(!!adminRes.data);
    setIsModerator(!!modRes.data);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((e) => console.error('[useAuth] getSession failed:', e));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    checkRoles();
  }, [user]);

  return { user, session, loading, isAdmin, isModerator };
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
