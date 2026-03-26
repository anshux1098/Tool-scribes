import { useState, useEffect, useCallback } from 'react';
import { Tool, ToolCategory } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
    upvotes: (row.upvotes as number) ?? 0,
    upvotedByMe: upvotedIds ? upvotedIds.has(id) : false,
    savedToVault: !!vaultItem,
    isFavorite: (vaultItem?.is_favorite as boolean) ?? false,
    addedAt: new Date((row.created_at as string)).getTime(),
    notes: (vaultItem?.notes as string) ?? '',
    tags: (vaultItem?.tags as string[]) ?? [],
    lastVisited: vaultItem?.last_visited
      ? new Date(vaultItem.last_visited as string).getTime()
      : undefined,
  };
}

function hashId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useTools() {
  const { user } = useAuth();
  const [tools, setTools] = useState<(Tool & { _uuid: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: toolRows, error: toolsErr } = await supabase
        .from('tools')
        .select('*')
        .order('created_at', { ascending: false });
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

      const mapped = (toolRows ?? []).map(row =>
        rowToTool(row as Record<string, unknown>, vaultMap.get(row.id) ?? null, upvotedIds)
      );
      setTools(mapped);
    } catch (e) {
      console.error('fetchAll error', e);
      setError('Failed to load tools. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getUuid = useCallback((numId: number): string | null => {
    return tools.find(t => t.id === numId)?._uuid ?? null;
  }, [tools]);

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
          favicon: tool.favicon, og_image: tool.ogImage,
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
    const tool = tools.find(t => t.id === numId);
    const newVal = !(tool?.isFavorite ?? false);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: newVal } : t));
    const { error } = await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, is_favorite: newVal }, { onConflict: 'user_id,tool_id' });
    if (error) setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: !newVal } : t));
  }, [user, tools, getUuid]);

  const toggleUpvote = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = tools.find(t => t.id === numId);
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
  }, [user, tools, getUuid]);

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
    const tool = tools.find(t => t.id === numId);
    const newTags = [...new Set([...(tool?.tags ?? []), tag])];
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, tools, getUuid]);

  const removeTag = useCallback(async (numId: number, tag: string) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const tool = tools.find(t => t.id === numId);
    const newTags = (tool?.tags ?? []).filter(tg => tg !== tag);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, tools, getUuid]);

  const recordVisit = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid || !user) return;
    const now = new Date().toISOString();
    setTools(prev => prev.map(t => t.id === numId ? { ...t, lastVisited: Date.now() } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, last_visited: now }, { onConflict: 'user_id,tool_id' });
  }, [user, getUuid]);

  return {
    tools, loading, error, refetch: fetchAll,
    addTool, toggleFavorite, toggleUpvote, saveToVault,
    updateNotes, addTag, removeTag, recordVisit,
  };
}
