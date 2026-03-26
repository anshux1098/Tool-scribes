import { useState, useMemo } from 'react';
import { Search, ArrowUp, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Tool, ToolCategory, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface DiscoverPageProps {
  tools: Tool[];
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
  onAddTool: () => void;
}

export default function DiscoverPage({ tools, onUpvote, onSave, onAddTool }: DiscoverPageProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let result = [...tools];
    if (activeCategory) result = result.filter(t => t.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tools, activeCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) counts[t.category] = (counts[t.category] || 0) + 1;
    return counts;
  }, [tools]);

  if (tools.length === 0) return <EmptyState onAdd={onAddTool} variant="discover" />;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="px-6 pt-8 pb-6 border-b border-tv-border">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Community</p>
        <h1 className="font-syne text-[40px] text-tv-text leading-tight">
          Discover <em className="not-italic text-tv-primary">tools.</em>
        </h1>
        <p className="text-[13px] text-tv-text-s mt-2 font-mono">{tools.length} tools submitted</p>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-tv-border">
        <div className="relative flex-shrink-0 flex-grow" style={{ maxWidth: '280px' }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full h-8 pl-8 pr-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 ${
              !activeCategory
                ? 'bg-tv-text text-bg border-transparent'
                : 'border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-border-l bg-surface'
            }`}
          >
            ALL
          </button>
          {(Object.entries(CATEGORY_LABELS) as [ToolCategory, string][]).map(([key]) => {
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(isActive ? null : key)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 ${
                  isActive
                    ? 'border-transparent'
                    : 'border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-border-l bg-surface'
                }`}
                style={isActive ? { color: CATEGORY_COLORS[key], background: CATEGORY_BG[key], borderColor: 'transparent' } : undefined}
              >
                {CATEGORY_SHORT[key]}
                {categoryCounts[key] ? (
                  <span className="ml-1 opacity-60">{categoryCounts[key]}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool list */}
      <div>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-tv-text-s font-mono py-12 text-center">No tools match your search.</p>
        ) : (
          filtered.map(t => (
            <DiscoverRow key={t.id} tool={t} onUpvote={onUpvote} onSave={onSave} onClick={() => navigate(`/tool/${t.id}`)} />
          ))
        )}
      </div>
    </div>
  );
}

function DiscoverRow({ tool, onUpvote, onSave, onClick }: {
  tool: Tool;
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
  onClick: () => void;
}) {
  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];

  return (
    <div
      className="tool-row flex items-center gap-4 px-4 py-3.5 border-b border-tv-border cursor-pointer group"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return;
        onClick();
      }}
    >
      {/* Upvote */}
      <button
        onClick={(e) => { e.stopPropagation(); onUpvote(tool.id); }}
        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-center min-w-[40px] transition-all duration-150 flex-shrink-0 ${
          tool.upvotedByMe
            ? 'border-tv-primary bg-tv-primary-g text-tv-primary'
            : 'border-tv-border text-tv-text-s hover:border-tv-primary hover:text-tv-primary'
        }`}
      >
        <ArrowUp size={12} />
        <span className="text-[11px] font-mono leading-none">{tool.upvotes}</span>
      </button>

      {/* Favicon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-s2 overflow-hidden">
        {tool.favicon ? (
          <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" />
        ) : (
          <span className="text-base">{tool.icon}</span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-syne text-[16px] text-tv-text leading-snug">{tool.name}</span>
        </div>
        <p className="text-[13px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">{tool.description}</p>
      </div>

      {/* Category + meta */}
      <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className="px-2 py-0.5 rounded text-[11px] font-mono font-medium"
          style={{ color: catColor, background: catBg }}
        >
          {CATEGORY_SHORT[tool.category].toUpperCase()}
        </span>
        <span className="text-[11px] font-mono text-tv-text-m">
          {formatDistanceToNow(tool.addedAt, { addSuffix: true })}
        </span>
      </div>

      {/* Save action */}
      <button
        onClick={(e) => { e.stopPropagation(); onSave(tool.id); }}
        title={tool.savedToVault ? 'In your vault' : 'Save to vault'}
        className={`p-1.5 rounded-lg border transition-all duration-150 flex-shrink-0 opacity-0 group-hover:opacity-100 ${
          tool.savedToVault
            ? 'border-tv-primary text-tv-primary bg-tv-primary-g'
            : 'border-tv-border text-tv-text-s hover:border-tv-primary hover:text-tv-primary'
        }`}
      >
        {tool.savedToVault ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
      </button>
    </div>
  );
}
