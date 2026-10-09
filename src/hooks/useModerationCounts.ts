import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ModerationCounts {
  pendingTools: number;
  pendingReviews: number;
  pendingTags: number;
  pendingAlternatives: number;
  totalPending: number;
}

async function fetchModerationCounts(): Promise<ModerationCounts> {
  if (!isSupabaseConfigured) {
    return { pendingTools: 0, pendingReviews: 0, pendingTags: 0, pendingAlternatives: 0, totalPending: 0 };
  }

  const [toolsRes, reviewsRes, tagsRes, alternativesRes] = await Promise.all([
    supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('is_flagged', true).eq('moderation_status', 'active'),
    supabase.from('tags').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tool_alternatives').select('id', { count: 'exact', head: true }).eq('approved', false),
  ]);

  const pendingTools = toolsRes.count ?? 0;
  const pendingReviews = reviewsRes.count ?? 0;
  const pendingTags = tagsRes.count ?? 0;
  const pendingAlternatives = alternativesRes.count ?? 0;

  return {
    pendingTools,
    pendingReviews,
    pendingTags,
    pendingAlternatives,
    totalPending: pendingTools + pendingReviews + pendingTags + pendingAlternatives,
  };
}

export function useModerationCounts(enabled = true) {
  return useQuery({
    queryKey: ['moderation-counts'],
    queryFn: fetchModerationCounts,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 2,
    enabled,
  });
}
