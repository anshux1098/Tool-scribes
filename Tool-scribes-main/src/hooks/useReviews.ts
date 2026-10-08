import { useState, useEffect, useCallback } from 'react';
import { Review } from '@/lib/types';
import { supabase, isSupabaseConfigured, ReviewRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { hashId } from '@/lib/hashId';

const PAGE_SIZE = 100;

function rowToReview(row: ReviewRow, myUserId: string | null, authorDisplayName: string, authorUsername: string | null): Review {
  return {
    id: hashId(row.id),
    _uuid: row.id,
    toolId: row.tool_id,
    userId: row.user_id,
    authorDisplayName,
    authorUsername,
    bestFor: row.best_for,
    gotcha: row.gotcha,
    freeTier: row.free_tier,
    rating: row.rating,
    isMine: row.user_id === myUserId,
    moderationStatus: row.moderation_status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function useReviews(toolUuid?: string) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setReviews([]);
    setMyReview(null);

    if (!isSupabaseConfigured || !toolUuid) { setLoading(false); return; }

    try {
      const { data: rows } = await supabase
        .from('reviews')
        .select('*')
        .eq('tool_id', toolUuid)
        .or(`moderation_status.eq.active${user ? `,user_id.eq.${user.id}` : ''}`)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (!rows || rows.length === 0) { setLoading(false); return; }

      const reviewerIds = [...new Set((rows as ReviewRow[]).map(r => r.user_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', reviewerIds);

      const profileMap = new Map<string, { displayName: string; username: string | null }>();
      for (const p of (profiles ?? []) as Array<{ user_id: string; username: string | null; display_name: string }>) {
        profileMap.set(p.user_id, { displayName: p.display_name || p.username || 'Anonymous', username: p.username });
      }

      const mapped = (rows as ReviewRow[]).map(r => {
        const prof = profileMap.get(r.user_id) || { displayName: 'Anonymous', username: null };
        return rowToReview(r, user?.id ?? null, prof.displayName, prof.username);
      });

      const mine = mapped.find(r => r.isMine) ?? null;
      setMyReview(mine);
      setReviews(mapped.filter(r => !r.isMine && r.moderationStatus === 'active'));
    } catch (e) { console.error('[useReviews] fetchReviews failed:', e); } finally {
      setLoading(false);
    }
  }, [toolUuid, user?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const submitReview = useCallback(async (data: { best_for: string; gotcha: string; free_tier: string; rating: number }): Promise<boolean> => {
    if (!user || !toolUuid) return false;
    try {
      const { error } = await supabase
        .from('reviews')
        .upsert({
          user_id: user.id,
          tool_id: toolUuid,
          best_for: data.best_for,
          gotcha: data.gotcha,
          free_tier: data.free_tier,
          rating: data.rating,
        }, { onConflict: 'user_id,tool_id' });
      if (error) return false;
      await fetchReviews();
      return true;
    } catch (e) { console.error('[useReviews] submitReview failed:', e); return false; }
  }, [user, toolUuid, fetchReviews]);

  const deleteReview = useCallback(async (reviewUuid: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewUuid)
        .eq('user_id', user.id);
      if (error) return false;
      await fetchReviews();
      return true;
    } catch (e) { console.error('[useReviews] deleteReview failed:', e); return false; }
  }, [user, fetchReviews]);

  const moderateReview = useCallback(async (reviewUuid: string, status: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          moderation_status: status,
          moderated_at: new Date().toISOString(),
          moderated_by: user.id,
        })
        .eq('id', reviewUuid);
      if (error) return false;
      await fetchReviews();
      return true;
    } catch (e) { console.error('[useReviews] moderateReview failed:', e); return false; }
  }, [user, fetchReviews]);

  return { reviews, myReview, loading, refetch: fetchReviews, submitReview, deleteReview, moderateReview };
}
