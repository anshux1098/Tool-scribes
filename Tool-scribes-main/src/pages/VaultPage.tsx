import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import VaultGridCard from '@/components/VaultGridCard';
import CollectionCard from '@/components/CollectionCard';
import CategoryFilter from '@/components/CategoryFilter';
import SkeletonToolCard from '@/components/SkeletonToolCard';
import VaultRecommendations from '@/components/VaultRecommendations';
import { Tool, ToolCategory, Collection, CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDustCollector } from '@/hooks/useDustCollector';
import { fetchAllToolHealth } from '@/lib/health';
import { toast } from 'sonner';

interface VaultPageProps {
  tools: Tool[];
  onToggleFavorite: (id: number) => void;
  onRemoveFromVault: (id: number) => Promise<{ error?: string }>;
  onSaveToVault: (id: number) => void;
  onAddTool: () => void;
  loading: boolean;
  collections: Collection[];
  collectionsLoading: boolean;
  onCreateCollection: () => void;
}

const categories: (ToolCategory | 'all')[] = ['all', 'ai', 'dev', 'design', 'prod', 'learn', 'util'];

const categoryCountsMap: Record<ToolCategory | 'all', string> = {
  all: 'All', ai: 'AI', dev: 'Dev', design: 'Design', prod: 'Prod', learn: 'Learn', util: 'Util',
};

