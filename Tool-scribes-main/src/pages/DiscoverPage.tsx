import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, BookmarkPlus, BookmarkCheck, ExternalLink, Plus, ArrowRight, Sparkles, TrendingUp, Grid3X3, Layers, Code, Palette, Zap, BookOpen, Wrench, Clock, GitBranch } from 'lucide-react';
import { Tool, ToolCategory, Collection, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT, CATEGORY_EMOJIS } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useTags } from '@/lib/tags';
import { buildVaultRecs } from '@/lib/recommendations';
import type { RecItem } from '@/lib/recommendations';
import { fetchPopularAlternatives } from '@/lib/alternatives';
import { hashId } from '@/lib/hashId';
import ToolScreenshot from '@/components/ToolScreenshot';

interface DiscoverPageProps {
  tools: Tool[];
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
  onAddTool: () => void;
  loading: boolean;
}

type SortMode = 'newest' | 'upvotes' | 'alpha';

const ALL_CATEGORIES: { key: ToolCategory; icon: typeof Code; label: string; desc: string }[] = [
  { key: 'ai', icon: Sparkles, label: 'AI', desc: 'Artificial intelligence tools' },
  { key: 'dev', icon: Code, label: 'Developer', desc: 'Dev tools & APIs' },
  { key: 'design', icon: Palette, label: 'Design', desc: 'Design & creative tools' },
  { key: 'prod', icon: Zap, label: 'Productivity', desc: 'Get more done' },
  { key: 'learn', icon: BookOpen, label: 'Learning', desc: 'Courses & knowledge' },
  { key: 'util', icon: Wrench, label: 'Utilities', desc: 'Everyday useful tools' },
];

