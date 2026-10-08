import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hash, ArrowLeft, Search } from 'lucide-react';
import { useTags } from '@/lib/tags';
import TagSuggestModal from '@/components/TagSuggestModal';
import { useAuth } from '@/hooks/useAuth';
import { SEO } from '@/components/SEO';

export default function TagsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tags, loading } = useTags();
  const [search, setSearch] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);

  const filtered = tags.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => b.toolCount - a.toolCount);

  return (
    <div className="min-h-screen bg-bg">
      <SEO title="Tags" description="Browse tools by tags and categories. Find the best developer tools organized by topic." path="/tags" />
      <div className="max-w-3xl mx-auto px-6 py-4 border-b border-tv-border flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            type="text" placeholder="Filter tags…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-s2 border border-tv-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] font-mono text-tv-text placeholder:text-tv-text-s focus:outline-none focus:border-tv-primary transition-colors"
          />
        </div>
        {user && (
          <button
            onClick={() => setSuggestOpen(true)}
            className="ml-auto px-3 py-1.5 rounded-lg border border-tv-border text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-primary transition-all"
          >
            + Suggest
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-10 pb-4">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Community</p>
        <h1 className="font-syne text-[36px] text-tv-text leading-tight">
          All <span className="text-tv-primary">Tags</span>
        </h1>
        <p className="text-[13px] text-tv-text-s mt-1 font-mono">{tags.length} tags · {tags.reduce((s, t) => s + t.toolCount, 0)} total tools</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-tv-border border-t-tv-primary rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Hash size={24} className="text-tv-text-m mb-3" />
            <p className="text-[14px] text-tv-text-s font-mono">{search ? 'No matching tags.' : 'No approved tags yet.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sorted.map((tag, i) => {
              const bg = hexToRgba(tag.color, 0.08);
              return (
                <motion.button
                  key={tag.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  onClick={() => navigate(`/tag/${tag.slug}`)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-tv-border hover:border-tv-primary/40 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Hash size={13} style={{ color: tag.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-mono font-medium text-tv-text truncate" style={{ color: tag.color }}>#{tag.name}</p>
                    <p className="text-[11px] font-mono text-tv-text-s">{tag.toolCount} tool{tag.toolCount !== 1 ? 's' : ''}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <TagSuggestModal isOpen={suggestOpen} onClose={() => setSuggestOpen(false)} />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(107,114,128,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}
