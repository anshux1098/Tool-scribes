import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, EyeOff, Trash2, CheckCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured, ReviewRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const PAGE_SIZE = 50;

interface ReviewWithMeta {
  review: ReviewRow;
  authorName: string;
  toolName: string;
}

export default function AdminReviewModeration() {
  const { user, isAdmin } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => { if (!isAdmin) { setLoading(false); } }, [isAdmin]);

  const loadReviews = async (cursor?: string) => {
    if (!isSupabaseConfigured || !user || !isAdmin) return;
    setLoading(true);
    try {
      let query = supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (cursor) {
        query = query.lt('created_at', cursor);
      }
      const { data: rows } = await query;

      if (!rows || rows.length === 0) { if (!cursor) setReviews([]); setNextCursor(null); setLoading(false); return; }

      const reviewerIds = [...new Set((rows as ReviewRow[]).map(r => r.user_id))];
      const toolIds = [...new Set((rows as ReviewRow[]).map(r => r.tool_id))];

      const [profilesRes, toolsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username, display_name').in('user_id', reviewerIds),
        supabase.from('tools').select('id, name').in('id', toolIds),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of (profilesRes.data ?? []) as Array<{ user_id: string; username: string | null; display_name: string }>) {
        profileMap.set(p.user_id, p.display_name || p.username || 'Anonymous');
      }

      const toolNameMap = new Map<string, string>();
      for (const t of (toolsRes.data ?? []) as Array<{ id: string; name: string }>) {
        toolNameMap.set(t.id, t.name);
      }

      const mapped = (rows as ReviewRow[]).map(r => ({
        review: r,
        authorName: profileMap.get(r.user_id) || 'Anonymous',
        toolName: toolNameMap.get(r.tool_id) || r.tool_id.slice(0, 8),
      }));

      const last = rows[rows.length - 1];
      setNextCursor(mapped.length === PAGE_SIZE && last ? (last.created_at as string) : null);

      if (cursor) {
        setReviews(prev => [...prev, ...mapped]);
      } else {
        setReviews(mapped);
      }
    } catch (e) { console.error('[AdminReviewModeration] loadReviews failed:', e); } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (nextCursor && !loading) {
      loadReviews(nextCursor);
    }
  };

  useEffect(() => { loadReviews(); }, [user]);

  const moderate = async (reviewId: string, status: string) => {
    await supabase
      .from('reviews')
      .update({ moderation_status: status, moderated_at: new Date().toISOString(), moderated_by: user?.id })
      .eq('id', reviewId);
    setNextCursor(null);
    await loadReviews();
  };

  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.review.moderation_status === filter);

  const flagged = reviews.filter(r => r.review.is_flagged);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center py-24">
        <p className="text-[14px] text-tv-text-s font-mono">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-[24px] text-tv-text leading-tight">Review Moderation</h1>
          <p className="text-[12px] font-mono text-tv-text-m mt-1">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} total
            {flagged.length > 0 && (
              <span className="text-amber-600"> &middot; {flagged.length} flagged</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setNextCursor(null); loadReviews(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6">
        {['all', 'active', 'flagged', 'hidden', 'removed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
              filter === f ? 'bg-tv-text text-bg' : 'text-tv-text-s hover:text-tv-text hover:bg-s2'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && reviews.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={18} className="animate-spin text-tv-text-m" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <CheckCircle size={24} className="text-green-500 mb-3" />
          <p className="text-[14px] text-tv-text-s font-mono">No reviews match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <div className="min-w-[600px] space-y-2">
          <div className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_auto] gap-3 px-3 py-1.5 text-[10px] font-mono text-tv-text-m uppercase tracking-widest border-b border-tv-border">
            <span>Author</span>
            <span>Tool</span>
            <span>Snippet</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((item, i) => (
            <motion.div
              key={item.review.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
              className="grid grid-cols-[1.5fr_1.5fr_2fr_1fr_auto] gap-3 items-start px-3 py-2 rounded-lg hover:bg-s2 transition-colors group"
            >
              <span className="text-[12px] font-mono text-tv-text truncate">{item.authorName}</span>
              <span className="text-[12px] font-mono text-tv-text truncate">{item.toolName}</span>
              <span className="text-[11px] font-mono text-tv-text-s truncate">
                {item.review.best_for || item.review.gotcha || item.review.free_tier || '—'}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                item.review.moderation_status === 'active' ? 'bg-green-100 text-green-700' :
                item.review.moderation_status === 'hidden' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {item.review.is_flagged ? 'FLAGGED' : item.review.moderation_status.toUpperCase()}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.review.moderation_status !== 'active' && (
                  <button onClick={() => moderate(item.review.id, 'active')}
                    className="p-1 rounded hover:bg-green-100 text-tv-text-s hover:text-green-600 transition-colors" title="Approve">
                    <CheckCircle size={13} />
                  </button>
                )}
                {item.review.moderation_status !== 'hidden' && (
                  <button onClick={() => moderate(item.review.id, 'hidden')}
                    className="p-1 rounded hover:bg-amber-100 text-tv-text-s hover:text-amber-600 transition-colors" title="Hide">
                    <EyeOff size={13} />
                  </button>
                )}
                {item.review.moderation_status !== 'removed' && (
                  <button onClick={() => moderate(item.review.id, 'removed')}
                    className="p-1 rounded hover:bg-red-100 text-tv-text-s hover:text-red-600 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 border border-tv-border rounded-lg text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors disabled:opacity-40"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
