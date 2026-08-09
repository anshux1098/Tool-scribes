import { useState, useEffect, useCallback } from 'react';
import { Profile, CuratorBadge } from '@/lib/types';
import { supabase, isSupabaseConfigured, ProfileRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getFallbackAvatarUrl, getFallbackBannerUrl } from '@/lib/visuals';
import { hashId } from '@/lib/hashId';

function rowToProfile(row: ProfileRow, followerCount: number, followingCount: number): Profile {
  return {
    id: hashId(row.id),
    _uuid: row.user_id,
    username: row.username,
    displayName: row.display_name,
    tagline: row.tagline || '',
    bio: row.bio,
    location: row.location || '',
    website: row.website || '',
    github: row.github || '',
    twitter: row.twitter || '',
    linkedin: row.linkedin || '',
    avatarUrl: row.avatar_url || getFallbackAvatarUrl(row.username || row.id),
    bannerUrl: row.banner_url || getFallbackBannerUrl(row.username || row.id, row.bio || 'abstract'),
    publicProfile: row.public_profile,
    featuredCollectionId: row.featured_collection_id,
    createdAt: row.created_at || null,
    curatorBadge: (row.curator_badge as CuratorBadge) || 'none',
    showReviews: row.show_reviews !== false,
    showCollections: row.show_collections !== false,
    showFollowers: row.show_followers !== false,
    reputationScore: row.reputation_score || 0,
    signature_quote: row.signature_quote || '',
    contact_url: row.contact_url || '',
    followerCount,
    followingCount,
  };
}

export function useProfile(username?: string) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownedTools, setOwnedTools] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setProfile(null);
    setOwnedTools(0);
    setError(null);

    if (!isSupabaseConfigured) { setError('Supabase not configured'); setLoading(false); return; }
    if (!username) { setError('No username provided'); setLoading(false); return; }

    try {
      const { data: row, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (err) { setError(err.message); setLoading(false); return; }
      if (!row || (!row.public_profile && row.user_id !== user?.id)) {
        setLoading(false);
        return;
      }

      const prof = row as ProfileRow;

      const [{ count: fCount }, { count: flCount }, { count: tCount }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', prof.user_id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', prof.user_id),
        supabase.from('tools').select('*', { count: 'exact', head: true }).eq('added_by', prof.user_id),
      ]);

      setProfile(rowToProfile(prof, fCount ?? 0, flCount ?? 0));
      setOwnedTools(tCount ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[useProfile] fetchProfile failed:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [username, user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, ownedTools, loading, error, refetch: fetchProfile };
}

export function useCurrentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfileRow = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return true;
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: user.id, display_name: user.email?.split('@')[0] || 'User' });
    if (insertError) {
      console.error('[useCurrentProfile] profile auto-create failed:', insertError);
      return false;
    }
    return true;
  }, [user]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !user) { setProfile(null); setLoading(false); return; }

    try {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) { console.error('[useCurrentProfile] fetch query error:', error); setProfile(null); setLoading(false); return; }

      if (!row) {
        const created = await ensureProfileRow();
        if (!created) { setProfile(null); setLoading(false); return; }
        const { data: newRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (!newRow) { setProfile(null); setLoading(false); return; }
        const prof = newRow as ProfileRow;
        setProfile(rowToProfile(prof, 0, 0));
        setLoading(false);
        return;
      }

      const prof = row as ProfileRow;

      const [{ count: fCount }, { count: flCount }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', prof.user_id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', prof.user_id),
      ]);

      setProfile(rowToProfile(prof, fCount ?? 0, flCount ?? 0));
    } catch (e) { console.error('[useCurrentProfile] fetchProfile failed:', e); setProfile(null); } finally {
      setLoading(false);
    }
  }, [user, ensureProfileRow]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Record<string, unknown>): Promise<boolean> => {
    if (!user) { console.error('[useCurrentProfile] updateProfile: no user'); return false; }
    try {
      const ensured = await ensureProfileRow();
      if (!ensured) { console.error('[useCurrentProfile] updateProfile: could not ensure profile row'); return false; }

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('[useCurrentProfile] updateProfile error:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.error('[useCurrentProfile] updateProfile: no rows returned (update may have failed silently)');
        return false;
      }

      await fetchProfile();
      return true;
    } catch (e) {
      console.error('[useCurrentProfile] updateProfile exception:', e);
      return false;
    }
  }, [user, fetchProfile, ensureProfileRow]);

  return { profile, loading, updateProfile, refetch: fetchProfile, setProfile };
}

export function useFollow() {
  const { user } = useAuth();

  const isFollowing = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;
    console.log('[isFollowing] currentUser.id:', user.id, 'targetUserId:', targetUserId);
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();
    console.log('[isFollowing] result:', !!data);
    return !!data;
  }, [user]);

  const follow = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;
    console.log('[Follow] currentUser.id:', user.id, 'targetUserId:', targetUserId);
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (error) {
      if ((error as any)?.code === '23505') {
        console.log('[Follow] 409 detected — already following, treating as success');
        return true;
      }
      console.log('[Follow] error:', error);
      return false;
    }
    console.log('[Follow] success');
    return true;
  }, [user]);

  const unfollow = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;
    console.log('[Unfollow] currentUser.id:', user.id, 'targetUserId:', targetUserId);
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);
    if (error) {
      console.log('[Unfollow] error:', error);
      return false;
    }
    console.log('[Unfollow] success');
    return true;
  }, [user]);

  return { isFollowing, follow, unfollow };
}
