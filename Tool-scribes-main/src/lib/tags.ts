import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  status: string;
  toolCount: number;
  subscriberCount: number;
  subscribed?: boolean;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('status', 'approved')
        .order('tool_count', { ascending: false });
      setTags((data ?? []).map(r => ({
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string,
        description: (r.description as string) ?? '',
        color: (r.color as string) ?? '#6B7280',
        status: r.status as string,
        toolCount: (r.tool_count as number) ?? 0,
        subscriberCount: (r.subscriber_count as number) ?? 0,
      })));
    } catch (e) { console.error('[useTags] fetchTags failed:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  return { tags, loading, refetch: fetchTags };
}

export function useTag(slug?: string) {
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTag = useCallback(async () => {
    if (!isSupabaseConfigured || !slug) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) { setTag(null); setLoading(false); return; }
      const t: Tag = {
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        description: (data.description as string) ?? '',
        color: (data.color as string) ?? '#6B7280',
        status: data.status as string,
        toolCount: (data.tool_count as number) ?? 0,
        subscriberCount: (data.subscriber_count as number) ?? 0,
      };
      if (user) {
        const { data: sub } = await supabase
          .from('tag_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('tag_id', data.id)
          .maybeSingle();
        t.subscribed = !!sub;
      }
      setTag(t);
    } catch (e) { console.error('[useTag] fetchTag failed:', e); setTag(null); } finally { setLoading(false); }
  }, [slug, user]);

  useEffect(() => { fetchTag(); }, [fetchTag]);

  const toggleSubscribe = useCallback(async () => {
    if (!user || !tag) return false;
    if (tag.subscribed) {
      const { error } = await supabase
        .from('tag_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('tag_id', tag.id);
      if (error) return false;
      setTag(prev => prev ? { ...prev, subscribed: false, subscriberCount: Math.max(0, prev.subscriberCount - 1) } : null);
    } else {
      const { error } = await supabase
        .from('tag_subscriptions')
        .insert({ user_id: user.id, tag_id: tag.id });
      if (error) return false;
      setTag(prev => prev ? { ...prev, subscribed: true, subscriberCount: prev.subscriberCount + 1 } : null);
    }
    return true;
  }, [user, tag]);

  return { tag, loading, refetch: fetchTag, toggleSubscribe };
}

export function useTagSubscriptions() {
  const { user } = useAuth();
  const [subscribedTags, setSubscribedTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubs = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setSubscribedTags([]); setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('tag_subscriptions')
        .select('tag_id')
        .eq('user_id', user.id);
      if (!data || data.length === 0) { setSubscribedTags([]); setLoading(false); return; }
      const tagIds = data.map(r => r.tag_id as string);
      const { data: tagRows } = await supabase
        .from('tags')
        .select('*')
        .in('id', tagIds)
        .eq('status', 'approved');
      setSubscribedTags((tagRows ?? []).map(r => ({
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string,
        description: (r.description as string) ?? '',
        color: (r.color as string) ?? '#6B7280',
        status: r.status as string,
        toolCount: (r.tool_count as number) ?? 0,
        subscriberCount: (r.subscriber_count as number) ?? 0,
        subscribed: true,
      })));
    } catch (e) { console.error('[useTagSubscriptions] fetchSubs failed:', e); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  return { subscribedTags, loading, refetch: fetchSubs };
}

export async function fetchTaggedTools(tagId: string): Promise<string[]> {
  const { data } = await supabase
    .from('tool_tags')
    .select('tool_id')
    .eq('tag_id', tagId);
  return (data ?? []).map(r => r.tool_id as string);
}

export async function suggestTag(name: string, description: string, userId: string): Promise<boolean> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { error } = await supabase.from('tags').insert({
    name, slug, description, submitted_by: userId, status: 'pending',
  });
  return !error;
}

export async function moderateTag(tagId: string, status: string, moderatorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tags')
    .update({ status, moderated_by: moderatorId, moderated_at: new Date().toISOString() })
    .eq('id', tagId);
  return !error;
}

const PAGE_SIZE = 50;

export async function fetchPendingTags(cursor?: string): Promise<{ data: Tag[]; nextCursor: string | null }> {
  let query = supabase
    .from('tags')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  const { data } = await query;
  const mapped = (data ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: (r.description as string) ?? '',
    color: (r.color as string) ?? '#6B7280',
    status: r.status as string,
    toolCount: (r.tool_count as number) ?? 0,
    subscriberCount: (r.subscriber_count as number) ?? 0,
  }));
  const last = data?.[data.length - 1];
  const nextCursor = mapped.length === PAGE_SIZE && last ? (last.created_at as string) : null;
  return { data: mapped, nextCursor };
}
