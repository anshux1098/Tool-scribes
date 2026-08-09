import { useState } from 'react';
import { X, Loader2, Send, Trash2 } from 'lucide-react';
import { Review } from '@/lib/types';
import { toast } from 'sonner';

interface ReviewFormProps {
  toolName: string;
  existingReview: Review | null;
  onSubmit: (data: { best_for: string; gotcha: string; free_tier: string; rating: number }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onClose?: () => void;
}

export default function ReviewForm({ toolName, existingReview, onSubmit, onDelete, onClose }: ReviewFormProps) {
  const [bestFor, setBestFor] = useState(existingReview?.bestFor ?? '');
  const [gotcha, setGotcha] = useState(existingReview?.gotcha ?? '');
  const [freeTier, setFreeTier] = useState(existingReview?.freeTier ?? '');
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating (1-5 stars).');
      return;
    }
    if (!bestFor.trim() && !gotcha.trim() && !freeTier.trim()) {
      setError('Fill in at least one field.');
      return;
    }
    setSaving(true);
    setError('');
    const ok = await onSubmit({ best_for: bestFor.trim(), gotcha: gotcha.trim(), free_tier: freeTier.trim(), rating });
    setSaving(false);
    if (ok) {
      toast.success(existingReview ? 'Review updated' : 'Review submitted');
    } else {
      toast.error('Failed to save review');
      setError('Failed to save. You may already have a review for this tool.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDelete();
    setDeleting(false);
    if (ok) {
      toast.success('Review deleted');
    } else {
      toast.error('Failed to delete review');
    }
  };

  const inputClass = "w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150 resize-none";

  return (
    <div className="bg-surface border border-tv-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-tv-border bg-s2">
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">
          {existingReview ? `Your review of ${toolName}` : `Review ${toolName}`}
        </span>
        <div className="flex items-center gap-1">
          {existingReview && (
            <button onClick={handleDelete} disabled={deleting}
              className="p-2.5 rounded hover:bg-s3 text-tv-text-s hover:text-red-500 transition-colors"
              title="Delete review">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2.5 rounded hover:bg-s3 text-tv-text-s transition-colors" aria-label="Close review form">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Rating */}
        <div>
          <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s === rating ? 0 : s)}
                className={`text-[22px] transition-colors hover:scale-110 ${s <= rating ? '' : 'opacity-20 hover:opacity-40'}`}
                style={{ color: '#2D6A4F' }}
              >
                ★
              </button>
            ))}
            <span className="text-[12px] font-mono ml-2" style={{ color: '#5a5a5a' }}>
              {rating === 0 ? 'Select' : `${rating}/${5}`}
            </span>
          </div>
        </div>

        {/* Best For */}
        <div>
          <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Best For</label>
          <textarea
            value={bestFor}
            onChange={e => setBestFor(e.target.value)}
            placeholder="e.g. Rapid prototyping with AI, writing first drafts, exploring design ideas…"
            rows={2}
            className={inputClass}
          />
        </div>

        {/* Gotcha */}
        <div>
          <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Gotcha</label>
          <textarea
            value={gotcha}
            onChange={e => setGotcha(e.target.value)}
            placeholder="e.g. Free tier is limited to 10 queries/day, no API access on free plan…"
            rows={2}
            className={inputClass}
          />
        </div>

        {/* Free Tier */}
        <div>
          <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1 block">Free Tier</label>
          <textarea
            value={freeTier}
            onChange={e => setFreeTier(e.target.value)}
            placeholder="e.g. Generous free tier with 1000 credits/month, enough for personal use…"
            rows={2}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-[12px] font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-tv-border bg-s2">
        <span className="text-[10px] font-mono text-tv-text-m">
          {existingReview ? 'Edit your review' : 'Share your experience'}
        </span>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {existingReview ? 'Update' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
