import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface FeedItem {
  id: string;
  type: 'tool' | 'collection';
  curatorUserId: string;
  curatorUsername: string | null;
  curatorDisplayName: string;
  targetId: string;
  targetName: string;
  targetDescription: string;
  targetUrl?: string;
  targetCategory?: string;
  targetFavicon?: string;
  createdAt: string;
}

export interface FollowedCollection {
  id: string;
  _uuid: string;
  name: string;
  description: string;
  toolCount: number;
  curatorUserId: string;
  curatorUsername: string | null;
  curatorDisplayName: string;
  createdAt: string;
}

export interface FollowedCurator {
  userId: string;
  username: string | null;
  displayName: string;
  reputationScore: number;
  followerCount: number;
  bio: string;
}

export function useFollowingFeed() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const [followedCollections, setFollowedCollections] = useState<FollowedCollection[]>([]);
  const [followedCurators, setFollowedCurators] = useState<FollowedCurator[]>([]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setFeed([]);
    setFollowingCount(0);
    setFollowedCollections([]);
    setFollowedCurators([]);

    if (!isSupabaseConfigured || !user) { setLoading(false); return; }

    try {
      // ── 1. Fetch followed curators (from follows table) ──
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = (followRows ?? []).map(r => r.following_id as string);
      setFollowingCount(followingIds.length);

      // ── 2. Fetch followed collections (from collection_followers table) ──
      const { data: colFollowRows } = await supabase
        .from('collection_followers')
        .select('collection_id, created_at')
        .eq('user_id', user.id);

      const followedColIds = (colFollowRows ?? []).map(r => r.collection_id as string);

      // ── 3. Fetch profiles for followed curators ──
      let profileMap = new Map<string, { username: string | null; displayName: string; bio: string; reputationScore: number; followerCount: number }>();
      if (followingIds.length > 0) {
        const { data: profilesRes } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, bio, reputation_score')
          .in('user_id', followingIds);

        // Batch fetch follower counts for all followed curators
        const followerCounts = new Map<string, number>();
        if (followingIds.length > 0) {
          const { data: countRows } = await supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: false })
            .in('following_id', followingIds);
          // Count rows per following_id
          for (const id of followingIds) {
            const cnt = (countRows ?? []).filter((r: { following_id: string }) => r.following_id === id).length;
            followerCounts.set(id, cnt);
          }
        }

        for (const p of (profilesRes ?? []) as Array<{ user_id: string; username: string | null; display_name: string; bio: string; reputation_score: number }>) {
          profileMap.set(p.user_id, {
            username: p.username,
            displayName: p.display_name,
            bio: p.bio,
            reputationScore: p.reputation_score,
            followerCount: followerCounts.get(p.user_id) ?? 0,
          });
        }
      }

      // ── 4. Build followed curators list ──
      const curators: FollowedCurator[] = [];
      for (const id of followingIds) {
        const p = profileMap.get(id);
        if (p) {
          curators.push({
            userId: id,
            username: p.username,
            displayName: p.displayName || p.username || 'Unknown',
            reputationScore: p.reputationScore,
            followerCount: p.followerCount,
            bio: p.bio,
          });
        }
      }
      setFollowedCurators(curators);

      // ── 5. Build followed collections list ──
      if (followedColIds.length > 0) {
        const { data: colsData } = await supabase
          .from('collections')
          .select('id, name, description, user_id, created_at')
          .in('id', followedColIds)
          .eq('is_public', true);

        // Fetch tool counts for each collection
        const { data: ctData } = await supabase
          .from('collection_tools')
          .select('collection_id, tool_id')
          .in('collection_id', followedColIds);

        const toolCountMap = new Map<string, number>();
        for (const ct of (ctData ?? []) as Array<{ collection_id: string; tool_id: string }>) {
          toolCountMap.set(ct.collection_id, (toolCountMap.get(ct.collection_id) ?? 0) + 1);
        }

        // Fetch curator profiles for collection owners
        const colOwnerIds = [...new Set((colsData ?? []).map((c: { user_id: string }) => c.user_id))];
        const { data: colOwnerProfiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name')
          .in('user_id', colOwnerIds);

        const colOwnerMap = new Map<string, { username: string | null; displayName: string }>();
        for (const p of (colOwnerProfiles ?? []) as Array<{ user_id: string; username: string | null; display_name: string }>) {
          colOwnerMap.set(p.user_id, { username: p.username, displayName: p.display_name });
        }

        const followedCols: FollowedCollection[] = (colsData ?? []).map((c: { id: string; name: string; description: string; user_id: string; created_at: string }) => {
          const owner = colOwnerMap.get(c.user_id) || { username: null, displayName: 'Unknown' };
          return {
            id: c.id,
            _uuid: c.id,
            name: c.name,
            description: c.description ?? '',
            toolCount: toolCountMap.get(c.id) ?? 0,
            curatorUserId: c.user_id,
            curatorUsername: owner.username,
            curatorDisplayName: owner.displayName,
            createdAt: c.created_at,
          };
        });
        setFollowedCollections(followedCols);
      }

      if (followingIds.length === 0) { setLoading(false); return; }

      // ── 6. Build activity feed (tools + collections from followed curators) ──
      const [toolsRes, colsRes] = await Promise.all([
        supabase
          .from('tools')
          .select('id, name, description, url, category, favicon, created_at, added_by')
          .in('added_by', followingIds)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('collections')
          .select('id, name, description, created_at, user_id')
          .in('user_id', followingIds)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const items: FeedItem[] = [];

      for (const t of (toolsRes.data ?? []) as Array<{
        id: string; name: string; description: string; url: string;
        category: string; favicon: string; created_at: string; added_by: string;
      }>) {
        const cp = profileMap.get(t.added_by);
        items.push({
          id: `tool-${t.id}`,
          type: 'tool',
          curatorUserId: t.added_by,
          curatorUsername: cp?.username ?? null,
          curatorDisplayName: cp?.displayName || cp?.username || 'Unknown',
          targetId: t.id,
          targetName: t.name,
          targetDescription: t.description,
          targetUrl: t.url,
          targetCategory: t.category,
          targetFavicon: t.favicon,
          createdAt: t.created_at,
        });
      }

      for (const c of (colsRes.data ?? []) as Array<{
        id: string; name: string; description: string; created_at: string; user_id: string;
      }>) {
        const cp = profileMap.get(c.user_id);
        items.push({
          id: `col-${c.id}`,
          type: 'collection',
          curatorUserId: c.user_id,
          curatorUsername: cp?.username ?? null,
          curatorDisplayName: cp?.displayName || cp?.username || 'Unknown',
          targetId: c.id,
          targetName: c.name,
          targetDescription: c.description,
          createdAt: c.created_at,
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFeed(items);
    } catch (e) { console.error('[useFollowingFeed] fetchFeed failed:', e); } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  return { feed, loading, followingCount, followedCollections, followedCurators, refetch: fetchFeed };
}
