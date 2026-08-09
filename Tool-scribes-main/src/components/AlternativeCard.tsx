import { useNavigate } from 'react-router-dom';
import { ExternalLink, ThumbsUp } from 'lucide-react';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import AlternativeConfidence from '@/components/AlternativeConfidence';
import type { Alternative } from '@/lib/alternatives';
import { hashId } from '@/lib/hashId';

interface AlternativeCardProps {
  alternative: Alternative;
  onVote: (id: string) => void;
}

export default function AlternativeCard({ alternative, onVote }: AlternativeCardProps) {
  const navigate = useNavigate();
  const numId = hashId(alternative.alternativeToolId);
  const catColor = CATEGORY_COLORS[alternative.altCategory as keyof typeof CATEGORY_COLORS] || '#374151';
  const catBg = CATEGORY_BG[alternative.altCategory as keyof typeof CATEGORY_BG] || 'rgba(55,65,81,0.08)';
  const catLabel = CATEGORY_LABELS[alternative.altCategory as keyof typeof CATEGORY_LABELS] || alternative.altCategory;

  return (
    <div className="flex items-start gap-3 p-4 bg-surface border border-tv-border rounded-xl transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-soft">
      <div
        className="w-10 h-10 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={() => navigate(`/tool/${numId}`)}
      >
        {alternative.altFavicon ? (
          <img src={alternative.altFavicon} className="w-6 h-6 object-contain" alt="" />
        ) : (
          <span className="text-lg">{alternative.altIcon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/tool/${numId}`)}
            className="font-syne text-[14px] text-tv-text leading-tight truncate hover:text-tv-primary transition-colors"
          >
            {alternative.altName}
          </button>
          <AlternativeConfidence votes={alternative.votes} saveCount={alternative.altSaveCount} ratingCount={alternative.altAvgRating !== null ? 1 : 0} />
        </div>
        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium mt-1" style={{ color: catColor, background: catBg }}>
          {catLabel.toUpperCase()}
        </span>
        <p className="text-[11px] text-tv-text-s font-mono mt-1 line-clamp-2 leading-relaxed">{alternative.altDescription}</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-tv-text-m">
          <span>{alternative.altSaveCount} saves</span>
          {alternative.altAvgRating !== null && (
            <>
              <span className="text-tv-border">·</span>
              <span style={{ color: '#2D6A4F' }}>{'★'.repeat(Math.round(alternative.altAvgRating))}{'☆'.repeat(5 - Math.round(alternative.altAvgRating))} {alternative.altAvgRating.toFixed(1)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onVote(alternative.id); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
              alternative.votedByMe
                ? 'bg-tv-primary-g border-tv-primary text-tv-primary'
                : 'border-tv-border text-tv-text-s hover:border-tv-primary hover:text-tv-primary'
            }`}
          >
            <ThumbsUp size={11} /> {alternative.votes}
          </button>
          <button
            onClick={() => navigate(`/tool/${numId}`)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono text-tv-text-s hover:text-tv-primary border border-tv-border hover:border-tv-primary transition-colors"
          >
            View Tool <ExternalLink size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
