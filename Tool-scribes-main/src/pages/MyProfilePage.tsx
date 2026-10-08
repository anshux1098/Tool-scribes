import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bookmark, Wrench, PenLine, Quote, Settings, MapPin,
  Globe, Calendar, ExternalLink, Eye, Github, Twitter, Linkedin
} from 'lucide-react';
import { Tool, Collection, Review, CATEGORY_LABELS } from '@/lib/types';
import { supabase, ReviewRow } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useProfile';
import { formatDistanceToNow } from 'date-fns';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import CuratorBadge from '@/components/CuratorBadge';
import { hashId } from '@/lib/hashId';
import { SEO } from '@/components/SEO';

function collectionCoverGradient(name: string): string {
  const colors = [
    ['#3A6B52', '#2D5540'], ['#B45309', '#92400E'], ['#1D4ED8', '#1E40AF'],
    ['#7E22CE', '#6B21A8'], ['#2D6A4F', '#1B4332'], ['#92400E', '#78350F'],
    ['#374151', '#1F2937'], ['#0F766E', '#115E59'], ['#A21CAF', '#86198F'],
    ['#B91C1C', '#991B1B'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const pair = colors[Math.abs(h) % colors.length];
  return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
}

export default function MyProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useCurrentProfile();

  const [collections, setCollections] = useState<(Collection & { _uuid: string })[]>([]);
  const [reviews, setReviews] = useState<{ review: Review; toolName: string; toolIcon: string; toolId: number }[]>([]);
  const [submittedTools, setSubmittedTools] = useState<Tool[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [featuredToolIcons, setFeaturedToolIcons] = useState<{ icon: string; name: string }[]>([]);
  const [latestTool, setLatestTool] = useState<{ id: string; name: string; screenshotUrl: string; ogImage: string; favicon: string } | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoadingData(false); return; }

    Promise.all([
      supabase
        .from('collections')
        .select('*, collection_tools(count)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('tools')
        .select('*')
        .eq('added_by', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]).then(([colRes, toolsRes, reviewsRes]) => {
      const mappedCols: (Collection & { _uuid: string })[] = (colRes.data ?? []).map((r: Record<string, unknown>) => {
        const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
        const ctCount = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
        const id = r.id as string;
        return {
          id: hashId(id),
          _uuid: id,
          name: r.name as string,
          description: (r.description as string) ?? '',
          isPublic: r.is_public as boolean,
          toolCount: ctCount,
          createdAt: new Date(r.created_at as string).getTime(),
          updatedAt: new Date(r.updated_at as string).getTime(),
          coverImageUrl: (r.cover_image_url as string) || undefined,
        };
      });
      setCollections(mappedCols);

      const mappedTools: Tool[] = (toolsRes.data ?? []).map((row: Record<string, unknown>) => ({
        id: hashId(row.id as string),
        _uuid: row.id as string,
        name: (row.name as string) ?? '',
        url: (row.url as string) ?? '',
        description: (row.description as string) ?? '',
        category: (row.category as Tool['category']) ?? 'util',
        icon: (row.icon as string) ?? '🔧',
        favicon: (row.favicon as string) ?? '',
        ogImage: (row.og_image as string) ?? '',
        screenshotUrl: (row.screenshot_url as string) ?? '',
        upvotes: (row.upvotes as number) ?? 0,
        priceModel: (row.price_model as Tool['priceModel']) ?? 'free',
        isOpenSource: (row.is_open_source as boolean) ?? false,
        requiresLogin: (row.requires_login as boolean) ?? false,
        isFree: (row.is_free as boolean) ?? true,
        platforms: (row.platforms as string[]) ?? ['web'],
        signupRequired: (row.signup_required as boolean) ?? false,
        upvotedByMe: false,
        savedToVault: false,
        isFavorite: false,
        addedAt: new Date(row.created_at as string).getTime(),
      }));
      setSubmittedTools(mappedTools);

      const toolData = toolsRes.data ?? [];
      setLatestTool(toolData.length > 0 ? {
        id: toolData[0].id as string,
        name: (toolData[0].name as string) || 'Unknown',
        screenshotUrl: (toolData[0].screenshot_url as string) || '',
        ogImage: (toolData[0].og_image as string) || '',
        favicon: (toolData[0].favicon as string) || '',
      } : null);

      const reviewRows = (reviewsRes?.data ?? []) as ReviewRow[];
      if (reviewRows.length > 0) {
        const toolIds = [...new Set(reviewRows.map(r => r.tool_id))];
        void Promise.resolve(
          supabase
            .from('tools')
            .select('id, name, icon')
            .in('id', toolIds)
        )
          .then(({ data: toolData }) => {
            const toolMap = new Map((toolData ?? []).map(t => [t.id as string, { name: t.name as string, icon: t.icon as string }]));
            const mappedReviews = reviewRows.map(r => {
              const toolInfo = toolMap.get(r.tool_id);
              return {
                review: {
                  id: hashId(r.id),
                  _uuid: r.id,
                  toolId: r.tool_id,
                  userId: r.user_id,
                  authorDisplayName: profile?.displayName || profile?.username || 'Anonymous',
                  authorUsername: profile?.username ?? null,
                  bestFor: r.best_for,
                  gotcha: r.gotcha,
                  freeTier: r.free_tier,
                  rating: r.rating,
                  isMine: true,
                  moderationStatus: r.moderation_status,
                  createdAt: new Date(r.created_at).getTime(),
                  updatedAt: new Date(r.updated_at).getTime(),
                },
                toolName: toolInfo?.name ?? 'Unknown tool',
                toolIcon: toolInfo?.icon ?? '🔧',
                toolId: toolInfo ? hashId(r.tool_id) : 0,
              };
            });
            setReviews(mappedReviews);
          })
          .catch((e) => console.error('[MyProfilePage] fetch reviews failed:', e));
      }
      setLoadingData(false);
    }).catch((e) => {
      console.error('[MyProfilePage] load profile data failed:', e);
      setLoadingData(false);
    });
  }, [userId, authLoading, profile]);

  const featuredCollection = collections[0] ?? null;

  useEffect(() => {
    if (!featuredCollection?._uuid) { setFeaturedToolIcons([]); return; }
    void Promise.resolve(
      supabase
        .from('collection_tools')
        .select('tools(id, name, icon)')
        .eq('collection_id', featuredCollection._uuid)
    )
      .then(({ data }) => {
        const icons = (data ?? []).map((r: Record<string, unknown>) => {
          const tool = r.tools as { name: string; icon: string } | null;
          return { icon: tool?.icon ?? '🔧', name: tool?.name ?? 'Tool' };
        });
        setFeaturedToolIcons(icons);
      })
      .catch(() => setFeaturedToolIcons([]));
  }, [featuredCollection?._uuid]);

  const loading = authLoading || profileLoading || loadingData;

  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of submittedTools) {
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => ({ key: cat, label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat }));
  }, [submittedTools]);

  const latestActivity = useMemo(() => {
    const items: { type: 'published' | 'reviewed' | 'added'; label: string; target?: string; date: Date }[] = [];
    for (const c of collections.slice(0, 3)) {
      items.push({ type: 'published', label: c.name, target: `/c/${c._uuid}`, date: new Date(c.updatedAt) });
    }
    for (const r of reviews.slice(0, 3)) {
      items.push({ type: 'reviewed', label: r.toolName, target: `/tool/${r.toolId}`, date: new Date(r.review.createdAt) });
    }
    for (const t of submittedTools.slice(0, 3)) {
      items.push({ type: 'added', label: t.name, date: new Date(t.addedAt) });
    }
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.slice(0, 6);
  }, [collections, reviews, submittedTools]);

  const whyFollowStatements = useMemo(() => {
    const statements: string[] = [];
    const catCount = new Map<string, number>();
    for (const t of submittedTools) catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1);
    const top = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    for (const [cat] of top) {
      const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat;
      statements.push(`Discovers ${label.toLowerCase()} tools`);
    }
    if (reviews.length > 0) statements.push('Shares honest reviews with real insights');
    if (collections.length > 0) statements.push('Publishes curated collections worth exploring');
    if (top.length > 1) statements.push('Curates across multiple categories');
    return statements;
  }, [submittedTools, reviews, collections]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[14px] text-tv-text-m font-mono">Sign in to view your profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-tv-border border-t-tv-primary rounded-full animate-spin" />
          <span className="text-[12px] font-mono text-tv-text-m">Loading profile...</span>
        </div>
      </div>
    );
  }

  const displayName = profile?.displayName || profile?.username || 'Your Profile';
  const username = profile?.username || '';
  const bio = profile?.bio || '';
  const avatarUrl = profile?.avatarUrl || '';
  const bannerUrl = profile?.bannerUrl || '';
  const tagline = profile?.tagline || 'Curating tools worth sharing.';
  const location = profile?.location || '';
  const website = profile?.website || '';
  const github = profile?.github || '';
  const twitter = profile?.twitter || '';
  const linkedin = profile?.linkedin || '';
  const visibleCollections = profile?.showCollections !== false;
  const visibleReviews = profile?.showReviews !== false;
  const visibleFollowers = profile?.showFollowers !== false;

  return (
    <>
      <SEO title="My Profile" description="Your personal profile on Tool Scribe." path="/profile" type="profile" />
    <div className="min-h-screen bg-bg">

      {/* ─── Top bar ─── */}
      <div className="sticky top-0 z-10 bg-bg/90 border-b border-tv-border" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1400px] mx-auto px-12 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text transition-colors">
            <Settings size={13} /> Edit Profile
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-12 pb-24">

        {/* ─── Banner ─── */}
        {bannerUrl && (
          <div className="w-full h-48 overflow-hidden rounded-xl mb-8 mt-4">
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}

        {/* ═══════════════════════ HERO ═══════════════════════ */}
        <section className="pt-16 pb-14">
          <div className="flex flex-row items-start gap-12">

            {/* Left column - 260px */}
            <div className="w-[260px] flex-shrink-0">
              <div className="w-[140px] h-[140px] mb-5">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover border-2 border-white shadow-brutal" />
                ) : (
                  <div className="w-full h-full rounded-full bg-tv-primary text-white text-[56px] font-syne font-bold flex items-center justify-center shadow-brutal">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {username && <p className="text-[14px] font-mono text-tv-text-m">@{username}</p>}
                {profile?.curatorBadge && profile.curatorBadge !== 'none' && (
                  <CuratorBadge badge={profile.curatorBadge} size="sm" />
                )}
              </div>
              {location && (
                <p className="text-[12px] font-mono text-tv-text-s flex items-center gap-1.5 mb-2">
                  <MapPin size={12} /> {location}
                </p>
              )}
              {website && (
                <p className="text-[12px] font-mono text-tv-text-s flex items-center gap-1.5 mb-2">
                  <Globe size={12} />
                  <a href={`https://${website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="text-tv-primary hover:underline">{website.replace(/^https?:\/\//, '')}</a>
                </p>
              )}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {github && (
                  <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-s2 transition-colors" style={{ color: '#5a5a5a' }}>
                    <Github size={14} />
                  </a>
                )}
                {twitter && (
                  <a href={`https://twitter.com/${twitter}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-s2 transition-colors" style={{ color: '#5a5a5a' }}>
                    <Twitter size={14} />
                  </a>
                )}
                {linkedin && (
                  <a href={`https://linkedin.com/in/${linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-s2 transition-colors" style={{ color: '#5a5a5a' }}>
                    <Linkedin size={14} />
                  </a>
                )}
              </div>
              <p className="text-[12px] font-mono text-tv-text-s flex items-center gap-1.5 mb-6">
                <Calendar size={12} /> {(() => {
                  const d = profile?.createdAt ? new Date(profile.createdAt) : null;
                  if (!d || isNaN(d.getTime()) || d.getTime() < new Date('2020-01-01').getTime()) {
                    return 'Recently joined';
                  }
                  return `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                })()}
              </p>
              <div className="flex items-center gap-2">
                <button className="bg-tv-primary text-white rounded-lg text-[12px] font-medium hover:bg-tv-primary-dark transition-all duration-150 px-5 py-2.5">
                  Follow
                </button>
                <button className="px-5 py-2.5 border border-tv-border rounded-lg text-[12px] text-tv-text-s hover:text-tv-text transition-colors">
                  Message
                </button>
              </div>
            </div>

            {/* Center column - flex-1 */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-syne text-[64px] font-bold text-tv-text leading-[1.05] tracking-tight mb-4">
                {displayName}
              </h1>
              <p className="text-[28px] text-tv-primary font-syne leading-[1.2] mb-6">
                {tagline}
              </p>
              <div className="max-w-xl">
                <Quote size={20} className="text-tv-primary/20 mb-2" />
                <p className="font-syne text-[20px] text-tv-text leading-[1.4] italic pl-5 border-l-2 border-tv-primary">
                  {bio || 'I collect tools that help students build faster without spending money.'}
                </p>
              </div>
            </div>

            {/* Right column - Curator Card */}
            <div className="w-[300px] flex-shrink-0">
              <div className="bg-surface border-2 border-tv-border rounded-xl p-6 shadow-brutal">
                {profile?.curatorBadge && profile.curatorBadge !== 'none' ? (
                  <>
                    <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Curator Badge</p>
                    <div className="text-center py-4">
                      <CuratorBadge badge={profile.curatorBadge} size="lg" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Trusted Curator</p>
                    {topCategories.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {topCategories.slice(0, 4).map(cat => (
                          <span
                            key={cat.key}
                            className="px-3 py-2 rounded-lg text-[12px] font-mono font-medium border border-tv-border bg-bg"
                          >
                            {cat.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] font-mono text-tv-text-s italic">No categories yet</p>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* ═══════════════════════ CURATOR STATS ═══════════════════════ */}
        <section className="py-10 border-t border-b border-tv-border">
          <div className="flex items-center gap-16">
            <div>
              <p className="font-syne text-[48px] text-tv-text leading-none font-bold">{submittedTools.length}</p>
              <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-wider mt-2">Tools Curated</p>
            </div>
            <div className="w-px h-12 bg-tv-border/30" />
            <div>
              <p className="font-syne text-[48px] text-tv-text leading-none font-bold">{collections.length}</p>
              <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-wider mt-2">Collections Published</p>
            </div>
            <div className="w-px h-12 bg-tv-border/30" />
            <div>
              <p className="font-syne text-[48px] text-tv-text leading-none font-bold">{visibleFollowers ? (profile?.followerCount ?? 0) : '—'}</p>
              <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-wider mt-2">Followers</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ COLLECTION SPOTLIGHT ═══════════════════════ */}
        {featuredCollection && (
          <section className="pt-14 pb-10">
            <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-6">Collection Spotlight</p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full overflow-hidden rounded-xl border-2 border-tv-border bg-surface"
            >
              <div className="flex flex-col lg:flex-row">
                {/* Left: Title + Description + Button */}
                <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col justify-center p-8 border-b lg:border-b-0 lg:border-r border-tv-border">
                  <h3 className="font-syne text-[26px] text-tv-text leading-tight mb-3">{featuredCollection.name}</h3>
                  {featuredCollection.description && (
                    <p className="text-[13px] text-tv-text-s leading-relaxed line-clamp-2 mb-5">{featuredCollection.description}</p>
                  )}
                  {featuredToolIcons.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-5" aria-label="Tools in this collection">
                      {featuredToolIcons.slice(0, 8).map(t => (
                        <span key={t.name} title={t.name} className="w-7 h-7 rounded-md bg-s2 border border-tv-border flex items-center justify-center text-[13px]">
                          {t.icon}
                        </span>
                      ))}
                      {featuredToolIcons.length > 8 && (
                        <span className="text-[11px] font-mono text-tv-text-m">+{featuredToolIcons.length - 8}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/c/${featuredCollection._uuid}`)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-mono text-tv-primary font-medium hover:underline w-fit"
                  >
                    View Collection <ExternalLink size={12} />
                  </button>
                </div>

                {/* Center: Recently Published Tool */}
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Recently Published</p>
                  {latestTool ? (
                    <div
                      onClick={() => navigate(`/tool/${hashId(latestTool.id)}`)}
                      className="group cursor-pointer flex flex-col items-center w-full max-w-[320px]"
                    >
                      <div className="w-full aspect-[5/3] rounded-lg overflow-hidden border border-tv-border bg-surface shadow-sm group-hover:shadow-md transition-shadow">
                        {latestTool.screenshotUrl ? (
                          <img src={latestTool.screenshotUrl} alt={latestTool.name} className="w-full h-full object-cover" />
                        ) : latestTool.ogImage ? (
                          <img src={latestTool.ogImage} alt={latestTool.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-s2">
                            {latestTool.favicon ? (
                              <img src={latestTool.favicon} alt="" className="w-10 h-10 object-contain" />
                            ) : (
                              <span className="text-[36px]">🔧</span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-[15px] font-syne font-semibold text-center mt-3 group-hover:text-tv-primary transition-colors" style={{ color: '#1a1a1a' }}>
                        {latestTool.name}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-tv-text-s">No recent publications</p>
                  )}
                </div>

                {/* Right: Cover artwork */}
                <div
                  className="w-full lg:w-[300px] flex-shrink-0 flex items-center justify-center min-h-[200px] lg:min-h-0"
                  style={{
                    background: featuredCollection.coverImageUrl
                      ? `url(${featuredCollection.coverImageUrl}) center/cover no-repeat`
                      : collectionCoverGradient(featuredCollection.name),
                  }}
                >
                  {!featuredCollection.coverImageUrl && (
                    <span className="text-[72px] font-syne font-bold text-white/30 select-none">
                      {featuredCollection.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* ═══════════════════════ ALL COLLECTIONS ═══════════════════════ */}
        {visibleCollections && collections.length > 0 && (
          <section className="pt-12 pb-10">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">All Collections</p>
              <button
                onClick={() => navigate('/collections/me')}
                className="text-[12px] font-mono text-tv-text-s hover:text-tv-text transition-colors flex items-center gap-1"
              >
                View All <ExternalLink size={11} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-5">
              {collections.map((col, i) => (
                <motion.button
                  key={col.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => navigate(`/c/${col._uuid}`)}
                  className="group flex flex-col text-left border-2 border-tv-border rounded-xl overflow-hidden transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal bg-surface"
                >
                  {/* Cover image area */}
                  <div
                    className="h-[180px] flex items-center justify-center flex-shrink-0 border-b border-tv-border"
                    style={{
                      background: col.coverImageUrl
                        ? `url(${col.coverImageUrl}) center/cover no-repeat`
                        : collectionCoverGradient(col.name),
                    }}
                  >
                    {!col.coverImageUrl && (
                      <span className="text-[48px] font-syne font-bold text-white/40 select-none group-hover:scale-110 transition-transform duration-300">
                        {col.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-5">
                    <h3 className="font-syne text-[17px] text-tv-text leading-tight truncate">{col.name}</h3>
                    {col.description && (
                      <p className="text-[12px] text-tv-text-s line-clamp-2 leading-relaxed">{col.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] font-mono text-tv-text-m mt-1">
                      <span className="flex items-center gap-1">
                        <Wrench size={11} /> {col.toolCount} tool{col.toolCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {col.viewCount ?? 0}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ RECENT REVIEWS ═══════════════════════ */}
        {visibleReviews && reviews.length > 0 && (
          <section className="pt-12 pb-10">
            <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-6">Recent Reviews</p>
            <div className="grid grid-cols-3 gap-5">
              {reviews.slice(0, 6).map((item, i) => (
                <motion.button
                  key={item.review._uuid}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${item.toolId}`)}
                  className="flex flex-col bg-surface border-2 border-tv-border rounded-xl p-6 text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[28px]">{item.toolIcon}</span>
                    <div>
                      <p className="font-syne text-[16px] text-tv-text leading-tight">{item.toolName}</p>
                      <p className="text-[12px] font-mono text-tv-text-m">{formatDistanceToNow(item.review.createdAt, { addSuffix: true })}</p>
                    </div>
                  </div>
                  {item.review.bestFor && (
                    <div className="mb-3">
                      <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Best For</p>
                      <p className="text-[13px] text-tv-text leading-relaxed">{item.review.bestFor}</p>
                    </div>
                  )}
                  {item.review.gotcha && (
                    <div className="mb-2">
                      <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Gotcha</p>
                      <p className="text-[12px] text-tv-text-s leading-relaxed">{item.review.gotcha}</p>
                    </div>
                  )}
                  {item.review.bestFor && (
                    <div className="mt-auto pt-3 border-t border-tv-border/30 flex items-center gap-2 text-[11px] font-mono text-tv-text-m">
                      {item.review.rating > 0 && (
                        <span className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-[11px] ${s <= item.review.rating ? '' : 'opacity-20'}`} style={{ color: '#2D6A4F' }}>★</span>
                          ))}
                        </span>
                      )}
                      <span>{item.review.rating}/5</span>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ RECENT ACTIVITY ═══════════════════════ */}
        {latestActivity.length > 0 && (
          <section className="pt-12 pb-10">
            <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-6">Recent Activity</p>
            <div className="space-y-2 max-w-2xl">
              {latestActivity.map((item, i) => (
                <motion.div
                  key={`${item.type}-${item.label}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="flex items-center gap-3 px-4 py-3 bg-surface border border-tv-border rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0">
                    {item.type === 'published' && <Bookmark size={13} className="text-tv-primary" />}
                    {item.type === 'reviewed' && <PenLine size={13} className="text-tv-text-s" />}
                    {item.type === 'added' && <Wrench size={13} className="text-tv-text-s" />}
                  </div>
                  <p className="text-[13px] text-tv-text leading-snug flex-1 min-w-0">
                    <span className="font-mono text-tv-text-s text-[11px]">
                      {item.type === 'published' && 'Published collection '}
                      {item.type === 'reviewed' && 'Reviewed '}
                      {item.type === 'added' && 'Added tool '}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </p>
                  <span className="text-[10px] font-mono text-tv-text-m flex-shrink-0">
                    {formatDistanceToNow(item.date, { addSuffix: true })}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ WHY FOLLOW THIS CURATOR ═══════════════════════ */}
        {whyFollowStatements.length > 0 && (
          <section className="pt-12 pb-8">
            <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-6">
              Why Follow This Curator?
            </p>
            <div className="bg-surface border-2 border-tv-border rounded-xl p-10 shadow-brutal max-w-2xl">
              <ul className="space-y-4">
                {whyFollowStatements.map((stmt, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    className="flex items-center gap-4 text-[16px] text-tv-text font-syne leading-snug"
                  >
                    <span className="w-2 h-2 rounded-full bg-tv-primary flex-shrink-0" />
                    {stmt}
                  </motion.li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ─── Empty state ─── */}
        {collections.length === 0 && reviews.length === 0 && submittedTools.length === 0 && (
          <div className="pt-16 flex flex-col items-center text-center">
            <Bookmark size={32} className="text-tv-text-m mb-4" />
            <p className="text-[15px] text-tv-text-s font-mono max-w-sm leading-relaxed">
              Start curating tools and publishing collections to build your showcase.
            </p>
          </div>
        )}

      </div>

      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => { refetchProfile(); setSettingsOpen(false); }}
      />
    </div>
    </>
  );
}
