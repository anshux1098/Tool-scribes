import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, ExternalLink, Check, Sparkles, Scale, Shield, Globe, Star } from 'lucide-react';
import { SEO } from '@/components/SEO';
import Navbar from '@/components/Navbar';
import { useTools } from '@/hooks/useTools';
import { useReviews } from '@/hooks/useReviews';
import { Tool, CATEGORY_LABELS } from '@/lib/types';
import ToolHealthBadge from '@/components/ToolHealthBadge';
import { fetchToolHealth } from '@/lib/health';
import { useEffect } from 'react';

export default function ComparePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tools, loading } = useTools();

  // Selected tool IDs from query params: ?tools=123,456
  const selectedIds = useMemo(() => {
    const raw = searchParams.get('tools') || '';
    return raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0).slice(0, 4);
  }, [searchParams]);

  const selectedTools = useMemo(() => {
    return selectedIds.map(id => tools.find(t => t.id === id)).filter((t): t is Tool & { _uuid: string } => !!t);
  }, [selectedIds, tools]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [healthMap, setHealthMap] = useState<Record<string, string>>({});

  useEffect(() => {
    selectedTools.forEach(t => {
      if (t._uuid && !healthMap[t._uuid]) {
        fetchToolHealth(t._uuid).then(h => {
          if (h?.status) {
            setHealthMap(prev => ({ ...prev, [t._uuid]: h.status }));
          }
        }).catch(() => {});
      }
    });
  }, [selectedTools, healthMap]);

  const addToolToCompare = (id: number) => {
    if (selectedIds.includes(id) || selectedIds.length >= 4) return;
    const next = [...selectedIds, id];
    setSearchParams({ tools: next.join(',') });
    setSelectorOpen(false);
    setSearchQuery('');
  };

  const removeToolFromCompare = (id: number) => {
    const next = selectedIds.filter(i => i !== id);
    if (next.length > 0) {
      setSearchParams({ tools: next.join(',') });
    } else {
      setSearchParams({});
    }
  };

  const availableTools = useMemo(() => {
    if (!searchQuery.trim()) return tools.filter(t => !selectedIds.includes(t.id)).slice(0, 10);
    const q = searchQuery.toLowerCase();
    return tools.filter(t => !selectedIds.includes(t.id) && (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))).slice(0, 10);
  }, [tools, selectedIds, searchQuery]);

  return (
    <div className="min-h-screen bg-bg">
      <SEO
        title={selectedTools.length > 0 ? `Compare ${selectedTools.map(t => t.name).join(' vs ')}` : 'Side-by-Side Tool Comparison'}
        description="Compare software tools, developer stacks, and productivity utilities side-by-side with structured reviews, pricing reality, and live uptime checks."
        path="/compare"
      />
      <Navbar
        activeTab="discover"
        onTabChange={() => navigate('/')}
        onAuthClick={() => navigate('/')}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-[13px] font-mono text-tv-text-m hover:text-tv-text mb-3 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-tv-primary/10 text-tv-primary">
                <Scale size={22} />
              </span>
              <div>
                <h1 className="font-syne text-2xl sm:text-3xl text-tv-text font-bold">Tool Matrix Comparison</h1>
                <p className="text-[13px] text-tv-text-s mt-0.5">
                  Evaluate software side-by-side: pricing reality, structured gotchas, open-source status, and uptime.
                </p>
              </div>
            </div>
          </div>

          {selectedTools.length < 4 && (
            <div className="relative">
              <button
                onClick={() => setSelectorOpen(!selectorOpen)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tv-primary text-white text-[13px] font-medium hover:bg-tv-primary-dark transition-colors shadow-sm"
              >
                <Plus size={16} /> Add tool to compare ({selectedTools.length}/4)
              </button>

              {selectorOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface border border-tv-border rounded-xl shadow-xl z-50 p-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tools to add..."
                    autoFocus
                    className="w-full px-3 py-2 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text focus:outline-none focus:ring-1 focus:ring-tv-primary mb-2"
                  />
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {availableTools.map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => addToolToCompare(tool.id)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-s2 transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-md bg-s2 flex items-center justify-center flex-shrink-0 border border-tv-border">
                          {tool.favicon ? (
                            <img src={tool.favicon} className="w-4 h-4 object-contain" alt="" />
                          ) : (
                            <span className="text-xs">{tool.icon}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-tv-text truncate group-hover:text-tv-primary">{tool.name}</p>
                          <p className="text-[11px] text-tv-text-m truncate">{tool.category}</p>
                        </div>
                      </button>
                    ))}
                    {availableTools.length === 0 && (
                      <p className="text-center py-4 text-xs text-tv-text-m">No tools found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedTools.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-tv-border rounded-2xl shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-tv-primary/10 text-tv-primary flex items-center justify-center mx-auto mb-4">
              <Scale size={28} />
            </div>
            <h2 className="text-lg font-syne font-bold text-tv-text mb-2">No tools selected for comparison</h2>
            <p className="text-[13px] text-tv-text-s max-w-md mx-auto mb-6">
              Pick 2 to 4 tools from the catalog to see their features, pricing models, structured community reviews, and uptime ratings side-by-side.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
              {tools.slice(0, 6).map(t => (
                <button
                  key={t.id}
                  onClick={() => addToolToCompare(t.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-s2 border border-tv-border text-[12px] font-medium text-tv-text hover:border-tv-primary transition-colors"
                >
                  <span>{t.icon}</span> {t.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="min-w-[700px] bg-surface border border-tv-border rounded-2xl overflow-hidden shadow-sm">
              {/* Header Row */}
              <div className="grid grid-cols-5 border-b border-tv-border bg-s2/40">
                <div className="p-4 font-mono text-xs uppercase tracking-wider text-tv-text-m flex items-center">
                  Tool Overview
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border relative flex flex-col justify-between">
                    <button
                      onClick={() => removeToolFromCompare(tool.id)}
                      className="absolute top-3 right-3 p-1 rounded-md text-tv-text-m hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove from comparison"
                    >
                      <X size={14} />
                    </button>
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-surface border border-tv-border flex items-center justify-center mb-2.5">
                        {tool.favicon ? (
                          <img src={tool.favicon} className="w-6 h-6 object-contain" alt="" />
                        ) : (
                          <span className="text-xl">{tool.icon}</span>
                        )}
                      </div>
                      <h3 className="font-syne font-bold text-base text-tv-text">{tool.name}</h3>
                      <p className="text-[12px] text-tv-text-s line-clamp-2 mt-1">{tool.description}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-tv-border/50 flex items-center justify-between">
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-tv-primary hover:underline"
                      >
                        Visit <ExternalLink size={10} />
                      </a>
                      <button
                        onClick={() => navigate(`/tool/${tool.id}`)}
                        className="text-[11px] font-mono text-tv-text-m hover:text-tv-text hover:underline"
                      >
                        View profile →
                      </button>
                    </div>
                  </div>
                ))}
                {/* Empty placeholder columns if < 4 */}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border flex items-center justify-center">
                    <button
                      onClick={() => setSelectorOpen(true)}
                      className="h-28 w-full border-2 border-dashed border-tv-border rounded-xl flex flex-col items-center justify-center text-tv-text-m hover:border-tv-primary hover:text-tv-primary transition-colors gap-1.5"
                    >
                      <Plus size={18} />
                      <span className="text-xs font-mono">Add tool</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-5 border-b border-tv-border">
                <div className="p-4 font-mono text-xs text-tv-text-m bg-s2/20 flex items-center">
                  Category &amp; Health
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border flex flex-col gap-2 justify-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-s2 border border-tv-border text-tv-text w-fit">
                      {CATEGORY_LABELS[tool.category] || tool.category}
                    </span>
                    {healthMap[tool._uuid] ? (
                      <ToolHealthBadge status={healthMap[tool._uuid] as any} size="sm" />
                    ) : (
                      <span className="text-[11px] font-mono text-tv-text-m">Checking status...</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border" />
                ))}
              </div>

              {/* Pricing Model & Free Tier */}
              <div className="grid grid-cols-5 border-b border-tv-border">
                <div className="p-4 font-mono text-xs text-tv-text-m bg-s2/20 flex items-center">
                  Pricing Reality
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border flex flex-col gap-1 justify-center">
                    <span className="text-[13px] font-bold text-tv-text capitalize">
                      {tool.priceModel === 'free' ? '100% Free' : tool.priceModel}
                    </span>
                    <span className="text-[11px] text-tv-text-s">
                      {tool.isFree ? 'Has usable free tier' : 'Paid / subscription required'}
                    </span>
                  </div>
                ))}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border" />
                ))}
              </div>

              {/* Open Source & Login */}
              <div className="grid grid-cols-5 border-b border-tv-border">
                <div className="p-4 font-mono text-xs text-tv-text-m bg-s2/20 flex items-center">
                  Freedom &amp; Privacy
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border flex flex-col gap-1.5 justify-center">
                    <div className="flex items-center gap-1.5 text-xs text-tv-text">
                      {tool.isOpenSource ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <Check size={13} /> Open Source
                        </span>
                      ) : (
                        <span className="text-tv-text-m">Proprietary</span>
                      )}
                    </div>
                    <div className="text-[11px] text-tv-text-s">
                      {tool.requiresLogin ? 'Account required' : 'No account / instant use'}
                    </div>
                  </div>
                ))}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border" />
                ))}
              </div>

              {/* Upvotes & Community Score */}
              <div className="grid grid-cols-5 border-b border-tv-border">
                <div className="p-4 font-mono text-xs text-tv-text-m bg-s2/20 flex items-center">
                  Community Upvotes
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border flex items-center gap-2">
                    <span className="font-syne font-bold text-lg text-tv-text">{tool.upvotes}</span>
                    <span className="text-xs text-tv-text-m">curator upvotes</span>
                  </div>
                ))}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border" />
                ))}
              </div>

              {/* Platforms */}
              <div className="grid grid-cols-5">
                <div className="p-4 font-mono text-xs text-tv-text-m bg-s2/20 flex items-center">
                  Supported Platforms
                </div>
                {selectedTools.map(tool => (
                  <div key={tool.id} className="p-4 border-l border-tv-border flex flex-wrap gap-1 items-center">
                    {tool.platforms && tool.platforms.length > 0 ? (
                      tool.platforms.map(p => (
                        <span key={p} className="px-2 py-0.5 rounded text-[10px] font-mono bg-s2 border border-tv-border text-tv-text">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-tv-text-m font-mono">Web</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: 4 - selectedTools.length }).map((_, i) => (
                  <div key={i} className="p-4 border-l border-tv-border" />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
