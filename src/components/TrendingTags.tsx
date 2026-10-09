import { useNavigate } from 'react-router-dom';
import { Hash, TrendingUp } from 'lucide-react';
import { Tag } from '@/lib/tags';

interface TrendingTagsProps {
  tags: Tag[];
  loading: boolean;
}

export default function TrendingTags({ tags, loading }: TrendingTagsProps) {
  const navigate = useNavigate();
  const topTags = tags.filter(t => t.toolCount > 0).slice(0, 8);

  if (loading || topTags.length === 0) return null;

  return (
    <div className="border-t border-tv-border pt-6 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={13} className="text-tv-text-m" />
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Trending Tags</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topTags.map(tag => {
          const bg = hexToRgba(tag.color, 0.08);
          return (
            <button
              key={tag.id}
              onClick={() => navigate(`/tag/${tag.slug}`)}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded text-[11px] font-mono font-medium hover:opacity-80 transition-opacity"
              style={{ color: tag.color, background: bg }}
            >
              <Hash size={10} />
              {tag.name}
              <span className="opacity-60 ml-0.5">({tag.toolCount})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(107,114,128,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}
