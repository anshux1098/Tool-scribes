import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, ExternalLink, Loader2, ArrowLeft } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import type { ToolSubmission, SubmissionStatus } from '@/lib/submission';
import { SEO } from '@/components/SEO';

export default function MySubmissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<ToolSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!isSupabaseConfigured) { setLoading(false); return; }

    supabase.from('tool_submissions')
      .select('*')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('[MySubmissionsPage] fetch error', error); return; }
        if (data) {
          setSubmissions(data.map(mapRow));
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const pending = submissions.filter(s => s.status === 'pending');
  const approved = submissions.filter(s => s.status === 'approved');
  const rejected = submissions.filter(s => s.status === 'rejected');

  const statusIcon = (status: SubmissionStatus) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-amber-600" />;
      case 'approved': return <CheckCircle size={14} className="text-emerald-600" />;
      case 'rejected': return <XCircle size={14} className="text-red-600" />;
    }
  };

  const statusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-red-100 text-red-800';
    }
  };

  const statusLabel = (status: SubmissionStatus) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
    }
  };

  return (
    <>
      <SEO title="My Submissions" description="Track your tool submissions on Tool Scribe." path="/submissions/me" />
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <h1 className="font-syne text-[32px] text-tv-text leading-tight mb-2">
          My <em className="not-italic text-tv-primary">Submissions</em>
        </h1>
        <p className="text-[14px] text-tv-text-s mb-8 font-mono">
          Track the tools you've submitted for review.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-tv-text-m" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-[14px] text-tv-text-s font-mono mb-4">No submissions yet.</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
            >
              Submit a tool
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {pending.length > 0 && (
              <Section label="Pending" count={pending.length}>
                {pending.map((s, i) => (
                  <SubmissionCard key={s.id} submission={s} index={i} statusIcon={statusIcon} statusBadge={statusBadge} statusLabel={statusLabel} />
                ))}
              </Section>
            )}
            {approved.length > 0 && (
              <Section label="Approved" count={approved.length}>
                {approved.map((s, i) => (
                  <SubmissionCard key={s.id} submission={s} index={i} statusIcon={statusIcon} statusBadge={statusBadge} statusLabel={statusLabel} />
                ))}
              </Section>
            )}
            {rejected.length > 0 && (
              <Section label="Rejected" count={rejected.length}>
                {rejected.map((s, i) => (
                  <SubmissionCard key={s.id} submission={s} index={i} statusIcon={statusIcon} statusBadge={statusBadge} statusLabel={statusLabel} rejectionDetail />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-mono text-tv-text-m">— {count}</span>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function SubmissionCard({ submission: s, index, statusIcon, statusBadge, statusLabel, rejectionDetail }: {
  submission: ToolSubmission;
  index: number;
  statusIcon: (s: SubmissionStatus) => React.ReactNode;
  statusBadge: (s: SubmissionStatus) => string;
  statusLabel: (s: SubmissionStatus) => string;
  rejectionDetail?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="p-4 rounded-xl bg-surface border-2 border-tv-border"
    >
      <div className="flex items-start gap-3">
        {s.favicon && (
          <img src={s.favicon} alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-medium text-tv-text truncate">{s.title}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${statusBadge(s.status)}`}>
              {statusIcon(s.status)}
              {statusLabel(s.status)}
            </span>
          </div>
          {s.description && (
            <p className="text-[12px] text-tv-text-s font-mono mt-1 line-clamp-2">{s.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-tv-text-m">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-tv-primary transition-colors truncate">
              <ExternalLink size={10} />
              {s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
            <span>Submitted {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</span>
          </div>
          {rejectionDetail && s.rejectionReason && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[11px] font-mono text-red-700">Reason: {s.rejectionReason}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function mapRow(row: Record<string, unknown>): ToolSubmission {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    status: row.status as SubmissionStatus,
    url: row.url as string,
    normalizedDomain: row.normalized_domain as string,
    title: row.title as string,
    description: row.description as string,
    category: (row.category as ToolSubmission['category']) || 'util',
    icon: row.icon as string,
    favicon: row.favicon as string,
    ogImage: row.og_image as string,
    screenshotUrl: row.screenshot_url as string,
    submittedBy: row.submitted_by as string | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewedAt: row.reviewed_at as string | null,
    rejectionReason: row.rejection_reason as string,
    matchedToolId: row.matched_tool_id as string | null,
  };
}
