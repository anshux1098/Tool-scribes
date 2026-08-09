import { useState, useEffect, useCallback, useRef } from 'react';
import { Tool, ToolCategory } from '@/lib/types';
import { supabase, isSupabaseConfigured, supabaseInitError } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { hashId } from '@/lib/hashId';

// ─── helpers ─────────────────────────────────────────────────────────────────

function rowToTool(
  row: Record<string, unknown>,
  vaultItem?: Record<string, unknown> | null,
  upvotedIds?: Set<string>
): Tool & { _uuid: string } {
  const id = row.id as string;
  return {
    id: hashId(id),
    _uuid: id,
    name: (row.name as string) ?? '',
    url: (row.url as string) ?? '',
    description: (row.description as string) ?? '',
    category: (row.category as ToolCategory) ?? 'util',
    icon: (row.icon as string) ?? '🔧',
    favicon: (row.favicon as string) ?? '',
    ogImage: (row.og_image as string) ?? '',
    screenshotUrl: (row.screenshot_url as string) ?? '',
    upvotes: (row.upvotes as number) ?? 0,
    priceModel: (row.price_model as string ?? 'free') as Tool['priceModel'],
    isOpenSource: (row.is_open_source as boolean) ?? false,
    requiresLogin: (row.requires_login as boolean) ?? false,
    isFree: (row.is_free as boolean) ?? true,
    platforms: (row.platforms as string[]) ?? ['web'],
    signupRequired: (row.signup_required as boolean) ?? false,
    upvotedByMe: upvotedIds ? upvotedIds.has(id) : false,
    savedToVault: !!vaultItem,
    isFavorite: (vaultItem?.is_favorite as boolean) ?? false,
    addedAt: new Date((row.created_at as string)).getTime(),
    aiSummary: (row.ai_summary as string) ?? undefined,
    aiProfileGeneratedAt: (row.ai_profile_generated_at as string) ?? undefined,
    aiProfileVersion: (row.ai_profile_version as number) ?? undefined,
    notes: (vaultItem?.notes as string) ?? '',
    tags: (vaultItem?.tags as string[]) ?? [],
    lastVisited: vaultItem?.last_visited
      ? new Date(vaultItem.last_visited as string).getTime()
      : undefined,
    visitCount: (vaultItem?.visit_count as number) ?? 0,
  };
}

