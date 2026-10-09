import { useState, useEffect, useMemo, useCallback } from 'react';
import { Collection, ToolCategory } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { hashId } from '@/lib/hashId';

export type CollectionSort = 'trending' | 'newest' | 'followers' | 'updated' | 'clones';

export interface EnhancedCollection extends Collection {
  _uuid: string;
  curatorUserId: string;
  categories: ToolCategory[];
  tools: { name: string; icon: string; favicon: string; _uuid: string }[];
}

export interface UsePublicCollectionsResult {
  collections: EnhancedCollection[];
  featured: EnhancedCollection[];
  trending: EnhancedCollection[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (s: string) => void;
  categoryFilter: ToolCategory | null;
  setCategoryFilter: (c: ToolCategory | null) => void;
  sort: CollectionSort;
  setSort: (s: CollectionSort) => void;
  filtered: EnhancedCollection[];
  allCategories: ToolCategory[];
  refetch: () => Promise<void>;
}

export function usePublicCollections(): UsePublicCollectionsResult {
  const [collections, setCollections] = useState<EnhancedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | null>(null);
  const [sort, setSort] = useState<CollectionSort>('trending');

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!isSupabaseConfigured) {
      setCollections([]);
      setLoading(false);
      return;
    }
    try {
      const { data: rows, error: err } = await supabase
        .from('collections')
        .select('*, collection_tools(count)')
        .eq('is_public', true)
        .order('updated_at', { ascending: false });

      if (err) throw err;
      if (!rows || rows.length === 0) {
        setCollections([]);
        setLoading(false);
        return;
      }

      const colIds = rows.map(r => (r as Record<string, unknown>).id as string);
      const userIds = rows.map(r => (r as Record<string, unknown>).user_id as string);

      // Batch fetch profiles
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map<string, { username: string | null; displayName: string; avatarUrl: string }>();
      for (const p of (profileRows ?? []) as Array<Record<string, unknown>>) {
        profileMap.set(p.user_id as string, {
          username: (p.username as string) ?? null,
          displayName: (p.display_name as string) || (p.username as string) || 'Unknown',
          avatarUrl: (p.avatar_url as string) ?? '',
        });
      }

      // Batch fetch collection_followers counts
      const { data: followRows } = await supabase
        .from('collection_followers')
        .select('collection_id')
        .in('collection_id', colIds);

      const followCountMap = new Map<string, number>();
      for (const f of (followRows ?? []) as Array<{ collection_id: string }>) {
        followCountMap.set(f.collection_id, (followCountMap.get(f.collection_id) || 0) + 1);
      }

      // Batch fetch collection_tools to get tool ids
      const { data: ctRows } = await supabase
        .from('collection_tools')
        .select('collection_id, tool_id')
        .in('collection_id', colIds);

      const colToolsMap = new Map<string, string[]>();
      const allToolIds = new Set<string>();
      for (const ct of (ctRows ?? []) as Array<{ collection_id: string; tool_id: string }>) {
        const ids = colToolsMap.get(ct.collection_id) ?? [];
        ids.push(ct.tool_id);
        colToolsMap.set(ct.collection_id, ids);
        allToolIds.add(ct.tool_id);
      }

      // Batch fetch tool info (categories + icons)
      const { data: toolRows } = await supabase
        .from('tools')
        .select('id, name, icon, favicon, category')
        .in('id', [...allToolIds]);

      const toolInfoMap = new Map<string, { name: string; icon: string; favicon: string; category: ToolCategory; _uuid: string }>();
      for (const t of (toolRows ?? []) as Array<Record<string, unknown>>) {
        toolInfoMap.set(t.id as string, {
          name: t.name as string,
          icon: t.icon as string,
          favicon: t.favicon as string,
          category: (t.category as ToolCategory) ?? 'util',
          _uuid: t.id as string,
        });
      }

      // Map collections
      const mapped: EnhancedCollection[] = rows.map((r: Record<string, unknown>) => {
        const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
        const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
        const cid = r.id as string;
        const toolIds = colToolsMap.get(cid) ?? [];
        const toolInfos = toolIds.map(tid => toolInfoMap.get(tid)).filter(Boolean) as { name: string; icon: string; favicon: string; category: ToolCategory; _uuid: string }[];
        const cats = [...new Set(toolInfos.map(t => t.category))];
        const profile = profileMap.get(r.user_id as string);
        return {
          id: hashId(cid),
          _uuid: cid,
          name: r.name as string,
          description: (r.description as string) ?? '',
          isPublic: true,
          toolCount: countVal,
          createdAt: new Date(r.created_at as string).getTime(),
          updatedAt: new Date(r.updated_at as string).getTime(),
          coverImageUrl: (r.cover_image_url as string) || undefined,
          followerCount: followCountMap.get(cid) ?? 0,
          cloneCount: (r.clone_count as number) ?? 0,
          viewCount: (r.view_count as number) ?? 0,
          featured: (r.featured as boolean) ?? false,
          categories: cats,
          curatorName: profile?.displayName ?? 'Unknown',
          curatorUsername: profile?.username ?? undefined,
          curatorAvatar: profile?.avatarUrl ?? undefined,
          curatorUserId: r.user_id as string,
          tools: toolInfos.map(t => ({ name: t.name, icon: t.icon, favicon: t.favicon, _uuid: t._uuid })),
        };
      });

      setCollections(mapped);
    } catch (e) {
      console.error('[usePublicCollections] fetch failed:', e);
      setError('Failed to load collections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const allCategories = useMemo(() => {
    const cats = new Set<ToolCategory>();
    for (const c of collections) {
      for (const cat of c.categories) cats.add(cat);
    }
    return [...cats];
  }, [collections]);

  const featured = useMemo(() => {
    return collections.filter(c => c.featured).slice(0, 6);
  }, [collections]);

  const trending = useMemo(() => {
    const now = Date.now();
    return [...collections]
      .filter(c => !c.featured)
      .map(c => {
        const hoursSinceUpdate = (now - c.updatedAt) / 3600000;
        const trendingScore = (c.followerCount ?? 0) * 3 + (c.cloneCount ?? 0) * 2 + (1 / (hoursSinceUpdate + 2)) * 100;
        return { ...c, _trendingScore: trendingScore };
      })
      .sort((a, b) => b._trendingScore - a._trendingScore)
      .slice(0, 12);
  }, [collections]);

  const filtered = useMemo(() => {
    let result = [...collections];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.curatorName && c.curatorName.toLowerCase().includes(q)) ||
        (c.curatorUsername && c.curatorUsername.toLowerCase().includes(q))
      );
    }
    if (categoryFilter) {
      result = result.filter(c => c.categories.includes(categoryFilter));
    }
    switch (sort) {
      case 'newest':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'followers':
        result.sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0));
        break;
      case 'updated':
        result.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'clones':
        result.sort((a, b) => (b.cloneCount ?? 0) - (a.cloneCount ?? 0));
        break;
      default:
        result.sort((a, b) => {
          const tsA = (a.followerCount ?? 0) * 3 + (a.cloneCount ?? 0) * 2 + (1 / ((Date.now() - a.updatedAt) / 3600000 + 2)) * 100;
          const tsB = (b.followerCount ?? 0) * 3 + (b.cloneCount ?? 0) * 2 + (1 / ((Date.now() - b.updatedAt) / 3600000 + 2)) * 100;
          return tsB - tsA;
        });
    }
    return result;
  }, [collections, search, categoryFilter, sort]);

  return {
    collections,
    featured,
    trending,
    loading,
    error,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    sort,
    setSort,
    filtered,
    allCategories,
    refetch: fetchCollections,
  };
}
