import { useNavigate } from 'react-router-dom';
import { Review } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface ReviewCardProps {
  review: Review;
}

const TOOL_COLORS = ['#0284C7', '#7C3AED', '#059669', '#DC2626', '#2563EB', '#D97706', '#9333EA', '#0891B2'];

function toolColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TOOL_COLORS[Math.abs(h) % TOOL_COLORS.length];
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const navigate = useNavigate();
  const [toolInfo, setToolInfo] = useState<{ name: string; icon: string; favicon: string } | null>(null);
  const hasContent = review.bestFor || review.gotcha || review.freeTier;

  useEffect(() => {
    if (!isSupabaseConfigured || !review.toolId) return;
    let cancelled = false;
    void Promise.resolve(
      supabase.from('tools').select('name, icon, favicon').eq('id', review.toolId).maybeSingle()
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[ReviewCard] fetch tool info failed:', error); return; }
        if (data) setToolInfo(data as { name: string; icon: string; favicon: string });
      })
      .catch((e) => console.error('[ReviewCard] fetch tool info failed:', e));
    return () => { cancelled = true; };
  }, [review.toolId]);

  if (!hasContent) return null;

  const icon = toolInfo?.icon || '🔧';
  const name = toolInfo?.name || 'Tool';
  const color = toolColor(name);

  return (
    <div className="bg-surface border border-tv-border rounded-lg px-4 py-3 space-y-2.5">
      {/* Author + Tool */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-tv-primary-g flex items-center justify-center text-[11px] font-mono font-medium text-tv-primary">
          {(review.authorDisplayName || 'A')[0].toUpperCase()}
        </div>
        <div className="flex items-baseline gap-2 min-w-0">
          <button
            onClick={() => review.authorUsername && navigate(`/u/${review.authorUsername}`)}
            className="text-[12px] font-mono text-tv-text hover:text-tv-primary transition-colors truncate font-medium"
          >
            {review.authorDisplayName}
          </button>
          <span className="text-[10px] font-mono text-tv-text-m whitespace-nowrap">
            {formatDistanceToNow(review.createdAt, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Star rating */}
      {review.rating > 0 && (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} className={`text-[13px] ${s <= review.rating ? '' : 'opacity-20'}`} style={{ color: '#2D6A4F' }}>★</span>
          ))}
          <span className="text-[11px] font-mono ml-1" style={{ color: '#5a5a5a' }}>{review.rating}/5</span>
        </div>
      )}

      {/* Tool logo + name */}
      <div className="flex items-center gap-2 py-1">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {icon || name.charAt(0)}
        </div>
        <span className="text-[12px] font-medium text-tv-text">{name}</span>
      </div>

      {/* Best For */}
      {review.bestFor && (
        <div>
          <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-0.5">Best For</p>
          <p className="text-[13px] text-tv-text leading-relaxed">{review.bestFor}</p>
        </div>
      )}

      {/* Gotcha */}
      {review.gotcha && (
        <div>
          <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-0.5">Gotcha</p>
          <p className="text-[13px] text-tv-text leading-relaxed">{review.gotcha}</p>
        </div>
      )}

      {/* Free Tier */}
      {review.freeTier && (
        <div>
          <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-0.5">Free Tier</p>
          <p className="text-[13px] text-tv-text leading-relaxed">{review.freeTier}</p>
        </div>
      )}
    </div>
  );
}
