import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fetchPendingAlternatives, approveAlternative, rejectAlternative } from '@/lib/alternatives';
import { toast } from 'sonner';

interface PendingAlt {
  id: string;
  sourceName: string;
  altName: string;
  createdAt: string;
}

export default function AdminAlternativeModeration() {
  const { isAdmin, isModerator } = useAuth();
  const [pending, setPending] = useState<PendingAlt[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const items = await fetchPendingAlternatives();
    // Map to simpler display format
    setPending(items.map(i => ({
      id: i.id,
      sourceName: (i as any).sourceName || 'Unknown',
      altName: i.altName,
      createdAt: i.createdAt,
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin || isModerator) load();
    else setLoading(false);
  }, [isAdmin, isModerator]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    const { error } = await approveAlternative(id);
    if (error) toast.error(error);
    else { toast.success('Alternative approved'); setPending(prev => prev.filter(p => p.id !== id)); }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    const { error } = await rejectAlternative(id);
    if (error) toast.error(error);
    else { toast.success('Alternative rejected'); setPending(prev => prev.filter(p => p.id !== id)); }
    setActionLoading(null);
  };

  if (!isAdmin && !isModerator) {
    return <div className="p-8 text-center text-[13px] font-mono text-tv-text-s">Access denied.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-syne text-[24px] text-tv-text">Alternative Suggestions</h2>
          <p className="text-[12px] font-mono text-tv-text-s mt-1">Approve or reject community-suggested tool alternatives.</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-[12px] font-mono text-tv-text-s border border-tv-border rounded-lg hover:text-tv-text transition-colors">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-tv-text-m" />
        </div>
      ) : pending.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-tv-border rounded-xl">
          <p className="text-[13px] font-mono text-tv-text-s">No pending alternative suggestions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="flex items-center justify-between p-4 bg-surface border border-tv-border rounded-xl"
            >
              <div>
                <p className="text-[13px] font-syne text-tv-text">
                  <span className="font-medium">{p.sourceName}</span>
                  <span className="text-tv-text-m mx-1.5">→</span>
                  <span className="font-medium">{p.altName}</span>
                </p>
                <p className="text-[10px] font-mono text-tv-text-m mt-0.5">
                  Suggested {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(p.id)}
                  disabled={actionLoading === p.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-[12px] font-medium rounded-lg hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-40"
                >
                  {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Approve
                </button>
                <button
                  onClick={() => handleReject(p.id)}
                  disabled={actionLoading === p.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-[12px] font-medium rounded-lg hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-40"
                >
                  {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
