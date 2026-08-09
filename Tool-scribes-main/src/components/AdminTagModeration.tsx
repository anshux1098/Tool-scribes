import { useState, useEffect } from 'react';
import { Search, Check, X, ExternalLink, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Tag, fetchPendingTags, moderateTag } from '@/lib/tags';
import { formatDistanceToNow } from 'date-fns';

export default function AdminTagModeration() {
  const { user, isAdmin: admin } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) { setLoading(false); return; }
    fetchPendingTags().then(({ data }) => { setTags(data); setLoading(false); });
  }, [admin]);

  const handleModerate = async (tagId: string, status: string) => {
    if (!user) return;
    setActionLoading(tagId);
    const ok = await moderateTag(tagId, status, user.id);
    if (ok) setTags(prev => prev.filter(t => t.id !== tagId));
    setActionLoading(null);
  };

  const filtered = tags.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (!admin) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center py-24">
        <p className="text-[14px] text-tv-text-s font-mono">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-4">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2">Administration</p>
        <h1 className="font-syne text-[36px] text-tv-text mb-1">Tag Moderation</h1>
        <p className="text-[14px] text-tv-text-s font-mono">Review community-suggested tags before they go live.</p>
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            type="text" placeholder="Search pending tags…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-s2 border border-tv-border rounded-lg pl-9 pr-4 py-2 text-[13px] font-mono text-tv-text placeholder:text-tv-text-s focus:outline-none focus:border-tv-primary transition-colors"
          />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-tv-border border-t-tv-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Hash size={24} className="text-tv-text-m mb-3" />
            <p className="text-[14px] text-tv-text-s font-mono">{search ? 'No matching tags.' : 'No pending tags. All clear!'}</p>
          </div>
        ) : (
          <div className="border border-tv-border rounded-xl overflow-hidden">
            <AnimatePresence>
              {filtered.map((tag, i) => (
                <motion.div
                  key={tag.id} layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                  className={`flex items-center gap-3 px-4 py-3 ${i < filtered.length - 1 ? 'border-b border-tv-border' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Hash size={12} className="text-tv-text-m flex-shrink-0" />
                      <span className="font-mono text-[13px] font-medium text-tv-text">{tag.name}</span>
                    </div>
                    {tag.description && <p className="text-[12px] text-tv-text-s mt-0.5 line-clamp-1">{tag.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleModerate(tag.id, 'approved')}
                      disabled={actionLoading === tag.id}
                      className="p-1.5 rounded-lg border border-green-500/40 text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === tag.id ? <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => handleModerate(tag.id, 'rejected')}
                      disabled={actionLoading === tag.id}
                      className="p-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