export default function DiscoverPage({ tools, onUpvote, onSave, onAddTool, loading }: DiscoverPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tags } = useTags();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [publicCollections, setPublicCollections] = useState<(Collection & { _uuid: string; followerCount?: number; curatorUsername?: string })[]>([]);
  const [trendingCollections, setTrendingCollections] = useState<(Collection & { _uuid: string; followerCount?: number; curatorUsername?: string })[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<number, number>>({});
  const [vaultRecs, setVaultRecs] = useState<RecItem[]>([]);
  const [vaultRecsLoading, setVaultRecsLoading] = useState(false);
  const [popularAlts, setPopularAlts] = useState<{ toolId: string; toolName: string; toolIcon: string; toolFavicon: string; alternatives: { id: string; name: string; votes: number }[] }[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    fetchPopularAlternatives(6).then(items => { if (mountedRef.current) setPopularAlts(items); }).catch((e) => console.error('[DiscoverPage] fetch popular alternatives failed:', e));
  }, []);

  useEffect(() => {
    if (user && !loading) {
      setVaultRecsLoading(true);
      buildVaultRecs(user.id, 6).then(items => {
        if (mountedRef.current) setVaultRecs(items);
      }).catch((e) => console.error('[DiscoverPage] build vault recommendations failed:', e)).finally(() => { if (mountedRef.current) setVaultRecsLoading(false); });
    }
  }, [user?.id, loading]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Fetch public collections
    supabase
      .from('collections')
      .select('*, collection_tools(count)')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!data || !mountedRef.current) return;
        const colIds = data.map(r => (r as Record<string, unknown>).id as string);
        const mapped: (Collection & { _uuid: string })[] = (data as Array<Record<string, unknown>>).map(r => {
          const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
          const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
          return {
            id: hashId(r.id as string),
            _uuid: r.id as string,
            name: r.name as string,
            description: (r.description as string) ?? '',
            isPublic: true,
            toolCount: countVal,
            createdAt: new Date(r.created_at as string).getTime(),
            updatedAt: new Date(r.updated_at as string).getTime(),
          };
        });
        if (mountedRef.current) setPublicCollections(mapped);
        // Fetch follower counts for trending
        if (colIds.length > 0) {
          supabase.from('collection_followers').select('collection_id').in('collection_id', colIds)
            .then(({ data: fData }) => {
              if (!mountedRef.current) return;
              const fMap = new Map<string, number>();
              for (const f of (fData ?? []) as Array<{ collection_id: string }>) {
                fMap.set(f.collection_id, (fMap.get(f.collection_id) || 0) + 1);
              }
              const now = Date.now();
              const scored = mapped.map(c => {
                const hoursSinceUpdate = (now - c.updatedAt) / 3600000;
                const score = (fMap.get(c._uuid) ?? 0) * 3 + (1 / (hoursSinceUpdate + 2)) * 100;
                return { ...c, followerCount: fMap.get(c._uuid) ?? 0, _score: score };
              }).sort((a, b) => b._score - a._score).slice(0, 5);
              if (mountedRef.current) setTrendingCollections(scored);
            })
            .catch((e) => console.error('[DiscoverPage] fetch collection follower counts failed:', e));
        }
      })
      .catch((e) => console.error('[DiscoverPage] fetch public collections failed:', e));
    // Fetch save counts
    supabase
      .from('vault_items')
      .select('tool_id')
      .then(({ data }) => {
        if (!data || !mountedRef.current) return;
        const counts: Record<string, number> = {};
        for (const row of data as Array<{ tool_id: string }>) {
          counts[row.tool_id] = (counts[row.tool_id] || 0) + 1;
        }
        const byNumId: Record<number, number> = {};
        for (const tool of tools) {
          if (tool._uuid && counts[tool._uuid]) byNumId[tool.id] = counts[tool._uuid];
        }
        if (mountedRef.current) setSaveCounts(byNumId);
      })
      .catch((e) => console.error('[DiscoverPage] fetch save counts failed:', e));
  }, []);

  // Trending score: (upvotes * 3 + saves * 2) / (hours_since_added + 2)^1.5
  const trendingScores = useMemo(() => {
    const now = Date.now();
    const scores = new Map<number, number>();
    for (const t of tools) {
      const hoursSinceAdded = (now - t.addedAt) / 3600000;
      const saves = saveCounts[t.id] || 0;
      const score = (t.upvotes * 3 + saves * 2) / Math.pow(hoursSinceAdded + 2, 1.5);
      scores.set(t.id, score);
    }
    return scores;
  }, [tools, saveCounts]);

  const sortedByTrending = useMemo(() => {
    return [...tools].sort((a, b) => (trendingScores.get(b.id) || 0) - (trendingScores.get(a.id) || 0));
  }, [tools, trendingScores]);

  const trending = useMemo(() => {
    return sortedByTrending.filter(t => (trendingScores.get(t.id) || 0) > 0).slice(0, 8);
  }, [sortedByTrending, trendingScores]);

  const trendingIds = useMemo(() => new Set(trending.map(t => t.id)), [trending]);

  const rising = useMemo(() => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 3600000;
    return sortedByTrending
      .filter(t => !trendingIds.has(t.id) && t.addedAt > twoWeeksAgo && (trendingScores.get(t.id) || 0) > 0)
      .slice(0, 8);
  }, [sortedByTrending, trendingIds, trendingScores]);

  const risingIds = useMemo(() => new Set(rising.map(t => t.id)), [rising]);

  const newest = useMemo(() => {
    return [...tools]
      .sort((a, b) => b.addedAt - a.addedAt)
      .filter(t => !trendingIds.has(t.id) && !risingIds.has(t.id))
      .slice(0, 8);
  }, [tools, trendingIds, risingIds]);

  const featured = sortedByTrending[0] ?? null;

  const filtered = useMemo(() => {
    let result = [...tools];
    if (activeCategory) result = result.filter(t => t.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    if (sortMode === 'upvotes') result.sort((a, b) => b.upvotes - a.upvotes);
    else if (sortMode === 'alpha') result.sort((a, b) => a.name.localeCompare(b.name));
    else result.sort((a, b) => b.addedAt - a.addedAt);
    return result;
  }, [tools, activeCategory, search, sortMode]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) counts[t.category] = (counts[t.category] || 0) + 1;
    return counts;
  }, [tools]);

  const popularTags = tags.filter(t => t.toolCount > 0).slice(0, 6);

  const sectionDelay = 0.08;

  if (!loading && tools.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Community</p>
        <h3 className="font-syne text-[32px] text-tv-text mb-3 leading-tight">
          Nothing here <em className="not-italic text-tv-primary">yet.</em>
        </h3>
        <p className="text-[14px] text-tv-text-s mb-8 max-w-sm leading-relaxed">
          Be the first to submit a tool to the community.
        </p>
        <button onClick={onAddTool} className="flex items-center gap-1.5 px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors">
          <Plus size={14} /> Submit a tool
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pb-24">
      {/* ──────────────── 1. Hero ──────────────── */}
      <Section delay={0}>
        <div className="pt-12 pb-10 border-b border-tv-border">
          <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Discover</p>
          <h1 className="font-syne text-[48px] sm:text-[56px] text-tv-text leading-[1.05] tracking-tight">
            Tools worth <em className="not-italic text-tv-primary">saving.</em>
          </h1>
          <p className="text-[15px] text-tv-text-s mt-3 max-w-lg leading-relaxed">
            A curated collection of the best software tools — from AI to productivity. Built by the community, for the community.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search all tools..."
              className="w-full pl-11 pr-4 py-3 bg-s2 border-2 border-tv-border rounded-xl text-[15px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
            />
          </div>

          {/* Popular tags */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[11px] font-mono text-tv-text-m">Popular:</span>
              {popularTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => navigate(`/tag/${tag.slug}`)}
                  className="px-2.5 py-1 rounded-lg border border-tv-border text-[11px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors"
                  style={{ color: tag.color, borderColor: `${tag.color}40` }}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ──────────────── 2. Recommended For You ──────────────── */}
      {user && vaultRecs.length > 0 && (
        <Section delay={sectionDelay}>
          <SectionLabel icon={Sparkles}>Recommended For You</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
            {vaultRecs.map((item, i) => {
              const catBg = CATEGORY_BG[item.category as keyof typeof CATEGORY_BG];
              const catColor = CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS];
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${item.id}`)}
                  className="flex-shrink-0 w-52 flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.favicon ? <img src={item.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{item.icon}</span>}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] font-syne text-tv-text truncate">{item.name}</p>
                    <p className="text-[11px] text-tv-text-s font-mono mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                      {CATEGORY_SHORT[item.category as keyof typeof CATEGORY_SHORT]?.toUpperCase() || item.category.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono text-tv-text-m italic">{item.reason}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ──────────────── 3. Featured Tool ──────────────── */}
      {featured && (
        <Section delay={sectionDelay * 2}>
          <SectionLabel>Featured Tool</SectionLabel>
          <FeaturedCard tool={featured} onSave={onSave} user={!!user} />
        </Section>
      )}

      {/* ──────────────── 4. Trending Tools ──────────────── */}
      {trending.length > 0 && (
        <Section delay={sectionDelay * 3}>
          <SectionLabel icon={TrendingUp}>Trending</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
            {trending.map((tool, i) => {
              const catBg = CATEGORY_BG[tool.category];
              const catColor = CATEGORY_COLORS[tool.category];
              const score = trendingScores.get(tool.id) || 0;
              return (
                <motion.button
                  key={tool.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${tool.id}`)}
                  className="flex-shrink-0 w-52 flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {tool.favicon ? <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{tool.icon}</span>}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] font-syne text-tv-text truncate">{tool.name}</p>
                    <p className="text-[11px] text-tv-text-s font-mono mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                      {CATEGORY_SHORT[tool.category].toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: '#5a5a5a' }}>
                      {tool.upvotes} ▲
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ──────────────── 5. Rising Tools ──────────────── */}
      {rising.length > 0 && (
        <Section delay={sectionDelay * 4}>
          <SectionLabel icon={Zap}>Rising</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
            {rising.map((tool, i) => {
              const catBg = CATEGORY_BG[tool.category];
              const catColor = CATEGORY_COLORS[tool.category];
              return (
                <motion.button
                  key={tool.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${tool.id}`)}
                  className="flex-shrink-0 w-52 flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {tool.favicon ? <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{tool.icon}</span>}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] font-syne text-tv-text truncate">{tool.name}</p>
                    <p className="text-[11px] text-tv-text-s font-mono mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                      {CATEGORY_SHORT[tool.category].toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: '#5a5a5a' }}>
                      Added {formatDistanceToNow(tool.addedAt, { addSuffix: true })}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ──────────────── 6. New Tools ──────────────── */}
      {newest.length > 0 && (
        <Section delay={sectionDelay * 5}>
          <SectionLabel icon={Clock}>New</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
            {newest.map((tool, i) => {
              const catBg = CATEGORY_BG[tool.category];
              const catColor = CATEGORY_COLORS[tool.category];
              return (
                <motion.button
                  key={tool.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${tool.id}`)}
                  className="flex-shrink-0 w-52 flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {tool.favicon ? <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{tool.icon}</span>}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] font-syne text-tv-text truncate">{tool.name}</p>
                    <p className="text-[11px] text-tv-text-s font-mono mt-0.5 line-clamp-2 leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
                      {CATEGORY_SHORT[tool.category].toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: '#5a5a5a' }}>
                      Added {formatDistanceToNow(tool.addedAt, { addSuffix: true })}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ──────────────── 7. Trending Collections ──────────────── */}
      {trendingCollections.length > 0 && (
        <Section delay={sectionDelay * 6}>
          <div className="flex items-center justify-between mb-5">
            <SectionLabel icon={Layers}>Trending Collections</SectionLabel>
            <button
              onClick={() => navigate('/collections')}
              className="flex items-center gap-1 text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
            >
              View All Collections <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingCollections.map((col, i) => (
              <motion.button
                key={col._uuid}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => navigate(`/c/${col._uuid}`)}
                className="flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
              >
                <div className="w-10 h-10 rounded-xl bg-tv-primary-g flex items-center justify-center">
                  <Layers size={18} className="text-tv-primary" />
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-syne text-[15px] text-tv-text leading-tight truncate">{col.name}</h3>
                  {col.description && <p className="text-[11px] text-tv-text-s mt-0.5 line-clamp-2 leading-relaxed font-mono">{col.description}</p>}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-tv-text-m">
                  <span>{col.toolCount} tool{col.toolCount !== 1 ? 's' : ''}</span>
                  {(col as Record<string, unknown>).followerCount !== undefined && (
                    <>
                      <span className="text-tv-border">·</span>
                      <span>{(col as Record<string, unknown>).followerCount as number} followers</span>
                    </>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </Section>
      )}

      {/* ──────────────── 8. Browse Categories ──────────────── */}
      <Section delay={sectionDelay * 7}>
        <SectionLabel icon={Grid3X3}>Browse Categories</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ALL_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.key] ?? 0;
            const color = CATEGORY_COLORS[cat.key];
            const bg = CATEGORY_BG[cat.key];
            const isActive = activeCategory === cat.key;
            return (
              <motion.button
                key={cat.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                onClick={() => setActiveCategory(isActive ? null : cat.key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? 'border-tv-primary bg-tv-primary-g -translate-y-0.5'
                    : 'border-tv-border bg-surface hover:-translate-y-0.5 hover:shadow-soft'
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-syne font-medium text-tv-text leading-tight">{cat.label}</p>
                  <p className="text-[10px] font-mono text-tv-text-m mt-0.5">{count} tool{count !== 1 ? 's' : ''}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </Section>

      {/* ──────────────── 9. Popular Alternatives ──────────────── */}
      {popularAlts.length > 0 && (
        <Section delay={sectionDelay * 8}>
          <SectionLabel icon={GitBranch}>Popular Alternatives</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularAlts.map((pa, i) => (
              <motion.div
                key={pa.toolId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="p-4 bg-surface border-2 border-tv-border rounded-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {pa.toolFavicon ? <img src={pa.toolFavicon} className="w-4 h-4 object-contain" alt="" /> : <span className="text-xs">{pa.toolIcon}</span>}
                  </div>
                  <span className="font-syne text-[14px] text-tv-text">{pa.toolName}</span>
                </div>
                <div className="space-y-1.5">
                  {pa.alternatives.map(alt => (
                    <div key={alt.id} className="flex items-center justify-between text-[12px] font-mono text-tv-text-s">
                      <span>{alt.name}</span>
                      <span style={{ color: '#2D6A4F' }}>👍 {alt.votes}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* ──────────────── 10. All Tools ──────────────── */}
      <Section delay={sectionDelay * 9}>
        <SectionLabel icon={ArrowRight}>All Tools</SectionLabel>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter tools..."
              className="w-full pl-10 pr-4 py-2 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="px-3 py-2 bg-surface border border-tv-border rounded-lg text-[12px] font-mono text-tv-text focus:outline-none focus:border-tv-primary transition-colors"
            >
              <option value="newest">Newest</option>
              <option value="upvotes">Most upvoted</option>
              <option value="alpha">A–Z</option>
            </select>
            {activeCategory && (
              <button onClick={() => setActiveCategory(null)} className="px-3 py-2 text-[12px] font-mono text-tv-text-s hover:text-tv-text border border-tv-border rounded-lg transition-colors">
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Tool grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 bg-s2 border-2 border-tv-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-[14px] text-tv-text-s font-mono">No tools match your filters.</p>
            <button onClick={() => { setSearch(''); setActiveCategory(null); }} className="mt-3 text-[13px] text-tv-primary hover:underline font-mono">
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tool, i) => (
              <AllToolsCard key={tool.id} tool={tool} index={i} onUpvote={onUpvote} onSave={onSave} />
            ))}
          </div>
        )}
      </Section>

      {/* ──────────────── 10. Submit Tool CTA ──────────────── */}
      <Section delay={sectionDelay * 10}>
        <div className="relative overflow-hidden rounded-2xl border-2 border-tv-border bg-surface p-8 sm:p-12 text-center">
          <div className="absolute top-0 right-0 w-48 h-48 bg-tv-primary-g rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-3">Community</p>
            <h2 className="font-syne text-[32px] sm:text-[40px] text-tv-text leading-tight">
              Know a tool we're <em className="not-italic text-tv-primary">missing?</em>
            </h2>
            <p className="text-[14px] text-tv-text-s mt-2 max-w-md mx-auto leading-relaxed">
              Help grow the collection. Submit your favorite tools and share them with the community.
            </p>
            <button
              onClick={onAddTool}
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
            >
              <Plus size={15} />
              Submit a tool
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─── Sub-components ─── */

function Section({ children, delay }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay }}
      className="py-8 border-b border-tv-border last:border-b-0"
    >
      {children}
    </motion.section>
  );
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Sparkles }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {Icon && <Icon size={12} className="text-tv-text-m" />}
      <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">{children}</span>
    </div>
  );
}

function FeaturedCard({ tool, onSave, user }: { tool: Tool; onSave: (id: number) => void; user: boolean }) {
  const navigate = useNavigate();
  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];
  const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return ''; } })();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => navigate(`/tool/${tool.id}`)}
      className="group relative flex flex-col sm:flex-row overflow-hidden rounded-xl border-2 border-tv-border bg-surface cursor-pointer transition-all duration-200 hover:shadow-card"
    >
      {/* Image side */}
      <div className="sm:w-[280px] lg:w-[380px] h-[200px] sm:h-auto bg-s2 flex-shrink-0 overflow-hidden">
        <ToolScreenshot
          screenshotUrl={tool.screenshotUrl}
          ogImage={tool.ogImage}
          toolName={tool.name}
          toolIcon={tool.icon}
          className="w-full h-full"
        />
      </div>

      {/* Content side */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
            {tool.favicon ? <img src={tool.favicon} className="w-6 h-6 object-contain" alt="" /> : <span className="text-xl">{tool.icon}</span>}
          </div>
          <div>
            <h3 className="font-syne text-[22px] text-tv-text leading-tight">{tool.name}</h3>
            {domain && <p className="text-[12px] font-mono text-tv-text-m">{domain}</p>}
          </div>
        </div>
        <p className="text-[14px] text-tv-text-s leading-relaxed line-clamp-2 mb-4">{tool.description}</p>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded text-[11px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
            {CATEGORY_LABELS[tool.category]}
          </span>
          <span className="text-[11px] font-mono text-tv-text-m">{tool.upvotes} upvote{tool.upvotes !== 1 ? 's' : ''}</span>
          {tool.addedByUsername && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/u/${tool.addedByUsername}`); }}
              className="text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
            >
              Added by <span className="underline underline-offset-2 decoration-dotted">@{tool.addedByUsername}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-4" onClick={e => e.stopPropagation()}>
          {user && (
            <button
              onClick={() => onSave(tool.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                tool.savedToVault
                  ? 'bg-tv-primary-g border-tv-primary text-tv-primary'
                  : 'border-tv-border text-tv-text-s hover:border-tv-primary hover:text-tv-primary'
              }`}
            >
              {tool.savedToVault ? <BookmarkCheck size={13} /> : <BookmarkPlus size={13} />}
              {tool.savedToVault ? 'Saved' : 'Save'}
            </button>
          )}
          <a href={tool.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-tv-border text-[12px] font-mono text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors"
          >
            <ExternalLink size={13} />
            Visit
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function AllToolsCard({ tool, index, onUpvote, onSave }: { tool: Tool; index: number; onUpvote: (id: number) => void; onSave: (id: number) => void }) {
  const navigate = useNavigate();
  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];
  const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return ''; } })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      onClick={() => navigate(`/tool/${tool.id}`)}
      className="group flex flex-col bg-surface border-2 border-tv-border rounded-xl cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal overflow-hidden"
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
          {tool.favicon ? <img src={tool.favicon} className="w-5.5 h-5.5 object-contain" alt="" /> : <span className="text-base">{tool.icon}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-syne text-[14px] text-tv-text leading-snug truncate">{tool.name}</h3>
          </div>
          {domain && <p className="text-[10px] font-mono text-tv-text-m truncate">{domain}</p>}
          {tool.addedByUsername && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/u/${tool.addedByUsername}`); }}
              className="text-[9px] font-mono text-tv-text-s hover:text-tv-primary transition-colors mt-0.5"
            >
              Added by @{tool.addedByUsername}
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pb-2 flex-1">
        <p className="text-[11px] text-tv-text-s leading-relaxed line-clamp-2">{tool.description}</p>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ color: catColor, background: catBg }}>
          {CATEGORY_SHORT[tool.category].toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onUpvote(tool.id); }}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
              tool.upvotedByMe ? 'text-tv-primary' : 'text-tv-text-s hover:text-tv-primary'
            }`}
          >
            <ArrowUp size={11} />
            {tool.upvotes}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSave(tool.id); }}
            className={`p-1 rounded transition-colors ${
              tool.savedToVault ? 'text-tv-primary' : 'text-tv-text-s hover:text-tv-primary'
            }`}
          >
            {tool.savedToVault ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
