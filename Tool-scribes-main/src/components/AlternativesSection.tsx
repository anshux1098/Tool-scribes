import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AlternativeCard from '@/components/AlternativeCard';
import { fetchAlternatives, voteAlternative, unvoteAlternative } from '@/lib/alternatives';
import type { Alternative } from '@/lib/alternatives';

interface AlternativesSectionProps {
  toolUuid: string;
  onSuggest: () => void;
}

export default function AlternativesSection({ toolUuid, onSuggest }: AlternativesSectionProps) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    fetchAlternatives(toolUuid).then(items => {
      if (mounted.current) setAlternatives(items);
    }).catch((e) => console.error('[AlternativesSection] fetch alternatives failed:', e)).finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => { mounted.current = false; };
  }, [toolUuid]);

  const handleVote = async (id: string) => {
    if (!user) return;
    const alt = alternatives.find(a => a.id === id);
    if (!alt) return;
    if (alt.votedByMe) {
      const { error } = await unvoteAlternative(id);
      if (!error) setAlternatives(prev => prev.map(a => a.id === id ? { ...a, votedByMe: false, votes: Math.max(a.votes - 1, 0) } : a));
    } else {
      const { error } = await voteAlternative(id);
      if (!error) setAlternatives(prev => prev.map(a => a.id === id ? { ...a, votedByMe: true, votes: a.votes + 1 } : a));
    }
  };

  if (loading) return null;

  const labelClass = 'text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2.5';

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <GitBranch size={13} className="text-tv-primary" />
          <span className={labelClass.replace('mb-2.5', 'mb-0')}>Alternatives</span>
          {alternatives.length > 0 && (
            <span className="text-[10px] font-mono text-tv-text-m">— {alternatives.length}</span>
          )}
        </div>
        {user && (
          <button
            onClick={onSuggest}
            className="flex items-center gap-1 text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
          >
            <Plus size={12} /> Suggest Alternative
          </button>
        )}
      </div>

      {alternatives.length === 0 ? (
        <div className="p-6 rounded-xl border-2 border-dashed border-tv-border text-center">
          <p className="text-[12px] font-mono text-tv-text-s mb-3">No alternatives yet.</p>
          {user && (
            <button
              onClick={onSuggest}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-tv-primary text-white text-[12px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
            >
              <Plus size={12} /> Suggest Alternative
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alternatives.map(alt => (
            <AlternativeCard key={alt.id} alternative={alt} onVote={handleVote} />
          ))}
        </div>
      )}
    </div>
  );
}
