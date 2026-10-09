import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { buildVaultRecs } from '@/lib/recommendations';
import type { RecItem } from '@/lib/recommendations';
import { useAuth } from '@/hooks/useAuth';

export default function VaultRecommendations() {
  const [recs, setRecs] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const mounted = useRef(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    mounted.current = true;
    setLoading(true);
    buildVaultRecs(user.id, 12).then(items => {
      if (mounted.current) setRecs(items);
    }).catch((e) => console.error('[VaultRecommendations] build vault recs failed:', e)).finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => { mounted.current = false; };
  }, [user?.id]);

  if (loading || recs.length === 0) return null;

  return (
    <div className="py-6 border-b border-tv-border">
      <div className="flex items-center gap-1.5 mb-4">
        <Sparkles size={14} className="text-tv-primary" />
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Recommended For You</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recs.map((item, i) => {
          const catColor = CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS];
          const catBg = CATEGORY_BG[item.category as keyof typeof CATEGORY_BG];
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              onClick={() => navigate(`/tool/${item.id}`)}
              className="flex items-start gap-3 p-3 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-hover shadow-brutal"
            >
              <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.favicon ? <img src={item.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{item.icon}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-syne text-tv-text leading-tight truncate">{item.name}</p>
                <p className="text-[10px] font-mono text-tv-text-s mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                    {CATEGORY_SHORT[item.category as keyof typeof CATEGORY_SHORT]?.toUpperCase() || item.category.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-tv-text-m italic">{item.reason}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
