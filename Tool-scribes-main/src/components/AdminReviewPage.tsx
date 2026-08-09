import { useState } from 'react';
import { Check, X, ExternalLink, Loader2, Clock, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { ToolSubmission, SubmissionStatus, approveSubmission, rejectSubmission } from '@/lib/submission';
import { CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { generateAiProfile, saveAiProfile } from '@/lib/generate-ai-profile';

interface AdminReviewPageProps {
  submissions: ToolSubmission[];
  loading: boolean;
  onRefresh: () => void;
}

type FilterTab = SubmissionStatus | 'all';

export default function AdminReviewPage({ submissions, loading, onRefresh }: AdminReviewPageProps) {
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);
  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  const handleApprove = async (sub: ToolSubmission) => {
    setActionLoading(sub.id);
    const result = await approveSubmission(sub.id);
    if (result.error) {
      toast.error('Failed to approve', { description: result.error });
      setActionLoading(null);
      return;
    }
    toast.success('Tool approved');
    onRefresh();
    setActionLoading(null);

    // Generate AI profile if submission doesn't have one yet
    if (!sub.aiSummary && result.toolId) {
      const aiResult = await generateAiProfile(sub.title, sub.url, sub.description);
      if (aiResult.summary) {
        const saveResult = await saveAiProfile(result.toolId, aiResult.summary);
        if (saveResult.error) {
          console.error('[AdminReview] saveAiProfile failed:', saveResult.error);
        }
      }
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(id);
    const result = await rejectSubmission(id, rejectReason.trim());
    if (result.error) {
      toast.error('Failed to reject', { description: result.error });
    } else {
      toast.success('Submission rejected');
      setRejectId(null);
      setRejectReason('');
      onRefresh();
    }
    setActionLoading(null);
  };

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  const StatusBadge = ({ status }: { status: SubmissionStatus }) => {
    const styles: Record<SubmissionStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
      pending: { color: '#92400E', bg: '#FFFBEB', label: 'Pending', icon: <Clock size={11} /> },
      approved: { color: '#166534', bg: '#F0FDF4', label: 'Approved', icon: <CheckCircle size={11} /> },
      rejected: { color: '#991B1B', bg: '#FEF2F2', label: 'Rejected', icon: <AlertTriangle size={11} /> },
    };
    const s = styles[status];
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: s.color, background: s.bg }}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={18} className="animate-spin text-tv-text-m" />
        <span className="ml-2 text-[13px] font-mono text-tv-text-s">Loading submissions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-[24px] text-tv-text">Review Queue</h1>
          <p className="text-[12px] font-mono text-tv-text-s mt-0.5">
            {pendingCount} pending {pendingCount === 1 ? 'submission' : 'submissions'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 border border-tv-border rounded-lg text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-tv-border">
        {tabs.map(tab => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-2 text-[12px] font-mono font-medium transition-colors relative ${
                isActive ? 'text-tv-text' : 'text-tv-text-s hover:text-tv-text'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-s2 text-[10px]">{tab.count}</span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-tv-primary" />
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px] font-mono text-tv-text-s">
            {filter === 'pending' ? 'No pending submissions.' :
             filter === 'approved' ? 'No approved submissions.' :
             filter === 'rejected' ? 'No rejected submissions.' :
             'No submissions yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => {
            const domain = (() => { try { return new URL(sub.url).hostname.replace('www.', ''); } catch { return sub.url; } })();
            const catColor = CATEGORY_COLORS[sub.category];
            const catBg = CATEGORY_BG[sub.category];

            return (
              <div key={sub.id} className="border border-tv-border rounded-xl bg-surface overflow-hidden">
                {/* Main content */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-s2 border border-tv-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {sub.favicon ? <img src={sub.favicon} className="w-6 h-6 object-contain" alt="" /> : <span className="text-sm">🔧</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-syne text-tv-text truncate">{sub.title || 'Untitled'}</h3>
                        <StatusBadge status={sub.status} />
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                          {CATEGORY_SHORT[sub.category]}
                        </span>
                      </div>
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-tv-text-s hover:text-tv-primary flex items-center gap-1 mt-0.5"
                      >
                        {domain}
                        <ExternalLink size={10} />
                      </a>
                      {sub.description && (
                        <p className="text-[12px] text-tv-text-s mt-1.5 line-clamp-2">{sub.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Metadata footer */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] font-mono text-tv-text-m">
                    {sub.submitterEmail && (
                      <span>Submitted by {sub.submitterEmail}</span>
                    )}
                    <span>{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</span>
                    {sub.rejectionReason && (
                      <span className="text-red-600">Reason: {sub.rejectionReason}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {sub.status === 'pending' && (
                  <div className="px-4 py-3 border-t border-tv-border bg-s2 flex items-center justify-end gap-2">
                    {rejectId === sub.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleReject(sub.id); if (e.key === 'Escape') { setRejectId(null); setRejectReason(''); } }}
                          placeholder="Reason for rejection..."
                          className="flex-1 bg-surface border border-tv-border rounded-lg px-2.5 py-1.5 text-[12px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary"
                        />
                        <button
                          onClick={() => { setRejectId(null); setRejectReason(''); }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] text-tv-text-s hover:text-tv-text transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          disabled={!rejectReason.trim() || actionLoading === sub.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === sub.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                          Reject
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setRejectId(sub.id); setRejectReason(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 border border-tv-border rounded-lg text-[11px] text-tv-text-s hover:text-red-600 hover:border-red-300 transition-colors"
                        >
                          <X size={11} />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(sub)}
                          disabled={actionLoading === sub.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === sub.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
