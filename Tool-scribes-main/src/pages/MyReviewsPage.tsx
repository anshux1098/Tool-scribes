import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Edit3, Trash2, Loader2, PenLine, ExternalLink, Star, XCircle } from 'lucide-react';
import { Review } from '@/lib/types';
import { supabase, isSupabaseConfigured, ReviewRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import FocusTrap from '@/components/FocusTrap';
import { hashId } from '@/lib/hashId';

interface ReviewWithTool {
  review: Review;
  toolName: string;
  toolId: number;
  toolUuid: string;
  toolIcon: string;
}

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<ReviewWithTool | null>(null);
  const [editBestFor, setEditBestFor] = useState('');
  const [editGotcha, setEditGotcha] = useState('');
  const [editFreeTier, setEditFreeTier] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReviews = async () => {
    if (!isSupabaseConfigured || !user) { setLoading(false); return; }
    try {
      const { data: reviewRows, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (!reviewRows || reviewRows.length === 0) { setReviews([]); setLoading(false); return; }

      const rows = reviewRows as unknown as ReviewRow[];
      const toolIds = [...new Set(rows.map(r => r.tool_id))];
      const { data: toolData } = await supabase
        .from('tools')
        .select('id, name, icon')
        .in('id', toolIds);

      const toolMap = new Map((toolData ?? []).map(t => [t.id as string, { name: t.name as string, icon: t.icon as string }]));
      const mapped = rows.map(r => ({
        review: {
          id: hashId(r.id),
          _uuid: r.id,
          toolId: r.tool_id,
          userId: r.user_id,
          authorDisplayName: '',
          authorUsername: null,
          bestFor: r.best_for,
          gotcha: r.gotcha,
          freeTier: r.free_tier,
          rating: r.rating || 0,
          isMine: true,
          moderationStatus: r.moderation_status,
          createdAt: new Date(r.created_at).getTime(),
          updatedAt: new Date(r.updated_at).getTime(),
        },
        toolName: toolMap.get(r.tool_id)?.name ?? 'Unknown tool',
        toolIcon: toolMap.get(r.tool_id)?.icon ?? '🔧',
        toolUuid: r.tool_id,
        toolId: toolMap.get(r.tool_id) ? hashId(r.tool_id) : 0,
      }));
      setReviews(mapped);
    } catch (e) {
      console.error('[MyReviewsPage] fetch failed:', e);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [user]);

  const openEdit = (rw: ReviewWithTool) => {
    setEditingReview(rw);
    setEditBestFor(rw.review.bestFor);
    setEditGotcha(rw.review.gotcha);
    setEditFreeTier(rw.review.freeTier);
    setEditRating(rw.review.rating);
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;
    if (editRating === 0) { toast.error('Please select a rating.'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('reviews')
      .update({
        best_for: editBestFor.trim(),
        gotcha: editGotcha.trim(),
        free_tier: editFreeTier.trim(),
        rating: editRating,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingReview.review._uuid);
    setSaving(false);
    if (error) {
      toast.error('Failed to update review');
      return;
    }
    toast.success('Review updated');
    setEditingReview(null);
    fetchReviews();
  };

  const handleDelete = async (uuid: string) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setDeletingId(uuid);
    const { error } = await supabase.from('reviews').delete().eq('id', uuid);
    setDeletingId(null);
    if (error) { toast.error('Failed to delete review'); return; }
    toast.success('Review deleted');
    fetchReviews();
  };

  const handleClickReview = (rw: ReviewWithTool) => {
    navigate(`/tool/${rw.toolId}?review=${rw.review._uuid}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[14px] text-tv-text-m font-mono">Sign in to manage your reviews.</p>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Reviews" description="All your tool reviews on Tool Scribe in one place." path="/reviews/me" />
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-tv-text tracking-tight">My Reviews</h1>
          <p className="text-[13px] text-tv-text-s font-mono mt-1">All your tool reviews in one place</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-tv-text-m" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-tv-border rounded-xl">
            <PenLine size={32} className="mx-auto text-tv-text-s mb-3" />
            <p className="text-[14px] text-tv-text-s font-mono">No reviews yet.</p>
            <p className="text-[12px] text-tv-text-m font-mono mt-1">Write reviews for tools you've used.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((rw, i) => (
              <motion.div
                key={rw.review._uuid}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-surface border border-tv-border rounded-xl overflow-hidden"
              >
                {/* Tool header */}
                <div
                  className="flex items-center justify-between px-5 py-3.5 border-b border-tv-border bg-s2 cursor-pointer hover:bg-s3 transition-colors"
                  onClick={() => handleClickReview(rw)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{rw.toolIcon || '🔧'}</span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-tv-text truncate">{rw.toolName}</p>
                      <p className="text-[10px] font-mono text-tv-text-m">
                        {formatDistanceToNow(rw.review.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      rw.review.moderationStatus === 'active'
                        ? 'text-tv-primary border-tv-primary/20 bg-tv-primary-g'
                        : rw.review.moderationStatus === 'flagged'
                        ? 'text-amber-700 border-amber-200 bg-amber-50'
                        : 'text-red-600 border-red-200 bg-red-50'
                    }`}>
                      {rw.review.moderationStatus === 'active' ? 'Live' : rw.review.moderationStatus === 'flagged' ? 'Flagged' : 'Removed'}
                    </span>
                    <ExternalLink size={13} className="text-tv-text-s ml-2" />
                  </div>
                </div>

                {/* Review content */}
                <div className="px-5 py-4 space-y-2.5">
                  {/* Star rating */}
                  {rw.review.rating > 0 && (
                    <div className="flex items-center gap-0.5 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-[14px] ${s <= rw.review.rating ? '' : 'opacity-20'}`} style={{ color: '#2D6A4F' }}>★</span>
                      ))}
                      <span className="text-[11px] font-mono ml-1" style={{ color: '#5a5a5a' }}>{rw.review.rating}/5</span>
                    </div>
                  )}
                  {rw.review.bestFor && (
                    <div>
                      <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest flex items-center gap-1">
                        <Star size={10} /> Best For
                      </p>
                      <p className="text-[13px] text-tv-text mt-0.5">{rw.review.bestFor}</p>
                    </div>
                  )}
                  {rw.review.gotcha && (
                    <div>
                      <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest flex items-center gap-1">
                        <XCircle size={10} /> Gotcha
                      </p>
                      <p className="text-[13px] text-tv-text mt-0.5">{rw.review.gotcha}</p>
                    </div>
                  )}
                  {rw.review.freeTier && (
                    <div>
                      <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Free Tier</p>
                      <p className="text-[13px] text-tv-text mt-0.5">{rw.review.freeTier}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 px-5 py-2.5 border-t border-tv-border bg-s2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(rw); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-tv-text-s hover:text-tv-text hover:bg-s3 transition-colors"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(rw.review._uuid); }}
                    disabled={deletingId === rw.review._uuid}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-tv-text-s hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deletingId === rw.review._uuid ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingReview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="edit-review-title">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0" style={{ backgroundColor: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={() => setEditingReview(null)}
          />
          <FocusTrap active={!!editingReview}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 w-full max-w-lg bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
                <span id="edit-review-title" className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">
                  Edit Review — {editingReview.toolName}
                </span>
                <button onClick={() => setEditingReview(null)} aria-label="Close" className="p-2.5 rounded hover:bg-s2 text-tv-text-s">
                  <XCircle size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {/* Rating selector */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Rating</label>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => setEditRating(s === editRating ? 0 : s)}
                        className={`text-[22px] transition-colors hover:scale-110 ${s <= editRating ? '' : 'opacity-20 hover:opacity-40'}`}
                        style={{ color: '#2D6A4F' }}>★</button>
                    ))}
                    <span className="text-[12px] font-mono ml-2" style={{ color: '#5a5a5a' }}>
                      {editRating === 0 ? 'Select' : `${editRating}/5`}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Best For</label>
                  <textarea value={editBestFor} onChange={e => setEditBestFor(e.target.value)} rows={2}
                    className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Gotcha</label>
                  <textarea value={editGotcha} onChange={e => setEditGotcha(e.target.value)} rows={2}
                    className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Free Tier</label>
                  <textarea value={editFreeTier} onChange={e => setEditFreeTier(e.target.value)} rows={2}
                    className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-tv-border bg-s2">
                <button onClick={() => setEditingReview(null)}
                  className="px-4 py-2 text-[13px] text-tv-text-s hover:text-tv-text transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </div>
    </>
  );
}
