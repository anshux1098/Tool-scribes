import { useState, useEffect, useCallback } from 'react';
import { Collection } from '@/lib/types';
import { supabase, isSupabaseConfigured, CollectionRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { notifyNewCollection, notifyCollectionUpdated } from '@/lib/notifications';
import { hashId } from '@/lib/hashId';

function rowToCollection(
  row: CollectionRow,
  toolCount: number
): Collection & { _uuid: string } {
  return {
    id: hashId(row.id),
    _uuid: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    toolCount,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    coverImageUrl: row.cover_image_url || undefined,
  };
}

export function useCollections() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<(Collection & { _uuid: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!isSupabaseConfigured || !user) {
      setCollections([]);
      setLoading(false);
      return;
    }
    try {
      const { data: rows, error: err } = await supabase
        .from('collections')
        .select('*, collection_tools(count)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (err) throw err;

      const mapped = (rows ?? []).map((r: Record<string, unknown>) => {
        const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
        const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
        return rowToCollection(r as unknown as CollectionRow, countVal);
      });
      setCollections(mapped);
    } catch (e) {
      console.error('[useCollections] fetchCollections failed:', e);
      setError('Failed to load collections.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const getUuid = useCallback((numId: number): string | null => {
    return collections.find(c => c.id === numId)?._uuid ?? null;
  }, [collections]);

  const createCollection = useCallback(async (name: string, description?: string) => {
    if (!user) return;
    const tempId = Date.now();
    const optimistic: Collection & { _uuid: string } = {
      id: tempId, _uuid: '', name, description: description ?? '',
      isPublic: false, toolCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
    };
    setCollections(prev => [optimistic, ...prev]);
    try {
      const { data, error: err } = await supabase
        .from('collections')
        .insert({ user_id: user.id, name, description: description ?? '' })
        .select()
        .single();
      if (err) throw err;
      setCollections(prev => prev.map(c =>
        c.id === tempId
          ? rowToCollection(data as unknown as CollectionRow, 0)
          : c
      ));
      if (user) {
        supabase.from('profiles').select('display_name, username, avatar_url').eq('user_id', user.id).maybeSingle()
          .then(({ data: me }) => {
            notifyNewCollection(
              user.id,
              (me as Record<string, unknown> | null)?.display_name as string || user.email || 'Someone',
              (me as Record<string, unknown> | null)?.username as string ?? '',
              (me as Record<string, unknown> | null)?.avatar_url as string ?? '',
              name,
              (data as Record<string, unknown>).id as string,
            );
          });
      }
    } catch (e) {
      console.error('createCollection error', e);
      setCollections(prev => prev.filter(c => c.id !== tempId));
    }
  }, [user]);

  const renameCollection = useCallback(async (numId: number, name: string) => {
    const uuid = getUuid(numId);
    if (!uuid) return;
    setCollections(prev => prev.map(c => c.id === numId ? { ...c, name } : c));
    const { error: err } = await supabase
      .from('collections')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', uuid);
    if (err) setCollections(prev => prev.map(c => c.id === numId ? { ...c, name: c.name } : c));
  }, [getUuid]);

  const deleteCollection = useCallback(async (numId: number): Promise<boolean> => {
    const uuid = getUuid(numId);
    if (!uuid) return false;
    const prev = collections;
    setCollections(prev => prev.filter(c => c.id !== numId));
    try {
      await supabase
        .from('profiles')
        .update({ featured_collection_id: null })
        .eq('featured_collection_id', uuid);
      const { error: err } = await supabase
        .from('collections')
        .delete()
        .eq('id', uuid);
      if (err) throw err;
      return true;
    } catch (e) {
      console.error('deleteCollection error', e);
      setCollections(prev);
      return false;
    }
  }, [getUuid, collections]);

  const addToolToCollection = useCallback(async (collectionNumId: number, toolUuid: string) => {
    const colUuid = getUuid(collectionNumId);
    if (!colUuid) return;
    setCollections(prev => prev.map(c =>
      c.id === collectionNumId ? { ...c, toolCount: c.toolCount + 1 } : c
    ));
    const { error: err } = await supabase
      .from('collection_tools')
      .insert({ collection_id: colUuid, tool_id: toolUuid });
    if (err) setCollections(prev => prev.map(c =>
      c.id === collectionNumId ? { ...c, toolCount: c.toolCount - 1 } : c
    ));
    else {
      const col = collections.find(c => c.id === collectionNumId);
      if (col && user) notifyCollectionUpdated(colUuid, col.name, user.id, user.email || 'Someone');
    }
  }, [getUuid]);

  const removeToolFromCollection = useCallback(async (collectionNumId: number, toolUuid: string) => {
    const colUuid = getUuid(collectionNumId);
    if (!colUuid) return;
    setCollections(prev => prev.map(c =>
      c.id === collectionNumId ? { ...c, toolCount: Math.max(0, c.toolCount - 1) } : c
    ));
    const { error: err } = await supabase
      .from('collection_tools')
      .delete()
      .eq('collection_id', colUuid)
      .eq('tool_id', toolUuid);
    if (err) setCollections(prev => prev.map(c =>
      c.id === collectionNumId ? { ...c, toolCount: c.toolCount + 1 } : c
    ));
    else {
      const col = collections.find(c => c.id === collectionNumId);
      if (col && user) notifyCollectionUpdated(colUuid, col.name, user.id, user.email || 'Someone');
    }
  }, [getUuid]);

  const togglePublic = useCallback(async (numId: number) => {
    const uuid = getUuid(numId);
    if (!uuid) return;
    const col = collections.find(c => c.id === numId);
    const newVal = !(col?.isPublic ?? false);
    setCollections(prev => prev.map(c => c.id === numId ? { ...c, isPublic: newVal } : c));
    const { error: err } = await supabase
      .from('collections')
      .update({ is_public: newVal, updated_at: new Date().toISOString() })
      .eq('id', uuid);
    if (err) setCollections(prev => prev.map(c => c.id === numId ? { ...c, isPublic: !newVal } : c));
  }, [getUuid, collections]);

  /**
   * Clone a public collection into the caller's account.
   *
   * Previously this reimplemented the RPC client-side as 4 sequential
   * round-trips (read collection, read collection_tools, insert collection,
   * insert tools). That was not a transaction, so a failure partway left an
   * empty orphaned collection with no rollback -- the catch only logged. It
   * also never incremented `clone_count`, which is the only thing that writes
   * that column, making `usePublicCollections`' 'clones' sort a permanent
   * no-op.
   *
   * Now delegates to clone_public_collection(), which derives the owner from
   * the session (migration 20261010045241), increments clone_count, and does
   * the whole thing in one server-side transaction.
   */
  const cloneCollection = useCallback(async (collectionUuid: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc('clone_public_collection', {
      p_source_collection_id: collectionUuid,
    });
    if (error || !data) {
      console.error('cloneCollection error', error);
      return false;
    }
    // Refresh from the source of truth rather than hand-building a row: the RPC
    // sets fields (is_public = false, cover_image_url) the old insert omitted.
    await fetchCollections();
    return true;
  }, [user, fetchCollections]);

  const getCollectionsForTool = useCallback(async (toolUuid: string): Promise<number[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('collection_tools')
      .select('collection_id')
      .eq('tool_id', toolUuid);
    if (!data) return [];
    const colUuids = new Set(data.map(d => d.collection_id as string));
    return collections.filter(c => colUuids.has(c._uuid)).map(c => c.id);
  }, [user, collections]);

  const followCollection = useCallback(async (collectionUuid: string): Promise<boolean> => {
    if (!user) return false;
    const { error: err } = await supabase
      .from('collection_followers')
      .insert({ user_id: user.id, collection_id: collectionUuid });
    if (err) { console.error('followCollection error', err); return false; }
    return true;
  }, [user]);

  const unfollowCollection = useCallback(async (collectionUuid: string): Promise<boolean> => {
    if (!user) return false;
    const { error: err } = await supabase
      .from('collection_followers')
      .delete()
      .eq('user_id', user.id)
      .eq('collection_id', collectionUuid);
    if (err) { console.error('unfollowCollection error', err); return false; }
    return true;
  }, [user]);

  const getIsFollowing = useCallback(async (collectionUuid: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error: err } = await supabase
      .from('collection_followers')
      .select('id')
      .eq('user_id', user.id)
      .eq('collection_id', collectionUuid)
      .maybeSingle();
    if (err) { console.error('getIsFollowing error', err); return false; }
    return !!data;
  }, [user]);

  return {
    collections, loading, error, refetch: fetchCollections,
    createCollection, renameCollection, deleteCollection,
    addToolToCollection, removeToolFromCollection, getCollectionsForTool,
    togglePublic, cloneCollection,
    followCollection, unfollowCollection, getIsFollowing,
  };
}
