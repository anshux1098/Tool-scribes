import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Archive, Hash, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchGroupedResults, SearchResultItem } from '@/lib/search';
import { ToolCategory, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';

interface SearchEverywhereProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchGroupedResults;
  loading: boolean;
  hasQuery: boolean;
  category: ToolCategory | null | undefined;
  onCategoryChange: (cat: ToolCategory | null) => void;
}

const categories: (ToolCategory | 'all')[] = ['all', 'ai', 'dev', 'design', 'prod', 'learn', 'util'];

export default function SearchEverywhere({
  open, onClose, query, onQueryChange, results, loading, hasQuery, category, onCategoryChange,
}: SearchEverywhereProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    if (item.scope === 'collections') {
      navigate(`/collections/${item.id}`);
    } else {
      navigate(`/tool/${item.id}`);
    }
  };

  const ScopeIcon = ({ scope }: { scope: string }) => {
    if (scope === 'vault') return <Archive size={12} />;
    if (scope === 'community') return <Hash size={12} />;
    return <Bookmark size={12} />;
  };

  const ScopeLabel = ({ scope }: { scope: string }) => {
    if (scope === 'vault') return 'Your Vault';
    if (scope === 'community') return 'Community';
    return 'Collection';
  };

  const renderGroup = (title: string, items: SearchResultItem[], icon: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 px-4 py-2">
          {icon}
          <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">{title}</span>
          <span className="text-[10px] font-mono text-tv-text-m">— {items.length}</span>
        </div>
        {items.map((item) => {
          const catColor = item.category ? CATEGORY_COLORS[item.category] : undefined;
          const catBg = item.category ? CATEGORY_BG[item.category] : undefined;
          return (
            <button
              key={`${item.scope}-${item.id}`}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-s2 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.favicon ? (
                  <img src={item.favicon} className="w-5 h-5 object-contain" alt="" />
                ) : (
                  <span className="text-sm">{item.icon || '🔧'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-tv-text font-medium truncate">{item.name}</span>
                  {item.category && (
                    <span className="px-1 py-0.5 rounded text-[9px] font-mono font-medium flex-shrink-0"
                      style={{ color: catColor, background: catBg }}>
                      {CATEGORY_SHORT[item.category]}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] font-mono text-tv-text-m flex-shrink-0 ml-auto">
                    <ScopeIcon scope={item.scope} />
                    <ScopeLabel scope={item.scope} />
                  </span>
                </div>
                {item.description && (
                  <p className="text-[11px] text-tv-text-s mt-0.5 line-clamp-1">{item.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]"
        >
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-xl bg-surface border-2 border-tv-border rounded-xl shadow-brutal overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-tv-border">
              <Search size={15} className="text-tv-text-m flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Search tools and collections..."
                aria-label="Search tools and collections"
                className="flex-1 bg-transparent text-[14px] text-tv-text placeholder:text-tv-text-m focus:outline-none"
              />
              {query && (
                <button onClick={() => onQueryChange('')} aria-label="Clear search" className="p-2 rounded hover:bg-s2 text-tv-text-s transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-tv-border overflow-x-auto">
              {categories.map(cat => {
                const isActive = cat === 'all' ? !category : category === cat;
                const color = cat !== 'all' ? CATEGORY_COLORS[cat] : undefined;
                const bg = cat !== 'all' ? CATEGORY_BG[cat] : undefined;
                return (
                  <button
                    key={cat}
                    onClick={() => onCategoryChange(cat === 'all' ? null : cat)}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 flex-shrink-0 ${
                      isActive
                        ? 'border-transparent'
                        : 'border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-border-l'
                    }`}
                    style={isActive ? {
                      color: cat === 'all' ? '#fff' : color,
                      background: cat === 'all' ? '#1C1917' : bg,
                      borderColor: 'transparent',
                    } : undefined}
                  >
                    {cat === 'all' ? 'All' : CATEGORY_SHORT[cat]}
                  </button>
                );
              })}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-tv-text-s font-mono">Searching...</p>
                </div>
              ) : hasQuery && results.total === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-tv-text-s font-mono">No results found.</p>
                  <p className="text-[11px] text-tv-text-m font-mono mt-1">Try a different search term.</p>
                </div>
              ) : !hasQuery ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-tv-text-s font-mono">Start typing to search across your vault, community tools, and collections.</p>
                </div>
              ) : (
                <>
                  {renderGroup('Your Vault', results.vault, <Archive size={12} className="text-tv-text-m" />)}
                  {renderGroup('Community Tools', results.community, <Hash size={12} className="text-tv-text-m" />)}
                  {renderGroup('Collections', results.collections, <Bookmark size={12} className="text-tv-text-m" />)}
                </>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-tv-border bg-s2 flex items-center gap-4 text-[10px] font-mono text-tv-text-m">
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-tv-border text-[9px]">esc</kbd> Close</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-tv-border text-[9px]">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-tv-border text-[9px]">↵</kbd> Open</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
