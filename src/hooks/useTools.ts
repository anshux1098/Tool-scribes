import { useState, useEffect, useCallback, useRef } from 'react';
import { Tool, ToolCategory, NewTool } from '@/lib/types';
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

/**
 * hash -> uuid index for tools that are not in the loaded page.
 *
 * `getUuid` used to scan only `toolsRef.current`, i.e. the paginated list. Every
 * mutation early-returned on a miss, so deep-linking to any tool outside the
 * first PAGE_SIZE rows made upvote / save / notes / visit silently do nothing --
 * a quiet data-loss bug with no error and no UI feedback.
 *
 * This map is populated from every page that loads, and lazily filled from the
 * full id list on the first miss. It is module-level so it survives navigation:
 * once a deep link resolves, the mapping is warm for the rest of the session.
 *
 * On a hash collision the first id wins, which is the same rule the previous
 * linear scan used (first match in list order). The 32-bit hash space makes
 * collisions unlikely until ~10^5 tools; CODE_REVIEW.md flags this as a
 * separate concern.
 */
let uuidIndex: Map<number, string> | null = null;
let uuidIndexPromise: Promise<Map<number, string>> | null = null;

async function loadUuidIndex(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!isSupabaseConfigured) return map;
  // Only ids are needed, so this stays small regardless of tool count.
  const { data, error } = await supabase.from('tools').select('id');
  if (error || !data) {
    console.warn('[useTools] could not build tool id index', error);
    return map;
  }
  for (const row of data) {
    const uuid = (row as { id: string }).id;
    const h = hashId(uuid);
    if (!map.has(h)) map.set(h, uuid);
  }
  return map;
}

function ensureUuidIndex(): Promise<Map<number, string>> {
  if (uuidIndex) return Promise.resolve(uuidIndex);
  if (!uuidIndexPromise) {
    uuidIndexPromise = loadUuidIndex()
      .then((m) => {
        uuidIndex = m;
        return m;
      })
      .catch((e) => {
        console.error('[useTools] uuid index load failed', e);
        return new Map<number, string>();
      })
      .finally(() => {
        uuidIndexPromise = null;
      });
  }
  return uuidIndexPromise;
}

/**
 * Composite keyset cursor.
 *
 * `created_at` alone is NOT unique — `seedTools.ts` bulk-inserts a whole batch in
 * one statement, so every tool in that batch shares an identical timestamp.
 * Verified in production: 30 of 80 tools sit on just 5 duplicated timestamps,
 * one of which carries 8 tools.
 *
 * Paging with `created_at < cursor` therefore skipped everything sharing the
 * boundary timestamp: once a page ended mid-batch, up to 7 tools became
 * unreachable, permanently, with no way to page onto them.
 *
 * `id` breaks the tie. Both columns are ordered descending, matching the
 * created_at ordering, and the filter is the standard composite-keyset form.
 */
interface ToolCursor {
  createdAt: string;
  id: string;
}

function buildKeysetFilter(cursor: ToolCursor): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

// Shared module-level cache to eliminate re-fetching waterfalls when navigating back/forth
let cachedTools: (Tool & { _uuid: string })[] = [];
let cachedUserKey: string | null = null;
let cachedNextCursor: ToolCursor | null = null;
let inflightPromise: Promise<void> | null = null;

