import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT, CATEGORY_LABELS } from '@/lib/types';
import { buildToolRecs } from '@/lib/recommendations';
import type { RecItem } from '@/lib/recommendations';
import { hashId } from '@/lib/hashId';

interface ToolRecommendationsProps {
  toolUuid: string;
}

export default function ToolRecommendations({ toolUuid }: ToolRecommendationsProps) {
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    buildToolRecs(toolUuid, 6).then(items => {
      if (mounted.current) setRecs(items);
    }).catch((e) => console.error('[ToolRecommendations] build tool recs failed:', e)).finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => { mounted.current = false; };
  }, [toolUuid]);

  if (loading || recs.length === 0) return null;

  const domain = (url: string) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } };

  return (
    <div className="pt-2">
      <div className="flex items-center gap-1.5 mb-4">
        <Sparkles size={13} className="text-tv-primary" />
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">You May Also Like</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {recs.map(item => {
          const catColor = CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS];
          const catBg = CATEGORY_BG[item.category as keyof typeof CATEGORY_BG];
          return (
            <button key={item.id} onClick={() => navigate(`/tool/${item.id}`)}
              className="flex items-start gap-3 p-3 bg-surface border border-tv-border rounded-xl text-left transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.favicon ? <img src={item.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-sm">{item.icon}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-syne text-tv-text leading-tight truncate">{item.name}</p>
                <p className="text-[10px] font-mono text-tv-text-m mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                    {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS]?.toUpperCase() || item.category.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-tv-text-m italic">{item.reason}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