// ─── hook ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function useTools() {
  const { user } = useAuth();
  const [tools, setTools] = useState<(Tool & { _uuid: string })[]>([]);
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchAll = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    if (!isSupabaseConfigured) {
      setError(supabaseInitError);
      setLoading(false);
      return;
    }
    try {
      let query = supabase
        .from('tools')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor) {
        query = query.lt('created_at', cursor);
      }
      const { data: toolRows, error: toolsErr } = await query;
      if (toolsErr) throw toolsErr;

      let vaultMap = new Map<string, Record<string, unknown>>();
      let upvotedIds = new Set<string>();

      if (user) {
        const { data: vaultRows } = await supabase
          .from('vault_items')
          .select('*')
          .eq('user_id', user.id);
        vaultMap = new Map((vaultRows ?? []).map(v => [v.tool_id as string, v as Record<string, unknown>]));

        const { data: upvoteRows } = await supabase
          .from('upvotes')
          .select('tool_id')
          .eq('user_id', user.id);
        upvotedIds = new Set((upvoteRows ?? []).map(u => u.tool_id as string));
      }

      // Batch-fetch profiles for tool authors
      const addedByIds = [...new Set((toolRows ?? []).map(r => (r as Record<string, unknown>).added_by as string).filter(Boolean))];
      let profileMap = new Map<string, { username: string | null; displayName: string }>();
      if (addedByIds.length > 0) {
        const { data: profRows } = await supabase
          .from('profiles')
          .select('user_id, username, display_name')
          .in('user_id', addedByIds);
        if (profRows) {
          profileMap = new Map(
            (profRows as Array<Record<string, unknown>>).map(p => [
              p.user_id as string,
              { username: (p.username as string) ?? null, displayName: (p.display_name as string) || '' }
            ])
          );
        }
      }

      const mapped = (toolRows ?? []).map(row => {
        const t = rowToTool(row as Record<string, unknown>, vaultMap.get(row.id) ?? null, upvotedIds);
        const authorId = (row as Record<string, unknown>).added_by as string | undefined;
        if (authorId && profileMap.has(authorId)) {
          const p = profileMap.get(authorId)!;
          t.addedByUsername = p.username;
          t.addedByDisplayName = p.displayName || p.username || undefined;
        }
        return t;
      });

      const last = toolRows?.[toolRows.length - 1];
      setNextCursor(mapped.length === PAGE_SIZE && last ? (last.created_at as string) : null);

      if (cursor) {
        setTools(prev => [...prev, ...mapped]);
      } else {
        setTools(mapped);
      }
    } catch (e) {
      console.error('fetchAll error', e);
      setError('Failed to load tools. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchAll(nextCursor);
    }
  }, [nextCursor, loading, fetchAll]);

  const getUuid = useCallback((numId: number): string | null => {
    return toolsRef.current.find(t => t.id === numId)?._uuid ?? null;
  }, []);

  const addTool = useCallback(async (
    tool: Omit<Tool, 'id' | 'addedAt' | 'upvotes' | 'upvotedByMe' | 'savedToVault' | 'isFavorite'>
  ) => {
    if (!user) return;
    const tempId = Date.now();
    const optimistic = {
      ...tool, id: tempId, _uuid: '', addedAt: Date.now(),
      upvotes: 0, upvotedByMe: false, savedToVault: true, isFavorite: false,
    };
    setTools(prev => [optimistic, ...prev]);

    try {
      const { data: toolRow, error: tErr } = await supabase
        .from('tools')
        .insert({
          name: tool.name, url: tool.url, description: tool.description,
          category: tool.category, icon: tool.icon,
          favicon: tool.favicon, og_image: tool.ogImage, screenshot_url: tool.screenshotUrl ?? '',
          price_model: tool.priceModel ?? 'free',
          is_open_source: tool.isOpenSource ?? false,
          requires_login: tool.requiresLogin ?? false,
          is_free: tool.isFree ?? true,
          platforms: tool.platforms ?? ['web'],
          signup_required: tool.signupRequired ?? false,
          added_by: user.id,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      const { error: vErr } = await supabase
        .from('vault_items')
        .insert({ user_id: user.id, tool_id: toolRow.id });
      if (vErr) throw vErr;

      setTools(prev => prev.map(t =>
        t.id === tempId
          ? rowToTool(toolRow as Record<string, unknown>, { tool_id: toolRow.id, is_favorite: false, notes: '', tags: [] })
          : t
      ));
    } catch (e) {
      console.error('addTool error', e);
      setTools(prev => prev.filter(t => t.id !== tempId));
    }
  }, [user]);

  const toggleFavorite = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newVal = !(tool?.isFavorite ?? false);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: newVal } : t));
    const { error } = await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, is_favorite: newVal }, { onConflict: 'user_id,tool_id' });
    if (error) setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: !newVal } : t));
  }, [user, getUuid]);

  const toggleUpvote = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const wasUpvoted = tool?.upvotedByMe ?? false;
    const delta = wasUpvoted ? -1 : 1;
    setTools(prev => prev.map(t =>
      t.id === numId ? { ...t, upvotedByMe: !wasUpvoted, upvotes: t.upvotes + delta } : t
    ));
    try {
      if (wasUpvoted) {
        await supabase.from('upvotes').delete().eq('user_id', user.id).eq('tool_id', uuid);
      } else {
        await supabase.from('upvotes').insert({ user_id: user.id, tool_id: uuid });
      }
      await supabase.rpc('increment_upvote', { tool_id: uuid, delta });
    } catch (e) {
      console.error('toggleUpvote error', e);
      setTools(prev => prev.map(t =>
        t.id === numId ? { ...t, upvotedByMe: wasUpvoted, upvotes: t.upvotes - delta } : t
      ));
    }
  }, [user, getUuid]);

  const saveToVault = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, savedToVault: true } : t));
    const { error } = await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid }, { onConflict: 'user_id,tool_id' });
    if (error) setTools(prev => prev.map(t => t.id === numId ? { ...t, savedToVault: false } : t));
  }, [user, getUuid]);

  const updateNotes = useCallback(async (numId: number, notes: string) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, notes } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, notes }, { onConflict: 'user_id,tool_id' });
  }, [user, getUuid]);

  const addTag = useCallback(async (numId: number, tag: string) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newTags = [...new Set([...(tool?.tags ?? []), tag])];
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, getUuid]);

  const removeTag = useCallback(async (numId: number, tag: string) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newTags = (tool?.tags ?? []).filter(tg => tg !== tag);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, getUuid]);

  const recordVisit = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const now = new Date().toISOString();
    setTools(prev => prev.map(t =>
      t.id === numId ? { ...t, lastVisited: Date.now(), visitCount: (t.visitCount ?? 0) + 1 } : t
    ));
    const tool = toolsRef.current.find(t => t.id === numId);
    const count = (tool?.visitCount ?? 0) + 1;
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, last_visited: now, visit_count: count }, { onConflict: 'user_id,tool_id' });
    // Clear from dust items if visited
    await supabase.from('dust_items').delete().eq('user_id', user.id).eq('tool_id', uuid);
  }, [user, getUuid]);

  const removeFromVault = useCallback(async (numId: number): Promise<{ error?: string }> => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return { error: 'Not authenticated' };
    const tool = toolsRef.current.find(t => t.id === numId);
    if (!tool?.savedToVault) return {};
    setTools(prev => prev.map(t =>
      t.id === numId ? { ...t, savedToVault: false, isFavorite: false, notes: '', tags: [], lastVisited: undefined, visitCount: 0 } : t
    ));
    const { error } = await supabase.from('vault_items').delete().eq('user_id', user.id).eq('tool_id', uuid);
    if (error) {
      setTools(prev => prev.map(t =>
        t.id === numId ? { ...t, savedToVault: tool.savedToVault, isFavorite: tool.isFavorite, notes: tool.notes, tags: tool.tags, lastVisited: tool.lastVisited, visitCount: tool.visitCount } : t
      ));
      return { error: error.message };
    }
    return {};
  }, [user, getUuid]);

  const updateScreenshot = useCallback(async (numId: number, screenshotUrl: string): Promise<void> => {
    const uuid = getUuid(numId);
    if (!uuid) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, screenshotUrl } : t));
    await supabase.from('tools').update({ screenshot_url: screenshotUrl }).eq('id', uuid);
  }, [getUuid]);

  const updateAiProfile = useCallback(async (numId: number, summary: string): Promise<void> => {
    const uuid = getUuid(numId);
    if (!uuid) return;
    const now = new Date().toISOString();
    const tool = tools.find(t => t.id === numId);
    const currentVersion = tool?.aiProfileVersion ?? 0;
    const newVersion = currentVersion + 1;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, aiSummary: summary, aiProfileGeneratedAt: now, aiProfileVersion: newVersion } : t));
    await supabase.from('tools').update({ ai_summary: summary, ai_profile_generated_at: now, ai_profile_version: newVersion }).eq('id', uuid);
    console.log('[AI PROFILE] saved profile');
  }, [getUuid, tools]);

  return {
    tools, loading, error, refetch: fetchAll,
    addTool, toggleFavorite, toggleUpvote, saveToVault,
    updateNotes, addTag, removeTag, recordVisit,
    removeFromVault, updateScreenshot, updateAiProfile,
    fetchMore, hasMore: nextCursor !== null,
  };
}
