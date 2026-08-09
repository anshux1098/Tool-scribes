import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Archive, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ToolHealthBadge from '@/components/ToolHealthBadge';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllToolHealth, fetchHealthCheckLogs, runHealthCheck, setToolHealthStatus, HEALTH_LABELS, HEALTH_COLORS } from '@/lib/health';
import type { ToolHealth, HealthCheckLog } from '@/lib/health';
import { toast } from 'sonner';

interface HealthEntry {
  toolId: string;
  health: ToolHealth;
  logs: HealthCheckLog[];
}

export default function AdminHealthPage() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const allHealth = await fetchAllToolHealth();
    const entriesWithLogs = await Promise.all(
      [...allHealth].map(async ([toolId, health]) => ({
        toolId,
        health,
        logs: await fetchHealthCheckLogs(toolId),
      }))
    );
    const entryList = entriesWithLogs;
    entryList.sort((a, b) => {
      const order = { archived: 0, sunset: 1, warning: 2, active: 3, unknown: 4 };
      return (order[a.health.status as keyof typeof order] ?? 5) - (order[b.health.status as keyof typeof order] ?? 5);
    });
    setEntries(entryList);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleRunCheck = async (toolUuid: string) => {
    setRunningChecks(prev => new Set(prev).add(toolUuid));
    await runHealthCheck(toolUuid, '');
    setRunningChecks(prev => { const next = new Set(prev); next.delete(toolUuid); return next; });
    await loadData();
  };

  const handleSetStatus = async (toolId: string, status: string) => {
    try {
      await setToolHealthStatus(toolId, status as any);
      await loadData();
      toast.success('Tool archived');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const filtered = statusFilter === 'all' ? entries : entries.filter(e => e.health.status === statusFilter);

  const hasIssues = entries.some(e => e.health.status === 'warning' || e.health.status === 'sunset' || e.health.status === 'archived');

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 flex items-center justify-center">
        <p className="text-[14px] text-tv-text-s font-mono">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-[24px] text-tv-text leading-tight">Tool Health</h1>
          <p className="text-[12px] font-mono text-tv-text-m mt-1">
            {entries.length} tool{entries.length !== 1 ? 's' : ''} tracked
            {hasIssues && (
              <span className="text-amber-600"> &middot; some tools need attention</span>
            )}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6">
        {['all', 'warning', 'active', 'sunset', 'archived'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
              statusFilter === f
                ? 'bg-tv-text text-bg'
                : 'text-tv-text-s hover:text-tv-text hover:bg-s2'
            }`}
          >
            {f === 'all' ? 'All' : HEALTH_LABELS[f as keyof typeof HEALTH_LABELS]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={18} className="animate-spin text-tv-text-m" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <CheckCircle size={24} className="text-green-500 mb-3" />
          <p className="text-[14px] text-tv-text-s font-mono">No tools with this status.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <div className="min-w-[600px] space-y-2">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-3 py-1.5 text-[10px] font-mono text-tv-text-m uppercase tracking-widest border-b border-tv-border">
            <span>Tool ID</span>
            <span>Status</span>
            <span>Uptime</span>
            <span>Last Check</span>
            <span />
          </div>
          {filtered.map(entry => (
            <div key={entry.toolId}>
              <button
                onClick={() => setSelectedEntry(selectedEntry === entry.toolId ? null : entry.toolId)}
                className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center px-3 py-2 rounded-lg hover:bg-s2 transition-colors text-left group"
              >
                <span className="text-[13px] font-mono text-tv-text truncate">{entry.toolId}</span>
                <div>
                  <ToolHealthBadge status={entry.health.status as any} size="md" />
                </div>
                <span className="text-[12px] font-mono text-tv-text-s">
                  {entry.health.uptimePct != null ? `${Math.round(entry.health.uptimePct)}%` : '—'}
                </span>
                <span className="text-[12px] font-mono text-tv-text-s">
                  {entry.health.lastHealthCheck
                    ? formatDistanceToNow(new Date(entry.health.lastHealthCheck), { addSuffix: true })
                    : 'Never'}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); handleRunCheck(entry.toolId); }}
                    disabled={runningChecks.has(entry.toolId)}
                    className="p-1 rounded hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors disabled:opacity-40"
                    title="Run health check now"
                  >
                    <Globe size={13} className={runningChecks.has(entry.toolId) ? 'animate-spin' : ''} />
                  </button>
                  {entry.health.status !== 'archived' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSetStatus(entry.toolId, 'archived'); }}
                      className="p-1 rounded hover:bg-s2 text-tv-text-s hover:text-red-500 transition-colors"
                      title="Archive tool"
                    >
                      <Archive size={13} />
                    </button>
                  )}
                  {entry.health.status !== 'active' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSetStatus(entry.toolId, 'active'); }}
                      className="p-1 rounded hover:bg-s2 text-tv-text-s hover:text-green-500 transition-colors"
                      title="Mark as active"
                    >
                      <CheckCircle size={13} />
                    </button>
                  )}
                </div>
              </button>

              {/* Expanded logs */}
              {selectedEntry === entry.toolId && (
                <div className="ml-3 pl-4 border-l-2 border-tv-border py-2 space-y-1 mb-2">
                  <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Check History</p>
                  {entry.logs.length === 0 ? (
                    <p className="text-[12px] font-mono text-tv-text-s">No checks recorded yet.</p>
                  ) : (
                    entry.logs.slice(0, 20).map(log => (
                      <div key={log.id} className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-tv-text-s">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: HEALTH_COLORS[log.status as keyof typeof HEALTH_COLORS] || '#666' }}
                        />
                        <span className="text-tv-text-m">HTTP {log.httpStatus || '—'}</span>
                        <span className="text-tv-text-m">{log.responseTimeMs != null ? `${log.responseTimeMs}ms` : ''}</span>
                        {log.errorMessage && <span className="text-red-400 truncate">{log.errorMessage}</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
