import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Star, Copy, Check, FolderPlus, Bookmark, Wrench, Clock, Sparkles, Globe, Shield, Monitor, MessageSquare, Plus, Send, Loader2, Trash2, Code } from 'lucide-react';
import { Tool, Collection, Review, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_LABELS } from '@/lib/types';
import { generateSummary } from '@/lib/generateSummary';
import { askToolScribe } from '@/lib/ask-toolscribe';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import ToolHealthBadge from '@/components/ToolHealthBadge';
import ReviewCard from '@/components/ReviewCard';
import ReviewForm from '@/components/ReviewForm';
import ToolScreenshot from '@/components/ToolScreenshot';
import Markdown from '@/components/Markdown';

interface ToolDetailPageProps {
  tools: Tool[];
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  onRemoveFromVault: (id: number) => Promise<{ error?: string }>;
  onUpdateNotes: (id: number, notes: string) => void;
  onAddTag: (id: number, tag: string) => void;
  onRemoveTag: (id: number, tag: string) => void;
  onRecordVisit: (id: number) => void;
  collections?: Collection[];
  collectionIds?: number[];
  onAddToCollection?: () => void;
  healthStatus?: string;
  reviews?: Review[];
  myReview?: Review | null;
  reviewCount?: number;
  onSubmitReview?: (data: { best_for: string; gotcha: string; free_tier: string; rating: number }) => Promise<boolean>;
  onDeleteReview?: () => Promise<boolean>;
  canUpload?: boolean;
  onUpdateScreenshot?: (id: number, url: string) => void;
  isAdmin?: boolean;
  onRegenerateAiProfile?: (id: number) => Promise<void>;
}

interface Activity {
  type: 'added' | 'collected' | 'visited' | 'updated';
  label: string;
  timestamp: Date;
}

const FEATURE_ICONS: Record<string, typeof Shield> = {
  'No signup required': Wrench,
  'Open source': Shield,
  'Free to use': Sparkles,
  Web: Monitor,
  Mobile: Monitor,
  Desktop: Monitor,
  Cli: Code,
  Api: Globe,
};

const SUGGESTED_PROMPTS = [
  'What is this tool best for?',
  'Free alternatives?',
  'Is it beginner friendly?',
  'Show tutorials.',
];

