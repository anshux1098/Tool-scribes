import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildCuratorRecs } from '@/lib/recommendations';

interface CuratorRec {
  curatorId: string;
  sharedFollowers: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
}

interface CuratorRecommendationsProps {
  curatorId: string;
}

export default function CuratorRecommendations({ curatorId }: CuratorRecommendationsProps) {
  const [curators, setCurators] = useState<CuratorRec[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    buildCuratorRecs(curatorId, 4).then(items => {
      if (mounted.current) setCurators(items);
    }).catch((e) => console.error('[CuratorRecommendations] build curator recs failed:', e)).finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => { mounted.current = false; };
  }, [curatorId]);

  if (loading || curators.length === 0) return null;

  return (
    <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}>
      <div className="flex items-center gap-2 mb-4">
        <Users size={15} style={{ color: '#2D6A4F' }} />
        <span className="text-[11px] font-dmsans font-semibold uppercase tracking-widest" style={{ color: '#5a5a5a' }}>
          Similar Curators
        </span>
      </div>
      <div className="space-y-3">
        {curators.map((cur, i) => (
          <motion.button
            key={cur.curatorId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            onClick={() => navigate(`/u/${cur.username}`)}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-[#F0EDE6] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
              {cur.avatarUrl ? (
                <img src={cur.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-[14px] font-syne font-bold" style={{ backgroundColor: '#2D6A4F' }}>
                  {cur.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-dmsans font-medium leading-tight truncate" style={{ color: '#1a1a1a' }}>
                {cur.displayName}
              </p>
              <p className="text-[11px] font-dmsans" style={{ color: '#5a5a5a' }}>@{cur.username}</p>
              {cur.bio && <p className="text-[10px] font-dmsans mt-0.5 line-clamp-1" style={{ color: '#5a5a5a' }}>{cur.bio}</p>}
            </div>
            <span className="text-[10px] font-dmsans flex-shrink-0" style={{ color: '#5a5a5a' }}>{cur.sharedFollowers} shared</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