export function useTools() {
  const { user, loading: authLoading } = useAuth();
  const userKey = user ? user.id : 'anon';
  const hasFreshCache = cachedTools.length > 0 && cachedUserKey === userKey;

  const [tools, setTools] = useState<(Tool & { _uuid: string })[]>(() => hasFreshCache ? cachedTools : []);
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const [loading, setLoading] = useState(() => !hasFreshCache);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<ToolCursor | null>(() => hasFreshCache ? cachedNextCursor : null);

  const fetchAll = useCallback(async (cursor?: ToolCursor) => {
    // If not paging and cache is already populated for this user, keep UI responsive without full-page spinner
    if (!cursor && cachedTools.length > 0 && cachedUserKey === userKey) {
      setLoading(false);
    } else {
      setLoading(true);
    }
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
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor) {
        query = query.or(buildKeysetFilter(cursor));
      }

      // Parallelize base queries: tools + (vault_items & upvotes if authenticated)
      const [toolsRes, vaultRes, upvotesRes] = await Promise.all([
        query,
        user ? supabase.from('vault_items').select('*').eq('user_id', user.id) : Promise.resolve({ data: null, error: null }),
        user ? supabase.from('upvotes').select('tool_id').eq('user_id', user.id) : Promise.resolve({ data: null, error: null }),
      ]);

      if (toolsRes.error) throw toolsRes.error;
      const toolRows = toolsRes.data ?? [];

      const vaultMap = new Map<string, Record<string, unknown>>(
        ((vaultRes.data ?? []) as Array<Record<string, unknown>>).map(v => [v.tool_id as string, v])
      );
      const upvotedIds = new Set<string>(
        ((upvotesRes.data ?? []) as Array<{ tool_id: string }>).map(u => u.tool_id)
      );

      // Batch-fetch profiles for tool authors
      const addedByIds = [...new Set(toolRows.map(r => (r as Record<string, unknown>).added_by as string).filter(Boolean))];
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

      const mapped = toolRows.map(row => {
        const t = rowToTool(row as Record<string, unknown>, vaultMap.get(row.id) ?? null, upvotedIds);
        const authorId = (row as Record<string, unknown>).added_by as string | undefined;
        if (authorId && profileMap.has(authorId)) {
          const p = profileMap.get(authorId)!;
          if (p.username) t.addedByUsername = p.username;
          t.addedByDisplayName = p.displayName || p.username || undefined;
        }
        return t;
      });

      const last = toolRows[toolRows.length - 1];
      const full = mapped.length === PAGE_SIZE && !!last;
      const cursorObj: ToolCursor | null = full ? {
        createdAt: last.created_at as string,
        id: last.id as string,
      } : null;
      setNextCursor(cursorObj);

      // Keep the hash -> uuid index warm so deep links to already-seen tools never need the full id query
      for (const t of mapped) {
        if (uuidIndex) uuidIndex.set(t.id, t._uuid);
      }

      if (cursor) {
        setTools(prev => {
          const next = [...prev, ...mapped];
          cachedTools = next;
          cachedNextCursor = cursorObj;
          return next;
        });
      } else {
        cachedTools = mapped;
        cachedUserKey = userKey;
        cachedNextCursor = cursorObj;
        setTools(mapped);
      }
    } catch (e) {
      console.error('fetchAll error', e);
      setError('Failed to load tools. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user, userKey]);

  useEffect(() => {
    // Wait until auth session check finishes to prevent duplicate anonymous -> authenticated query waterfall
    if (authLoading) return;

    if (cachedTools.length > 0 && cachedUserKey === userKey) {
      setTools(cachedTools);
      setNextCursor(cachedNextCursor);
      setLoading(false);
      return;
    }

    if (!inflightPromise) {
      inflightPromise = fetchAll().finally(() => {
        inflightPromise = null;
      });
    }
  }, [authLoading, userKey, fetchAll]);

  const fetchMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchAll(nextCursor);
    }
  }, [nextCursor, loading, fetchAll]);

  const getUuid = useCallback((numId: number): string | null => {
    return toolsRef.current.find(t => t.id === numId)?._uuid ?? null;
  }, []);

  /**
   * Resolve a numeric tool id to its UUID, falling back to the full id index.
   * Always use this for mutations. `getUuid` alone only knows the loaded page.
   */
  const resolveUuid = useCallback(async (numId: number): Promise<string | null> => {
    const loaded = getUuid(numId);
    if (loaded) return loaded;
    const index = await ensureUuidIndex();
    return index.get(numId) ?? null;
  }, [getUuid]);

  /** Resolve, or warn loudly instead of returning null silently. */
  const resolveUuidOrWarn = useCallback(async (
    numId: number,
    action: string
  ): Promise<string | null> => {
    const uuid = await resolveUuid(numId);
    if (!uuid) {
      // #24: every mutation used to early-return here with no signal, so a
      // deep link to an unloaded tool looked broken but said nothing.
      console.error(`[useTools] ${action}: no tool found for id ${numId}; the action was skipped`);
    }
    return uuid;
  }, [resolveUuid]);

  const addTool = useCallback(async (tool: NewTool) => {
    if (!user) return;
    const tempId = Date.now();
    const optimistic: Tool & { _uuid: string } = {
      ...tool,
      screenshotUrl: tool.screenshotUrl ?? '',
      priceModel: tool.priceModel ?? 'free',
      isOpenSource: tool.isOpenSource ?? false,
      requiresLogin: tool.requiresLogin ?? false,
      isFree: tool.isFree ?? true,
      platforms: tool.platforms ?? ['web'],
      signupRequired: tool.signupRequired ?? false,
      id: tempId, _uuid: '', addedAt: Date.now(),
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
    const uuid = await resolveUuidOrWarn(numId, 'toggleFavorite');
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newVal = !(tool?.isFavorite ?? false);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: newVal } : t));
    const { error } = await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, is_favorite: newVal }, { onConflict: 'user_id,tool_id' });
    if (error) setTools(prev => prev.map(t => t.id === numId ? { ...t, isFavorite: !newVal } : t));
  }, [user, resolveUuidOrWarn]);

  const toggleUpvote = useCallback(async (numId: number) => {
    const uuid = await resolveUuidOrWarn(numId, 'toggleUpvote');
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const wasUpvoted = tool?.upvotedByMe ?? false;
    setTools(prev => prev.map(t =>
      t.id === numId ? { ...t, upvotedByMe: !wasUpvoted, upvotes: t.upvotes + (wasUpvoted ? -1 : 1) } : t
    ));

    // The RPC owns the whole toggle: it inserts/deletes the upvote row AND
    // derives tools.upvotes from count(*). Do not write the row from here --
    // that would double-toggle. It also means the counter cannot drift away
    // from the upvotes table the way an increment-based RPC could.
    const { data, error } = await supabase.rpc('toggle_upvote', { p_tool_id: uuid });
    if (error || !data?.[0]) {
      setTools(prev => prev.map(t =>
        t.id === numId ? { ...t, upvotedByMe: wasUpvoted, upvotes: t.upvotes + (wasUpvoted ? 1 : -1) } : t
      ));
      return;
    }

    // Reconcile against the server's count rather than trusting the
    // optimistic guess, which also repairs any pre-existing drift.
    const { upvoted, upvotes } = data[0] as { upvoted: boolean; upvotes: number };
    setTools(prev => prev.map(t => (t.id === numId ? { ...t, upvotedByMe: upvoted, upvotes } : t)));
  }, [user, resolveUuidOrWarn]);

  const saveToVault = useCallback(async (numId: number) => {
    const uuid = await resolveUuidOrWarn(numId, 'saveToVault');
    if (!uuid || !user) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, savedToVault: true } : t));
    const { error } = await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid }, { onConflict: 'user_id,tool_id' });
    if (error) setTools(prev => prev.map(t => t.id === numId ? { ...t, savedToVault: false } : t));
  }, [user, resolveUuidOrWarn]);

  const updateNotes = useCallback(async (numId: number, notes: string) => {
    const uuid = await resolveUuidOrWarn(numId, 'updateNotes');
    if (!uuid || !user) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, notes } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, notes }, { onConflict: 'user_id,tool_id' });
  }, [user, resolveUuidOrWarn]);

  const addTag = useCallback(async (numId: number, tag: string) => {
    const uuid = await resolveUuidOrWarn(numId, 'addTag');
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newTags = [...new Set([...(tool?.tags ?? []), tag])];
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, resolveUuidOrWarn]);

  const removeTag = useCallback(async (numId: number, tag: string) => {
    const uuid = await resolveUuidOrWarn(numId, 'removeTag');
    if (!uuid || !user) return;
    const tool = toolsRef.current.find(t => t.id === numId);
    const newTags = (tool?.tags ?? []).filter(tg => tg !== tag);
    setTools(prev => prev.map(t => t.id === numId ? { ...t, tags: newTags } : t));
    await supabase.from('vault_items')
      .upsert({ user_id: user.id, tool_id: uuid, tags: newTags }, { onConflict: 'user_id,tool_id' });
  }, [user, resolveUuidOrWarn]);

  const recordVisit = useCallback(async (numId: number) => {
    const uuid = await resolveUuidOrWarn(numId, 'recordVisit');
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
  }, [user, resolveUuidOrWarn]);

  const removeFromVault = useCallback(async (numId: number): Promise<{ error?: string }> => {
    if (!user) return { error: 'Not authenticated' };
    const uuid = await resolveUuidOrWarn(numId, 'removeFromVault');
    if (!uuid) return { error: 'Tool not found' };
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
  }, [user, resolveUuidOrWarn]);

  const updateScreenshot = useCallback(async (numId: number, screenshotUrl: string): Promise<void> => {
    const uuid = await resolveUuidOrWarn(numId, 'updateScreenshot');
    if (!uuid) return;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, screenshotUrl } : t));
    await supabase.from('tools').update({ screenshot_url: screenshotUrl }).eq('id', uuid);
  }, [resolveUuidOrWarn]);

  const updateAiProfile = useCallback(async (numId: number, summary: string): Promise<void> => {
    const uuid = await resolveUuidOrWarn(numId, 'updateAiProfile');
    if (!uuid) return;
    const now = new Date().toISOString();
    const tool = tools.find(t => t.id === numId);
    const currentVersion = tool?.aiProfileVersion ?? 0;
    const newVersion = currentVersion + 1;
    setTools(prev => prev.map(t => t.id === numId ? { ...t, aiSummary: summary, aiProfileGeneratedAt: now, aiProfileVersion: newVersion } : t));
    await supabase.from('tools').update({ ai_summary: summary, ai_profile_generated_at: now, ai_profile_version: newVersion }).eq('id', uuid);
    console.log('[AI PROFILE] saved profile');
  }, [resolveUuidOrWarn, tools]);

  /**
   * Fetch a single tool by numeric id when deep-linked or not present in the loaded page.
   * Resolves the UUID via `resolveUuid`, queries Supabase, builds the full Tool object
   * with vault and author metadata, and adds it to `tools` state.
   */
  const fetchSingleTool = useCallback(async (numId: number): Promise<(Tool & { _uuid: string }) | null> => {
    const loaded = toolsRef.current.find(t => t.id === numId);
    if (loaded) return loaded;
    if (!isSupabaseConfigured) return null;

    const uuid = await resolveUuid(numId);
    if (!uuid) return null;

    try {
      const { data: toolRow, error: tErr } = await supabase
        .from('tools')
        .select('*')
        .eq('id', uuid)
        .maybeSingle();

      if (tErr || !toolRow) return null;

      let vaultItem: Record<string, unknown> | null = null;
      let isUpvoted = false;

      if (user) {
        const [{ data: vData }, { data: uData }] = await Promise.all([
          supabase.from('vault_items').select('*').eq('user_id', user.id).eq('tool_id', uuid).maybeSingle(),
          supabase.from('upvotes').select('id').eq('user_id', user.id).eq('tool_id', uuid).maybeSingle(),
        ]);
        vaultItem = (vData as Record<string, unknown>) ?? null;
        isUpvoted = !!uData;
      }

      const mapped = rowToTool(
        toolRow as Record<string, unknown>,
        vaultItem,
        isUpvoted ? new Set([uuid]) : undefined
      );

      const authorId = (toolRow as Record<string, unknown>).added_by as string | undefined;
      if (authorId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('user_id', authorId)
          .maybeSingle();
        if (prof) {
          const p = prof as Record<string, unknown>;
          if (p.username) mapped.addedByUsername = p.username as string;
          mapped.addedByDisplayName = (p.display_name as string) || (p.username as string) || undefined;
        }
      }

      if (uuidIndex) uuidIndex.set(mapped.id, mapped._uuid);
      setTools(prev => prev.some(t => t.id === mapped.id) ? prev : [...prev, mapped]);
      return mapped;
    } catch (e) {
      console.error('[useTools] fetchSingleTool error:', e);
      return null;
    }
  }, [user, resolveUuid]);

  /**
   * Ensure an array of tool UUIDs is present in `tools` state.
   * Missing rows are fetched in a single `.in('id', ...)` batch with vault and author metadata.
   */
  const ensureToolsLoaded = useCallback(async (uuids: string[]): Promise<void> => {
    if (!isSupabaseConfigured || uuids.length === 0) return;
    const missingUuids = uuids.filter(u => !toolsRef.current.some(t => t._uuid === u));
    if (missingUuids.length === 0) return;

    try {
      const { data: toolRows, error } = await supabase
        .from('tools')
        .select('*')
        .in('id', missingUuids);

      if (error || !toolRows || toolRows.length === 0) return;

      const vaultMap = new Map<string, Record<string, unknown>>();
      const upvotedIds = new Set<string>();

      if (user) {
        const [{ data: vData }, { data: uData }] = await Promise.all([
          supabase.from('vault_items').select('*').eq('user_id', user.id).in('tool_id', missingUuids),
          supabase.from('upvotes').select('tool_id').eq('user_id', user.id).in('tool_id', missingUuids),
        ]);
        if (vData) {
          for (const row of vData) vaultMap.set((row as Record<string, unknown>).tool_id as string, row as Record<string, unknown>);
        }
        if (uData) {
          for (const row of uData) upvotedIds.add((row as Record<string, unknown>).tool_id as string);
        }
      }

      const authorIds = [...new Set((toolRows as Record<string, unknown>[]).map(r => r.added_by).filter(Boolean))];
      const profileMap = new Map<string, { username?: string; displayName?: string }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name')
          .in('user_id', authorIds);
        if (profiles) {
          for (const p of profiles as Record<string, unknown>[]) {
            profileMap.set(p.user_id as string, { username: p.username as string | undefined, displayName: p.display_name as string | undefined });
          }
        }
      }

      const mapped = (toolRows as Record<string, unknown>[]).map(row => {
        const t = rowToTool(row, vaultMap.get(row.id as string) ?? null, upvotedIds);
        const authorId = row.added_by as string | undefined;
        if (authorId && profileMap.has(authorId)) {
          const p = profileMap.get(authorId)!;
          if (p.username) t.addedByUsername = p.username;
          t.addedByDisplayName = p.displayName || p.username || undefined;
        }
        return t;
      });

      for (const t of mapped) {
        if (uuidIndex) uuidIndex.set(t.id, t._uuid);
      }

      setTools(prev => {
        const existingUuids = new Set(prev.map(p => p._uuid));
        const trulyNew = mapped.filter(m => !existingUuids.has(m._uuid));
        return trulyNew.length > 0 ? [...prev, ...trulyNew] : prev;
      });
    } catch (e) {
      console.error('[useTools] ensureToolsLoaded failed:', e);
    }
  }, [user]);

  return {
    tools, loading, error, refetch: fetchAll,
    addTool, toggleFavorite, toggleUpvote, saveToVault,
    updateNotes, addTag, removeTag, recordVisit,
    removeFromVault, updateScreenshot, updateAiProfile,
    fetchMore, hasMore: nextCursor !== null,
    fetchSingleTool, ensureToolsLoaded,
  };
}