export default function ToolDetailPage({
  tools, onSave, onToggleFavorite, onRemoveFromVault, onUpdateNotes, onAddTag, onRemoveTag, onRecordVisit, healthStatus,
  collections, collectionIds, onAddToCollection,
  reviews, myReview, reviewCount, onSubmitReview, onDeleteReview,
  canUpload, onUpdateScreenshot, isAdmin, onRegenerateAiProfile
}: ToolDetailPageProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const tool = tools.find(t => t.id === Number(id));
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest chat content in view as answers stream in.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatResponse, chatLoading]);

  useEffect(() => {
    if (tool) {
      setNotes(tool.notes || '');
      onRecordVisit(tool.id);
    }
  }, [tool?.id]);

  const handleAsk = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading || !tool) return;
    setChatLoading(true);
    setChatError(null);
    setChatResponse(null);
    const allReviews = [...(reviews || []), ...(myReview ? [myReview] : [])];
    const reviewsSummary = allReviews.length > 0
      ? allReviews.map(r => `"${r.bestFor}" (rating: ${r.rating}/5)`).join('; ')
      : 'No reviews yet';
    const presentFeatures = features.filter(f => f.present).map(f => f.label);
    const res = await askToolScribe(q, {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      tags: tool.tags || [],
      features: presentFeatures,
      reviewsSummary,
    });
    if (res.error) {
      setChatError(res.error);
    } else {
      setChatResponse(res.answer || 'No response.');
    }
    setChatLoading(false);
  };



  const similarTools = useMemo(() => {
    if (!tool) return [];
    return tools
      .filter(t => t.category === tool.category && t.id !== tool.id && t.savedToVault)
      .slice(0, 4);
  }, [tools, tool]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const all = [...reviews, ...(myReview ? [myReview] : [])];
    const sum = all.reduce((acc, r) => acc + r.rating, 0);
    return sum / all.length;
  }, [reviews, myReview]);

  const activities: Activity[] = useMemo(() => {
    if (!tool) return [];
    return [
      { type: 'added' as const, label: 'Added to vault', timestamp: new Date(tool.addedAt) },
      ...(Array.isArray(collectionIds) && collectionIds.length > 0
        ? collectionIds.map(() => ({ type: 'collected' as const, label: 'Added to a collection', timestamp: new Date() }))
        : []
      ),
      ...(tool.lastVisited
        ? [{ type: 'visited' as const, label: `Visited ${formatDistanceToNow(tool.lastVisited, { addSuffix: true })}`, timestamp: new Date(tool.lastVisited) }]
        : []
      ),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);
  }, [collectionIds, tool]);

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="font-syne text-xl text-tv-text mb-2">Tool not found</h2>
        <button onClick={() => navigate('/')} className="text-tv-primary text-sm hover:underline">← Back to Vault</button>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];
  const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return tool.url; } })();
  const summary = generateSummary(tool);

  const features: { label: string; present: boolean }[] = [
    { label: 'Free to use', present: tool.isFree },
    { label: 'No signup required', present: !tool.signupRequired },
    { label: 'Open source', present: tool.isOpenSource },
    ...tool.platforms.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), present: true })),
  ];

  const handleNotesBlur = () => {
    onUpdateNotes(tool.id, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(tool.url).catch((e) => console.error('[ToolDetailPage] copy URL failed:', e));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const card = 'bg-surface border border-tv-border rounded-xl overflow-hidden';
  const labelClass = 'text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2.5';

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* ─── Back nav ─── */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          {tool.savedToVault && (
            <button
              onClick={() => {
                if (!window.confirm('Remove this tool from your vault?')) return;
                onRemoveFromVault(tool.id);
                toast('Tool removed from vault', {
                  action: { label: 'Undo', onClick: () => onSave(tool.id) },
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-[13px] text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <Trash2 size={13} /> Remove From Vault
            </button>
          )}
          <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors">
            {copied ? <Check size={13} className="text-tv-primary" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors">
            <ExternalLink size={13} /> Visit
          </a>
        </div>
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex-[2] min-w-0 space-y-7">

          {/* 1. Tool Hero */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden border border-tv-border">
              {tool.favicon ? <img src={tool.favicon} className="w-9 h-9 object-contain" alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span className="text-2xl">{tool.icon}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-syne text-[32px] text-tv-text leading-tight">{tool.name}</h1>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                  {CATEGORY_LABELS[tool.category].toUpperCase()}
                </span>
                {healthStatus && <ToolHealthBadge status={healthStatus as any} />}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[12px] font-mono text-tv-text-m flex-wrap">
                <span>{domain}</span>
                <span className="text-tv-border">·</span>
                <span>Added {formatDistanceToNow(tool.addedAt, { addSuffix: true })}</span>
                {tool.addedByUsername && (
                  <>
                    <span className="text-tv-border">·</span>
                    <span>
                      by{' '}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/u/${tool.addedByUsername}`); }}
                        className="underline underline-offset-2 decoration-dotted hover:text-tv-primary transition-colors"
                      >
                        @{tool.addedByUsername}
                      </button>
                    </span>
                  </>
                )}
                {averageRating !== null && (
                  <>
                    <span className="text-tv-border">·</span>
                    <span className="flex items-center gap-1">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-[12px] ${s <= Math.round(averageRating) ? '' : 'opacity-20'}`} style={{ color: '#2D6A4F' }}>★</span>
                      ))}
                      <span style={{ color: '#2D6A4F' }}>{averageRating.toFixed(1)}</span>
                    </span>
                  </>
                )}
                {tool.lastVisited && (
                  <>
                    <span className="text-tv-border">·</span>
                    <span>Visited {formatDistanceToNow(tool.lastVisited, { addSuffix: true })}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onToggleFavorite(tool.id)}
                className="p-2 rounded-lg hover:bg-s2 text-tv-text-s hover:text-yellow-600 transition-colors"
              >
                <Star size={20} fill={tool.isFavorite ? 'currentColor' : 'none'} className={tool.isFavorite ? 'text-yellow-500' : ''} />
              </button>
            </div>
          </div>

          {/* 2. About */}
          <div>
            <div className="flex items-center justify-between">
              <p className={labelClass}>About</p>
              {isAdmin && (
                <button
                  onClick={async () => {
                    setRegenerating(true);
                    try {
                      await onRegenerateAiProfile?.(tool.id);
                    } finally {
                      setRegenerating(false);
                    }
                  }}
                  disabled={regenerating}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-tv-text-s hover:text-tv-primary border border-tv-border hover:border-tv-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate AI profile"
                >
                  {regenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {regenerating ? 'Generating AI Profile...' : 'Regenerate AI Profile'}
                </button>
              )}
            </div>
            {tool.aiSummary && (
              <p className="mt-1 text-[10px] font-mono text-tv-text-s">
                Generated previously
              </p>
            )}
            {isAdmin && (tool.aiProfileGeneratedAt || tool.aiProfileVersion) && (
              <div className="mt-1 text-[10px] font-mono text-tv-text-s space-y-0.5">
                {tool.aiProfileGeneratedAt && (
                  <p>Generated: {new Date(tool.aiProfileGeneratedAt).toISOString().replace('T', ' ').replace(/\.\d{3}Z/, ' UTC')}</p>
                )}
                {tool.aiProfileVersion && <p>v{tool.aiProfileVersion}</p>}
              </div>
            )}
            <p className="text-[15px] text-tv-text leading-relaxed">{tool.aiSummary || summary}</p>
          </div>

          {/* 3. Screenshot */}
          <div>
            <p className={labelClass}>Screenshots</p>
            <ToolScreenshot
              screenshotUrl={tool.screenshotUrl}
              ogImage={tool.ogImage}
              toolName={tool.name}
              toolIcon={tool.icon}
              canUpload={canUpload}
              toolUuid={tool._uuid}
              onUpdate={(url) => onUpdateScreenshot?.(tool.id, url)}
            />
          </div>

          {/* 4. Tags */}
          <div>
            <p className={labelClass}>
              Tags{(tool.tags?.length ?? 0) > 0 ? ` — ${tool.tags?.length}` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(tool.tags || []).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-s2 border border-tv-border rounded text-[11px] font-mono text-tv-text-s">
                  {tag}
                  <button onClick={() => onRemoveTag(tool.id, tag)} className="hover:text-tv-text transition-colors ml-0.5">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5"/></svg>
                  </button>
                </span>
              ))}
              <input
                onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { onAddTag(tool.id, (e.target as HTMLInputElement).value.trim().toLowerCase()); (e.target as HTMLInputElement).value = ''; } }}
                placeholder="+ Add tag"
                className="px-2 py-1 bg-transparent border border-dashed border-tv-border rounded text-[11px] font-mono text-tv-text-s placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary w-[90px]"
              />
            </div>
          </div>

          {/* 5. AI Chat */}
          <div className={card}>
            <div className="px-5 py-3.5 border-b border-tv-border bg-s2 flex items-center gap-2">
              <Sparkles size={13} className="text-tv-primary" />
              <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Ask ToolScribe AI</span>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[12px] text-tv-text-s font-mono leading-relaxed">Suggested prompts:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setChatInput(prompt); setChatResponse(null); setChatError(null); }}
                    className="px-3 py-1.5 rounded-lg border border-tv-border text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-primary transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {chatError && (
                <p role="alert" className="text-[12px] text-red-600 font-mono">{chatError}</p>
              )}
              {chatResponse && (
                <div className="bg-s2 border border-tv-border rounded-lg p-3.5 text-[13px] text-tv-text leading-relaxed">
                  <Markdown text={chatResponse} />
                </div>
              )}
              <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAsk(); }}
                  placeholder="Ask anything about this tool..."
                  className="flex-1 h-9 px-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                />
                <button
                  onClick={handleAsk}
                  disabled={chatLoading || !chatInput.trim()}
                  aria-label={chatLoading ? 'Asking…' : 'Ask'}
                  className="p-2 rounded-lg bg-tv-primary text-white disabled:opacity-40 hover:bg-tv-primary-dark transition-colors"
                >
                  {chatLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* 6. About This Tool (features) */}
          <div>
            <p className={labelClass}>About This Tool</p>
            <div className="grid grid-cols-2 gap-2">
              {features.map(f => {
                const Icon = FEATURE_ICONS[f.label] || Shield;
                return (
                  <div key={f.label} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-colors ${
                    f.present ? 'bg-surface border-tv-border' : 'bg-s2 border-tv-border opacity-40'
                  }`}>
                    <Icon size={14} className={f.present ? 'text-tv-primary' : 'text-tv-text-m'} />
                    <span className={`text-[12px] font-mono ${f.present ? 'text-tv-text' : 'text-tv-text-m'}`}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. Similar Tools */}
          {similarTools.length > 0 && (
            <div>
              <p className={labelClass}>Similar Tools</p>
              <div className="grid grid-cols-2 gap-3">
                {similarTools.map(t => {
                  const tc = CATEGORY_COLORS[t.category];
                  const tb = CATEGORY_BG[t.category];
                  const d = (() => { try { return new URL(t.url).hostname.replace('www.', ''); } catch { return ''; } })();
                  return (
                    <button key={t.id} onClick={() => navigate(`/tool/${t.id}`)}
                      className="flex items-start gap-3 p-3 bg-surface border border-tv-border rounded-xl text-left transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <div className="w-8 h-8 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {t.favicon ? <img src={t.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-sm">{t.icon}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-syne text-tv-text leading-tight truncate">{t.name}</p>
                        <p className="text-[10px] font-mono text-tv-text-m truncate">{d}</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium" style={{ color: tc, background: tb }}>
                          {CATEGORY_LABELS[t.category].toUpperCase()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="flex-[1] min-w-0 space-y-6">

          {/* 1. Saved In Collections */}
          {collections && collectionIds && onAddToCollection && (
            <div className={card}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-tv-border bg-s2">
                <span className={labelClass.replace('mb-2.5', 'mb-0')}>Saved In</span>
                <button onClick={onAddToCollection} className="flex items-center gap-1 text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors">
                  <FolderPlus size={12} /> Add
                </button>
              </div>
              <div className="p-5 space-y-2">
                {collections.filter(c => collectionIds.includes(c.id)).length === 0 ? (
                  <p className="text-[12px] text-tv-text-s font-mono">Not saved in any collection.</p>
                ) : (
                  collections.filter(c => collectionIds.includes(c.id)).map(col => (
                    <button key={col.id} onClick={() => navigate(`/collections/${col.id}`)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-s2 transition-colors text-left"
                    >
                      <Bookmark size={12} className="text-tv-primary flex-shrink-0" />
                      <span className="text-[13px] font-mono text-tv-text truncate">{col.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 2. Personal Notes */}
          <div className={card}>
            <div className="px-5 py-3.5 border-b border-tv-border bg-s2 flex items-center justify-between">
              <span className={labelClass.replace('mb-2.5', 'mb-0')}>Notes</span>
              {notesSaved && <span className="text-[10px] font-mono text-tv-primary">Saved</span>}
            </div>
            <div className="p-5">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="What do you think about this tool? How do you use it?"
                rows={5}
                className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none transition-colors"
              />
            </div>
          </div>

          {/* 3. Community Insights */}
          {reviewCount !== undefined && (
            <div className={card}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-tv-border bg-s2">
                <span className={labelClass.replace('mb-2.5', 'mb-0')}>
                  Community Insights{reviewCount > 0 ? ` — ${reviewCount}` : ''}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {myReview ? (
                  <ReviewForm
                    toolName={tool.name}
                    existingReview={myReview}
                    onSubmit={onSubmitReview!}
                    onDelete={onDeleteReview!}
                  />
                ) : onSubmitReview ? (
                  showReviewForm ? (
                    <ReviewForm
                      toolName={tool.name}
                      existingReview={null}
                      onSubmit={onSubmitReview}
                      onDelete={async () => true}
                      onClose={() => setShowReviewForm(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed border-tv-border text-[13px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-primary transition-colors"
                    >
                      <MessageSquare size={14} />
                      Write a review
                    </button>
                  )
                ) : null}

                {reviews && reviews.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {reviews.slice(0, 4).map(r => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                  </div>
                )}

                {!myReview && !onSubmitReview && reviewCount === 0 && (
                  <p className="text-[12px] font-mono text-tv-text-s">No reviews yet. Be the first to share your experience.</p>
                )}
              </div>
            </div>
          )}

          {/* 4. Activity Timeline */}
          <div className={card}>
            <div className="px-5 py-3.5 border-b border-tv-border bg-s2">
              <span className={labelClass.replace('mb-2.5', 'mb-0')}>Activity</span>
            </div>
            <div className="p-5">
              {activities.length === 0 ? (
                <p className="text-[12px] text-tv-text-s font-mono">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a, i) => {
                    const Icon = a.type === 'added' ? Plus : a.type === 'collected' ? Bookmark : Clock;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-tv-primary-g flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={11} className="text-tv-primary" />
                        </div>
                        <div>
                          <p className="text-[13px] font-mono text-tv-text">{a.label}</p>
                          <p className="text-[10px] font-mono text-tv-text-m">{formatDistanceToNow(a.timestamp, { addSuffix: true })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ─── BOTTOM: Write Review CTA ─── */}
      {!myReview && onSubmitReview && !showReviewForm && (
        <div className="mt-10 p-8 rounded-2xl border-2 border-tv-border bg-surface text-center">
          <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2">Community</p>
          <h3 className="font-syne text-[24px] text-tv-text leading-tight mb-2">
            Share your <em className="not-italic text-tv-primary">experience.</em>
          </h3>
          <p className="text-[13px] text-tv-text-s font-mono max-w-sm mx-auto mb-4">
            Help others decide. Write a short review about what {tool.name} is best for, what gotchas to watch out for, and what the free tier looks like.
          </p>
          <button
            onClick={() => setShowReviewForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
          >
            <MessageSquare size={14} />
            Write a review
          </button>
        </div>
      )}
    </div>
  );
}