export default function VaultPage({ tools, onToggleFavorite, onRemoveFromVault, onSaveToVault, onAddTool, loading, collections, collectionsLoading, onCreateCollection }: VaultPageProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const { user } = useAuth();

  const vaultTools = useMemo(() => tools.filter(t => t.savedToVault), [tools]);
  const { dustTools, dismissTool, removeFromVault } = useDustCollector(vaultTools);
  const [healthMap, setHealthMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchAllToolHealth().then(map => {
      const statusMap = new Map<string, string>();
      for (const [uuid, h] of map) {
        statusMap.set(uuid, h.status);
      }
      setHealthMap(statusMap);
    }).catch((e) => console.error('[VaultPage] fetchAllToolHealth failed:', e));
  }, [tools]);

  const vaultWithHealth = useMemo(() =>
    vaultTools.map(t => ({
      ...t,
      healthStatus: t._uuid ? healthMap.get(t._uuid) : undefined,
    })),
    [vaultTools, healthMap]
  );

  const filtered = useMemo(() => {
    let result = vaultWithHealth;
    if (activeCategory !== 'all') result = result.filter(t => t.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [vaultWithHealth, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of vaultWithHealth) counts[t.category] = (counts[t.category] || 0) + 1;
    return counts;
  }, [vaultWithHealth]);

  const favorites = filtered.filter(t => t.isFavorite);
  const lastAdded = vaultWithHealth.length > 0
    ? formatDistanceToNow(Math.max(...vaultWithHealth.map(t => t.addedAt)), { addSuffix: true })
    : null;

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Your Collection</p>
        <h3 className="font-syne text-[32px] text-tv-text mb-3 leading-tight">
          The <em className="not-italic text-tv-primary">stack</em> awaits.
        </h3>
        <p className="text-[14px] text-tv-text-s mb-8 max-w-sm leading-relaxed">
          Sign in to save tools, add notes, and build your personal stack.
        </p>
        <button
          onClick={onAddTool}
          className="px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
        >
          Sign in to get started
        </button>
      </div>
    );
  }

  if (!loading && vaultWithHealth.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Your Collection</p>
        <h3 className="font-syne text-[32px] text-tv-text mb-3 leading-tight">
          The <em className="not-italic text-tv-primary">stack</em> awaits.
        </h3>
        <p className="text-[14px] text-tv-text-s mb-8 max-w-sm leading-relaxed">
          Add your first tool to start building your personal library of go-to software.
        </p>
        <button
          onClick={onAddTool}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg transition-all duration-150 hover:bg-tv-primary-dark"
        >
          <Plus size={14} />
          Add your first tool
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6">
      {/* ─── Hero ─────────────────────────────────── */}
      <div className="pt-10 pb-8 border-b border-tv-border">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Your Collection</p>
        <h1 className="font-syne text-[44px] text-tv-text leading-tight">
          My <em className="not-italic text-tv-primary">library.</em>
        </h1>
        {!loading && (
          <div className="flex items-center gap-3 mt-3 text-[13px] text-tv-text-s font-mono">
            <span>{vaultTools.length} tool{vaultTools.length !== 1 ? 's' : ''}</span>
            <span className="text-tv-border">·</span>
            <span>{vaultTools.filter(t => t.isFavorite).length} favorite{vaultTools.filter(t => t.isFavorite).length !== 1 ? 's' : ''}</span>
            {lastAdded && (
              <>
                <span className="text-tv-border">·</span>
                <span>last added {lastAdded}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Collections ──────────────────────────── */}
      {user && (
        <div className="py-6 border-b border-tv-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Collections</span>
              <span className="text-[10px] font-mono text-tv-text-m">— {collections.length}</span>
            </div>
            <button
              onClick={onCreateCollection}
              className="flex items-center gap-1 text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
            >
              <Plus size={12} />
              New
            </button>
          </div>
          {collectionsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-s2 border-2 border-tv-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : collections.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {collections.map((col, i) => (
                <CollectionCard key={col.id} collection={col} index={i} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-tv-text-s font-mono">No collections yet. Create one to organize your tools.</p>
          )}
        </div>
      )}

      {/* ─── Vault Recommendations ────────────────── */}
      <VaultRecommendations />

      {/* ─── Search + Category Filter ─────────────── */}
      <div className="py-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your library..."
            className="w-full pl-10 pr-4 py-2.5 bg-s2 border border-tv-border rounded-lg text-[14px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
          />
        </div>
        <CategoryFilter categories={categories} activeCategory={activeCategory} onChange={setActiveCategory} counts={categoryCounts} />
      </div>

      {/* ─── Dust Collector ───────────────────────── */}
      {user && dustTools.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
          <p className="text-[10px] font-mono text-amber-700 uppercase tracking-widest mb-2">Stale Tools — {dustTools.length}</p>
          <p className="text-[12px] text-tv-text-s font-mono mb-3">These tools haven't been visited in a while.</p>
          <div className="flex flex-wrap gap-2">
            {dustTools.slice(0, 6).map(dt => (
              <span key={dt.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-[11px] font-mono text-amber-700">
                {dt.toolName}
                <button onClick={async () => { try { await dismissTool(dt.id); toast.success('Tool dismissed'); } catch { toast.error('Failed to dismiss tool'); } }} className="hover:opacity-60">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tool Grid ────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <SkeletonToolCard variant="row" />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="pb-16">
          {favorites.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mt-4 mb-3">
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Favorites</span>
                <span className="text-[10px] font-mono text-tv-text-m">— {favorites.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favorites.map((t, i) => (
                  <VaultGridCard key={t.id} tool={t} onToggleFavorite={onToggleFavorite} onRemoveFromVault={onRemoveFromVault} onSaveToVault={onSaveToVault} index={i} />
                ))}
              </div>
            </div>
          )}

          {filtered.filter(t => !t.isFavorite).length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mt-6 mb-3">
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">All Tools</span>
                <span className="text-[10px] font-mono text-tv-text-m">— {filtered.filter(t => !t.isFavorite).length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.filter(t => !t.isFavorite).map((t, i) => (
                  <VaultGridCard key={t.id} tool={t} onToggleFavorite={onToggleFavorite} onRemoveFromVault={onRemoveFromVault} onSaveToVault={onSaveToVault} index={favorites.length + i} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-[14px] text-tv-text-s font-mono">No tools match your filter.</p>
              <button onClick={() => { setSearch(''); setActiveCategory('all'); }} className="mt-3 text-[13px] text-tv-primary hover:underline font-mono">
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
