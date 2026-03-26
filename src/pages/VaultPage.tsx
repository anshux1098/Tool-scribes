import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import VaultCard from '@/components/VaultCard';
import EmptyState from '@/components/EmptyState';
import { Tool, ToolCategory, CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface VaultPageProps {
  tools: Tool[];
  onToggleFavorite: (id: number) => void;
  onAddTool: () => void;
}

const categories: (ToolCategory | 'all')[] = ['all', 'ai', 'dev', 'design', 'prod', 'learn', 'util'];

export default function VaultPage({ tools, onToggleFavorite, onAddTool }: VaultPageProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const { user } = useAuth();

  const vaultTools = useMemo(() => tools.filter(t => t.savedToVault), [tools]);

  const filtered = useMemo(() => {
    let result = vaultTools;
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
  }, [vaultTools, activeCategory, search]);

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

  const favorites = filtered.filter(t => t.isFavorite);
  const nonFavorites = filtered.filter(t => !t.isFavorite);
  const lastAdded = vaultTools.length > 0
    ? formatDistanceToNow(Math.max(...vaultTools.map(t => t.addedAt)), { addSuffix: true })
    : null;

  if (vaultTools.length === 0) return <EmptyState onAdd={onAddTool} variant="vault" />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="px-6 pt-8 pb-6 border-b border-tv-border">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Your Collection</p>
        <h1 className="font-syne text-[40px] text-tv-text leading-tight">
          The <em className="not-italic text-tv-primary">stack.</em>
        </h1>
        <div className="flex items-center gap-3 mt-3 text-[13px] text-tv-text-s font-mono">
          <span>{vaultTools.length} tools</span>
          <span className="text-tv-border">·</span>
          <span>{vaultTools.filter(t => t.isFavorite).length} favorites</span>
          {lastAdded && (
            <>
              <span className="text-tv-border">·</span>
              <span>last added {lastAdded}</span>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-tv-border">
        <div className="relative flex-shrink-0 flex-grow" style={{ maxWidth: '280px' }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="w-full h-8 pl-8 pr-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => {
            const isActive = activeCategory === cat;
            const color = cat !== 'all' ? CATEGORY_COLORS[cat] : undefined;
            const bg = cat !== 'all' ? CATEGORY_BG[cat] : undefined;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 ${isActive
                    ? 'border-transparent'
                    : 'border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-border-l bg-surface'
                  }`}
                style={isActive ? {
                  color: cat === 'all' ? '#fff' : color,
                  background: cat === 'all' ? '#1C1917' : bg,
                  borderColor: 'transparent',
                } : undefined}
              >
                {cat === 'all' ? 'ALL' : CATEGORY_SHORT[cat]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {favorites.length > 0 && (
          <div>
            <div className="px-6 py-2 flex items-center gap-2">
              <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Favorites</span>
              <span className="text-[10px] font-mono text-tv-text-m">— {favorites.length}</span>
            </div>
            {favorites.map(t => <VaultCard key={t.id} tool={t} onToggleFavorite={onToggleFavorite} />)}
          </div>
        )}

        {favorites.length > 0 && nonFavorites.length > 0 && (
          <div className="px-6 py-2 flex items-center gap-2">
            <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">All Tools</span>
            <span className="text-[10px] font-mono text-tv-text-m">— {nonFavorites.length}</span>
          </div>
        )}

        {nonFavorites.map(t => <VaultCard key={t.id} tool={t} onToggleFavorite={onToggleFavorite} />)}

        {filtered.length === 0 && (
          <p className="text-[13px] text-tv-text-s font-mono py-12 text-center">No tools match your filter.</p>
        )}
      </div>
    </div>
  );
}