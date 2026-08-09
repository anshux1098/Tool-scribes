import { useNavigate } from 'react-router-dom';
import { Shield, Activity, MessageSquare, Hash, GitBranch, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const adminLinks = [
  { path: '/admin/review', label: 'Submission Queue', desc: 'Review and approve/reject community tool submissions', icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
  { path: '/admin/health', label: 'Tool Health', desc: 'Monitor uptime and status of all tools', icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
  { path: '/admin/reviews', label: 'Review Moderation', desc: 'Moderate community-written tool reviews', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  { path: '/admin/tags', label: 'Tag Moderation', desc: 'Approve or reject community-suggested tags', icon: Hash, color: 'text-purple-600', bg: 'bg-purple-50' },
  { path: '/admin/alternatives', label: 'Alternative Suggestions', desc: 'Approve or reject tool alternative suggestions', icon: GitBranch, color: 'text-teal-600', bg: 'bg-teal-50' },
];

export default function AdminIndex() {
  const navigate = useNavigate();
  const { isAdmin, isModerator, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[13px] font-mono text-tv-text-m">Loading...</p>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[14px] text-tv-text-s font-mono">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-4 border-b border-tv-border">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono">
          <ArrowLeft size={14} /> Back to app
        </button>
      </div>
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-16">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2">Administration</p>
        <h1 className="font-syne text-[36px] text-tv-text mb-1">Dashboard</h1>
        <p className="text-[14px] text-tv-text-s font-mono mb-8">{isAdmin ? 'Full admin access' : 'Moderator access — limited to submission review'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {adminLinks.map(link => {
            const Icon = link.icon;
            const allowed = isAdmin || link.path === '/admin/review';
            if (!allowed) return null;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex items-start gap-4 p-5 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
              >
                <div className={`w-10 h-10 rounded-xl ${link.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={link.color} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-syne text-[16px] text-tv-text leading-tight">{link.label}</h3>
                  <p className="text-[12px] text-tv-text-s mt-0.5 leading-relaxed">{link.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
