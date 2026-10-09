import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Tool } from '@/lib/types';

export interface DustTool {
  id: number;
  _uuid: string;
  name: string;
  url: string;
  favicon: string;
  category: Tool['category'];
  savedAt: number;
  visitCount: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function useDustCollector(vaultTools: (Tool & { _uuid?: string })[]) {
  const { user } = useAuth();
  const [dustTools, setDustTools] = useState<DustTool[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDust = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setDustTools([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch dismissed dust items
      const { data: dustRows } = await supabase
        .from('dust_items')
        .select('tool_id')
        .eq('user_id', user.id)
        .eq('status', 'dismissed');

      const dismissedUuids = new Set((dustRows ?? []).map(r => r.tool_id as string));

      // Find stale tools: saved > 30 days ago, visit_count = 0
      const now = Date.now();
      const stale = vaultTools.filter(t => {
        const age = now - t.addedAt;
        const neverVisited = !t.lastVisited && (t.visitCount ?? 0) === 0;
        return age > THIRTY_DAYS_MS && neverVisited && t._uuid && !dismissedUuids.has(t._uuid);
      });

      const mapped: DustTool[] = stale.map(t => ({
        id: t.id,
        _uuid: t._uuid!,
        name: t.name,
        url: t.url,
        favicon: t.favicon,
        category: t.category,
        savedAt: t.addedAt,
        visitCount: t.visitCount ?? 0,
      }));

      setDustTools(mapped);
    } catch (e) { console.error('[useDustCollector] loadDust failed:', e); } finally {
      setLoading(false);
    }
  }, [user, vaultTools]);

  useEffect(() => {
    loadDust();
  }, [loadDust]);

  const dismissTool = useCallback(async (toolId: number) => {
    const tool = vaultTools.find(t => t.id === toolId);
    if (!tool?._uuid || !user) return;
    setDustTools(prev => prev.filter(t => t.id !== toolId));
    try {
      await supabase.from('dust_items').upsert(
        { user_id: user.id, tool_id: tool._uuid, status: 'dismissed' },
        { onConflict: 'user_id,tool_id' }
      );
    } catch (e) { console.error('[useDustCollector] dismissTool failed:', e); }
  }, [user, vaultTools]);

  const removeFromVault = useCallback(async (toolId: number) => {
    const tool = vaultTools.find(t => t.id === toolId);
    if (!tool?._uuid || !user) return;
    setDustTools(prev => prev.filter(t => t.id !== toolId));
    try {
      await supabase.from('vault_items').delete().eq('user_id', user.id).eq('tool_id', tool._uuid);
    } catch (e) { console.error('[useDustCollector] removeFromVault failed:', e); }
  }, [user, vaultTools]);

  return { dustTools, loading, dismissTool, removeFromVault, refresh: loadDust };
}
