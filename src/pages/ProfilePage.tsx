import { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Globe, Calendar, Bookmark,
  MessageCircle, ChevronRight, Plus, Check, Github, Twitter, Linkedin,
  Settings, Wrench, Star, Quote, Heart, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useFollow } from '@/hooks/useProfile';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import CuratorBadge from '@/components/CuratorBadge';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import CuratorRecommendations from '@/components/CuratorRecommendations';
import { notifyNewFollower } from '@/lib/notifications';
import { hashId } from '@/lib/hashId';

interface ToolInfo {
  id: string;
  name: string;
  icon: string;
  favicon: string;
  color: string;
}

interface CollectionWithTools {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  followerCount: number;
  coverImageUrl: string;
  tools: ToolInfo[];
  updatedAt: string;
}

interface ReviewWithTool {
  id: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  toolColor: string;
  rating: number;
  bestFor: string;
  gotcha: string;
  date: Date;
}

interface ActivityItem {
  text: string;
  type: 'added' | 'published' | 'reviewed';
  time: Date;
}

const TOOL_COLORS = [
  '#0284C7', '#7C3AED', '#059669', '#DC2626', '#2563EB', '#D97706',
  '#9333EA', '#0891B2', '#B45309', '#1D4ED8',
];

function toolColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TOOL_COLORS[Math.abs(h) % TOOL_COLORS.length];
}

function collectionCoverGradient(name: string): string {
  const patterns = [
    `linear-gradient(135deg, #2D6A4F 0%, #1B4332 40%, #2D5540 100%)`,
    `linear-gradient(135deg, #B45309 0%, #92400E 40%, #A05A15 100%)`,
    `linear-gradient(135deg, #1D4ED8 0%, #1E40AF 40%, #2563EB 100%)`,
    `linear-gradient(135deg, #7E22CE 0%, #6B21A8 40%, #9333EA 100%)`,
    `linear-gradient(135deg, #0F766E 0%, #115E59 40%, #14B8A6 100%)`,
    `linear-gradient(135deg, #B91C1C 0%, #991B1B 40%, #DC2626 100%)`,
    `linear-gradient(135deg, #A21CAF 0%, #86198F 40%, #D946EF 100%)`,
    `linear-gradient(135deg, #D97706 0%, #B45309 40%, #F59E0B 100%)`,
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return patterns[Math.abs(h) % patterns.length];
}

function parseContactUrl(url: string): { label: string; url: string; icon: ReactNode }[] {
  if (!url) return [];
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  if (normalized.includes('discord.gg/') || normalized.includes('discord.com/users/')) {
    return [{ label: 'Discord', url: normalized, icon: <MessageCircle size={14} /> }];
  }
  if (normalized.includes('t.me/')) {
    return [{ label: 'Telegram', url: normalized, icon: <Send size={14} /> }];
  }
  if (normalized.includes('x.com/') || normalized.includes('twitter.com/')) {
    return [{ label: 'Twitter/X', url: normalized, icon: <Twitter size={14} /> }];
  }
  if (normalized.includes('linkedin.com/in/')) {
    return [{ label: 'LinkedIn', url: normalized, icon: <Linkedin size={14} /> }];
  }
  return [{ label: 'Website', url: normalized, icon: <Globe size={14} /> }];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, ownedTools, loading, error: profileError } = useProfile(username);

  const [collections, setCollections] = useState<CollectionWithTools[]>([]);
  const [reviews, setReviews] = useState<ReviewWithTool[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [featuredTools, setFeaturedTools] = useState<ToolInfo[]>([]);
  const [latestTool, setLatestTool] = useState<{ id: string; name: string; screenshotUrl: string; ogImage: string; favicon: string } | null>(null);
  const [shelfTools, setShelfTools] = useState<ToolInfo[]>([]);
  const [alternativesCount, setAlternativesCount] = useState(0);
  const [alternativesList, setAlternativesList] = useState<{ altName: string; toolName: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowerCount, setLocalFollowerCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const profileUuid = profile?._uuid;
  const isOwnProfile = user && profileUuid && user.id === profileUuid;

  useEffect(() => {
    if (!profileUuid || !isSupabaseConfigured) { setDataLoading(false); setDataError(null); return; }
    setDataLoading(true);
    setDataError(null);

    Promise.all([
      supabase.from('collections').select('*, collection_tools(count)').eq('user_id', profileUuid).order('updated_at', { ascending: false }),
      supabase.from('reviews').select('*').eq('user_id', profileUuid).eq('moderation_status', 'active').order('created_at', { ascending: false }),
      supabase.from('tools').select('*').eq('added_by', profileUuid).order('created_at', { ascending: false }),
      supabase.from('curator_shelf').select('tool_id, tools(id, name, icon, favicon)').eq('user_id', profileUuid).order('position'),
      supabase.from('tool_alternatives').select('id, tool_id, alternative_tool_id').eq('created_by', profileUuid).eq('approved', true),
    ]).then(async ([colRes, revRes, toolsRes, shelfRes, altRes]) => {
      if (!mountedRef.current) return;
      const colRows = (colRes.data ?? []) as Array<Record<string, unknown>>;
      const revRows = (revRes.data ?? []) as Array<Record<string, unknown>>;
      const toolRows = (toolsRes.data ?? []) as Array<Record<string, unknown>>;
      const shelfRows = (shelfRes.data ?? []) as Array<any>;

      // Map shelf tools
      setShelfTools(shelfRows.map(r => {
        const t = Array.isArray(r.tools) ? r.tools[0] : r.tools;
        if (!t) return null;
        return {
          id: t.id,
          name: t.name,
          icon: t.icon,
          favicon: t.favicon,
          color: toolColor(t.name)
        };
      }).filter(Boolean) as ToolInfo[]);
      if (!mountedRef.current) return;

      const allToolIds = new Set<string>();
      const colMap = new Map<string, string[]>();

      const colIdsWithTools = colRows.filter(c => {
        const ctArr = c.collection_tools as Array<{ count: number }> | undefined;
        const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
        return countVal > 0;
      }).map(c => c.id as string);

      if (colIdsWithTools.length > 0) {
        const { data: allCtData } = await supabase.from('collection_tools').select('tool_id, collection_id').in('collection_id', colIdsWithTools);
        if (!mountedRef.current) return;
        const grouped: Record<string, string[]> = {};
        for (const row of (allCtData ?? []) as Array<{ tool_id: string; collection_id: string }>) {
          (grouped[row.collection_id] ??= []).push(row.tool_id);
        }
        for (const c of colRows) {
          const ids = grouped[c.id as string] || [];
          if (ids.length > 0) {
            colMap.set(c.id as string, ids);
            ids.forEach(id => allToolIds.add(id));
          }
        }
      }
      revRows.forEach(r => allToolIds.add(r.tool_id as string));
      toolRows.forEach(r => allToolIds.add(r.id as string));

      const toolMap = new Map<string, { name: string; icon: string; favicon: string }>();
      if (allToolIds.size > 0) {
        const { data: tools } = await supabase.from('tools').select('id, name, icon, favicon').in('id', [...allToolIds]);
        if (!mountedRef.current) return;
        for (const t of (tools ?? []) as Array<Record<string, unknown>>) {
          toolMap.set(t.id as string, { name: t.name as string, icon: t.icon as string, favicon: t.favicon as string });
        }
      }

      // Fetch follower counts for all collections
      const followerCountMap = new Map<string, number>();
      const colIds = colRows.map(c => c.id as string);
      if (colIds.length > 0) {
        const { data: followCounts } = await supabase
          .from('collection_followers')
          .select('collection_id')
          .in('collection_id', colIds);
        if (!mountedRef.current) return;
        if (followCounts) {
          const counts: Record<string, number> = {};
          for (const f of followCounts as Array<{ collection_id: string }>) {
            counts[f.collection_id] = (counts[f.collection_id] || 0) + 1;
          }
          for (const id of colIds) followerCountMap.set(id, counts[id] || 0);
        }
      }

      const mappedCols: CollectionWithTools[] = colRows.map(c => {
        const ctArr = c.collection_tools as Array<{ count: number }> | undefined;
        const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
        const followerCount = followerCountMap.get(c.id as string) ?? 0;
        const toolIds = colMap.get(c.id as string) || [];
        const tools = toolIds.map(id => {
          const info = toolMap.get(id);
          return { id, name: info?.name || 'Tool', icon: info?.icon || '🔧', favicon: info?.favicon || '', color: toolColor(info?.name || 'Tool') };
        });
        return {
          id: c.id as string,
          name: c.name as string,
          description: (c.description as string) || '',
          toolCount: countVal,
          followerCount,
          coverImageUrl: (c.cover_image_url as string) || '',
          tools,
          updatedAt: (c.updated_at as string) || (c.created_at as string) || '',
        };
      });

      const revToolIds = [...new Set(revRows.map(r => r.tool_id as string))];
      const revToolMap = new Map<string, { name: string; icon: string; favicon: string }>();
      if (revToolIds.length > 0) {
        const { data: rTools } = await supabase.from('tools').select('id, name, icon, favicon').in('id', revToolIds);
        if (!mountedRef.current) return;
        for (const t of (rTools ?? []) as Array<Record<string, unknown>>) {
          revToolMap.set(t.id as string, { name: t.name as string, icon: t.icon as string, favicon: t.favicon as string });
        }
      }

      const mappedReviews: ReviewWithTool[] = revRows.map(r => {
        const info = revToolMap.get(r.tool_id as string);
        return {
          id: r.id as string,
          toolId: r.tool_id as string,
          toolName: info?.name || 'Unknown Tool',
          toolIcon: info?.icon || '🔧',
          toolColor: toolColor(info?.name || 'Tool'),
          rating: (r.rating as number) || 0,
          bestFor: r.best_for as string || '',
          gotcha: r.gotcha as string || '',
          date: new Date(r.created_at as string),
        };
      });

      const activityItems: ActivityItem[] = [];

      for (const t of toolRows.slice(0, 3)) {
        const info = toolMap.get(t.id as string);
        activityItems.push({ text: `Added tool ${info?.name || 'Unknown'}`, type: 'added', time: new Date(t.created_at as string) });
      }
      for (const c of colRows.slice(0, 3)) {
        activityItems.push({ text: `Published collection ${c.name}`, type: 'published', time: new Date(c.updated_at as string) });
      }
      for (const r of revRows.slice(0, 3)) {
        const info = revToolMap.get(r.tool_id as string);
        activityItems.push({ text: `Reviewed ${info?.name || 'Unknown tool'}`, type: 'reviewed', time: new Date(r.created_at as string) });
      }
      activityItems.sort((a, b) => b.time.getTime() - a.time.getTime());

      setLatestTool(toolRows.length > 0 ? {
        id: toolRows[0].id as string,
        name: (toolRows[0].name as string) || 'Unknown',
        screenshotUrl: (toolRows[0].screenshot_url as string) || '',
        ogImage: (toolRows[0].og_image as string) || '',
        favicon: (toolRows[0].favicon as string) || '',
      } : null);

      setCollections(mappedCols);
      setReviews(mappedReviews);
      setActivity(activityItems);

      // Featured collection tools
      if (profile?.featuredCollectionId) {
        const { data: fTools } = await supabase.from('collection_tools').select('tool_id').eq('collection_id', profile.featuredCollectionId);
        if (!mountedRef.current) return;
        const fIds = (fTools ?? []).map((ct: Record<string, unknown>) => ct.tool_id as string);
        setFeaturedTools(fIds.map(id => {
          const info = toolMap.get(id);
          return { id, name: info?.name || 'Tool', icon: info?.icon || '🔧', favicon: info?.favicon || '', color: toolColor(info?.name || 'Tool') };
        }));
      } else if (mappedCols.length > 0) {
        setFeaturedTools(mappedCols[0].tools);
      }

      // Process alternatives contributed by this curator
      const altRows = (altRes?.data ?? []) as Array<{ tool_id: string; alternative_tool_id: string }>;
      setAlternativesCount(altRows.length);
      if (altRows.length > 0) {
        const altToolIds = [...new Set(altRows.flatMap(a => [a.tool_id, a.alternative_tool_id]))];
        const { data: altToolData } = await supabase.from('tools').select('id, name').in('id', altToolIds);
        if (!mountedRef.current) return;
        const altNameMap = new Map((altToolData || []).map(t => [t.id, t.name]));
        setAlternativesList(altRows.map(a => ({
          toolName: altNameMap.get(a.tool_id) || 'Unknown',
          altName: altNameMap.get(a.alternative_tool_id) || 'Unknown',
        })));
      }

      setDataLoading(false);
    }).catch(() => { if (mountedRef.current) { setDataError('Failed to load profile data.'); setDataLoading(false); } });
  }, [profileUuid, profile?.featuredCollectionId]);

  const featuredCollection = useMemo(() => {
    if (profile?.featuredCollectionId) {
      return collections.find(c => c.id === profile.featuredCollectionId) || collections[0] || null;
    }
    return collections[0] || null;
  }, [collections, profile?.featuredCollectionId]);

  const visibleCollections = profile?.showCollections !== false ? collections : [];
  const visibleReviews = profile?.showReviews !== false ? reviews : [];
  const visibleFollowers = profile?.showFollowers !== false;

  const displayName = profile?.displayName || profile?.username || 'Curator';
  const avatarUrl = profile?.avatarUrl || '';
  const bannerUrl = profile?.bannerUrl || '';
  const tagline = profile?.tagline || 'Curating tools worth sharing.';
  const signatureQuote = profile?.signature_quote || 'Building a better toolkit for makers.';
  const bio = profile?.bio || 'I collect and review tools that help me build, learn, and create.';
  const location = profile?.location || '';
  const website = profile?.website || '';
  const github = profile?.github || '';
  const twitter = profile?.twitter || '';
  const linkedin = profile?.linkedin || '';
  const contactUrl = profile?.contact_url || '';
  const followSystem = useFollow();

  // Check follow status on mount
  useEffect(() => {
    if (profile?._uuid) {
      setLocalFollowerCount(profile.followerCount);
      if (user && profile._uuid !== user.id) {
        followSystem.isFollowing(profile._uuid).then(val => { if (mountedRef.current) setIsFollowing(val); });
      } else {
        setIsFollowing(false);
      }
    }
  }, [profile?._uuid, profile?.followerCount, user]);

  const handleToggleFollow = async () => {
    if (!user || !profile?._uuid || followLoading) return;
    console.log('[handleToggleFollow] currentUser.id:', user.id, 'profile._uuid:', profile._uuid, 'isFollowing (prev):', isFollowing);
    setFollowLoading(true);
    const prev = isFollowing;
    const prevCount = localFollowerCount;
    setIsFollowing(!prev);
    setLocalFollowerCount(prevCount + (prev ? -1 : 1));
    const ok = prev ? await followSystem.unfollow(profile._uuid) : await followSystem.follow(profile._uuid);
    console.log('[handleToggleFollow] ok:', ok, 'was follow action:', !prev);
    if (ok && !prev) {
      supabase.from('profiles').select('display_name, username, avatar_url').eq('user_id', user.id).maybeSingle()
        .then(({ data: me }) => {
          notifyNewFollower(
            profile._uuid!,
            user.id,
            (me as Record<string, unknown> | null)?.display_name as string || user.email || 'Someone',
            (me as Record<string, unknown> | null)?.username as string ?? '',
            (me as Record<string, unknown> | null)?.avatar_url as string ?? '',
          );
        });
    }
    if (!ok) {
      setIsFollowing(prev);
      setLocalFollowerCount(prevCount);
    }
    setFollowLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F0EDE6' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#D4CFC5', borderTopColor: '#2D6A4F' }} />
          <span className="text-[12px] font-dmsans" style={{ color: '#5a5a5a' }}>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: '#F0EDE6' }}>
        <p className="text-[14px] font-dmsans font-medium" style={{ color: '#DC2626' }}>Failed to load profile</p>
        <p className="text-[12px] font-dmsans max-w-md text-center" style={{ color: '#5a5a5a' }}>{profileError}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg text-[13px] font-dmsans text-white mt-2" style={{ backgroundColor: '#2D6A4F' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F0EDE6' }}>
        <p className="text-[14px] font-dmsans" style={{ color: '#5a5a5a' }}>Profile not found.</p>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F0EDE6' }}>
        <div className="max-w-[1400px] mx-auto px-12 pb-24">
          <div className="pt-12 space-y-8">
            <div className="flex flex-col sm:flex-row gap-12">
              <div className="w-[140px] h-[140px] rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-12 w-64 rounded bg-gray-200 animate-pulse" />
                <div className="h-6 w-96 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
            <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Tools Added', value: ownedTools },
    { label: 'Collections', value: collections.length },
    { label: 'Followers', value: visibleFollowers ? localFollowerCount : '—' },
    { label: 'Following', value: visibleFollowers ? profile.followingCount : '—' },
  ];

  const ACTIVITY_COLORS: Record<string, string> = {
    added: '#059669',
    published: '#7C3AED',
    reviewed: '#D97706',
  };

  const profileName = profile?.displayName || profile?.username || 'User';
  const profileDesc = profile?.tagline || `${profileName}'s profile on Tool Scribe.`;

  return (
    <>
      <SEO
        title={profileName}
        description={profileDesc}
        path={`/u/${username}`}
        image={profile?.avatarUrl || undefined}
        type="profile"
      />
    <div className="min-h-screen" style={{ backgroundColor: '#F0EDE6' }}>

      {/* ─── Banner ─── */}
      {bannerUrl && (
        <div className="w-full h-48 overflow-hidden">
                    <img src={bannerUrl} alt="Banner" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      {/* ─── Top Bar ─── */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: '#F0EDE6', borderColor: '#D4CFC5' }}
      >
        <div className="max-w-[1400px] mx-auto px-12 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[13px] font-dmsans transition-colors"
            style={{ color: '#5a5a5a' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-dmsans transition-colors border"
              style={{ color: '#5a5a5a', borderColor: '#D4CFC5' }}
            >
              <Settings size={13} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-12 pb-24">

        {dataError && (
          <div className="mt-4 px-5 py-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-[13px] font-dmsans" style={{ color: '#DC2626' }}>{dataError}</p>
            <button onClick={() => window.location.reload()} className="text-[12px] font-dmsans underline" style={{ color: '#2D6A4F' }}>Retry</button>
          </div>
        )}

        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="pt-12 pb-10">
          <div className="flex flex-col sm:flex-row items-start gap-12">

            {/* ── Left Column ── */}
            <div className="w-full sm:w-[260px] sm:flex-shrink-0">
              <div className="relative w-[140px] h-[140px] mb-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    loading="lazy"
                    className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center text-white text-[56px] font-syne font-bold"
                    style={{ backgroundColor: '#2D6A4F' }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-dmsans" style={{ color: '#5a5a5a' }}>
                  @{profile.username}
                </p>
              </div>
              {profile.curatorBadge && profile.curatorBadge !== 'none' && (
                <div className="mb-3 mt-1.5">
                  <CuratorBadge badge={profile.curatorBadge} size="sm" />
                </div>
              )}

              {location && (
                <p className="text-[13px] font-dmsans flex items-center gap-1.5 mb-2" style={{ color: '#5a5a5a' }}>
                  <MapPin size={13} /> {location}
                </p>
              )}
              {website && (
                <p className="text-[13px] font-dmsans flex items-center gap-1.5 mb-2" style={{ color: '#5a5a5a' }}>
                  <Globe size={13} />
                  <a href={`https://${website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#2D6A4F' }}>
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              )}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {github && (
                  <a href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" style={{ color: '#5a5a5a' }} title={`@${github} on GitHub`}>
                    <Github size={15} />
                  </a>
                )}
                {twitter && (
                  <a href={`https://twitter.com/${twitter}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" style={{ color: '#5a5a5a' }} title={`@${twitter} on Twitter`}>
                    <Twitter size={15} />
                  </a>
                )}
                {linkedin && (
                  <a href={`https://linkedin.com/in/${linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" style={{ color: '#5a5a5a' }} title={`${linkedin} on LinkedIn`}>
                    <Linkedin size={15} />
                  </a>
                )}
              </div>
              <p className="text-[13px] font-dmsans flex items-center gap-1.5 mb-6" style={{ color: '#5a5a5a' }}>
                <Calendar size={13} />
                {(() => {
                  const d = profile.createdAt ? new Date(profile.createdAt) : null;
                  if (!d || isNaN(d.getTime()) || d.getTime() < new Date('2020-01-01').getTime()) {
                    return 'Recently joined';
                  }
                  return `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                })()}
              </p>
              <div className="flex items-center gap-2">
                {user && profileUuid !== user.id ? (
                  <button
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`group px-5 py-2.5 rounded-lg text-[13px] font-dmsans font-medium transition-all flex items-center gap-1.5 ${
                      isFollowing
                        ? 'bg-white text-red-500 border border-red-200 hover:bg-red-50'
                        : 'text-white hover:opacity-90'
                    }`}
                    style={isFollowing ? {} : { backgroundColor: '#2D6A4F' }}
                  >
                    {followLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isFollowing ? (
                      <Heart size={13} className="fill-red-500" />
                    ) : (
                      <Heart size={13} />
                    )}
                    <span className="group-hover:hidden">{isFollowing ? 'Following' : 'Follow'}</span>
                    <span className="hidden group-hover:inline">{isFollowing ? 'Unfollow' : 'Follow'}</span>
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (contactUrl) {
                      window.open(contactUrl, '_blank', 'noopener,noreferrer');
                    } else {
                      toast('No contact method provided', {
                        description: 'This user has not set up a contact method yet.',
                      });
                    }
                  }}
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-dmsans transition-colors border ${
                    contactUrl ? 'cursor-pointer hover:bg-white/50' : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{ color: contactUrl ? '#2D6A4F' : '#5a5a5a', borderColor: '#D4CFC5' }}
                >
                  {contactUrl ? 'Message' : 'Contact'}
                </button>
              </div>
            </div>

            {/* ── Center Column ── */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-syne text-[64px] font-bold leading-[1.05] tracking-tight mb-2" style={{ color: '#1a1a1a' }}>
                {displayName}
              </h1>
              <p className="font-syne text-[20px] italic leading-[1.4] mb-6" style={{ color: '#5a5a5a' }}>
                <Quote size={16} className="inline mr-2 opacity-50" />
                {signatureQuote}
              </p>
              
              <div className="flex flex-col gap-6 pt-6 border-t" style={{ borderColor: '#D4CFC5' }}>
                <div>
                  <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-2" style={{ color: '#2D6A4F' }}>Curator DNA</p>
                  <p className="text-[28px] font-syne leading-[1.2] font-medium" style={{ color: '#1a1a1a' }}>
                    {tagline}
                  </p>
                  <p className="text-[15px] font-dmsans leading-relaxed mt-2" style={{ color: '#5a5a5a' }}>
                    {bio}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Right Column: Contact ── */}
            <div className="w-full sm:w-[280px] sm:flex-shrink-0">
              <div
                className="rounded-xl p-6 shadow-sm"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle size={16} style={{ color: '#2D6A4F' }} />
                  <span className="text-[11px] font-dmsans font-semibold uppercase tracking-widest" style={{ color: '#5a5a5a' }}>
                    Contact
                  </span>
                </div>
                {(() => {
                  const links = parseContactUrl(contactUrl);
                  return links.length > 0 ? (
                    <div className="space-y-3">
                      {links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 text-[13px] font-dmsans hover:underline w-fit"
                          style={{ color: '#2D6A4F' }}
                        >
                          {link.icon}
                          {link.label}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] font-dmsans italic" style={{ color: '#5a5a5a' }}>
                      No contact information provided.
                    </p>
                  );
                })()}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E5E0D6' }}>
                  <button
                    onClick={() => {
                      if (contactUrl) {
                        window.open(contactUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        toast('No contact method provided', {
                          description: 'This user has not set up a contact method yet.',
                        });
                      }
                    }}
                    className={`w-full py-2.5 rounded-lg text-[13px] font-dmsans font-medium transition-colors border ${
                      contactUrl ? 'cursor-pointer hover:bg-white/50' : 'opacity-40'
                    }`}
                    style={{ color: contactUrl ? '#2D6A4F' : '#5a5a5a', borderColor: '#D4CFC5' }}
                  >
                    {contactUrl ? 'Message' : 'Message Disabled'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Similar Curators ── */}
            {profileUuid && !isOwnProfile && (
              <div className="mt-4">
                <CuratorRecommendations curatorId={profileUuid} />
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════ STATS BAR ═══════════════════ */}
        <section data-section="stats" className="py-8 border-t border-b" style={{ borderColor: '#D4CFC5' }}>
          <div className="flex items-center">
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex-1 flex flex-col items-center relative">
                <p className="font-syne text-[44px] font-bold leading-none" style={{ color: '#1a1a1a' }}>
                  {stat.value}
                </p>
                <p className="text-[11px] font-dmsans uppercase tracking-wider mt-1.5" style={{ color: '#5a5a5a' }}>
                  {stat.label}
                </p>
                {i < stats.length - 1 && (
                  <div className="absolute right-0 w-px h-10" style={{ backgroundColor: '#D4CFC5' }} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ SHELF ═══════════════════ */}
        {shelfTools.length > 0 && (
          <section className="pt-8 pb-10">
            <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-6" style={{ color: '#5a5a5a' }}>
              Currently Loving
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {shelfTools.map(tool => (
                <div key={tool.id} onClick={() => navigate(`/tool/${hashId(tool.id)}`)} className="bg-white p-5 rounded-xl border border-tv-border shadow-sm cursor-pointer hover:border-tv-primary transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: tool.color }}>{tool.icon}</div>
                    <h4 className="font-syne font-bold text-[16px]">{tool.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════ COLLECTION SPOTLIGHT ═══════════════════ */}
        {featuredCollection && (
          <section className="pt-14 pb-10">
            <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-5" style={{ color: '#5a5a5a' }}>
              Collection Spotlight
            </p>
            <div className="flex flex-col lg:flex-row rounded-xl overflow-hidden shadow-sm border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D6' }}>
              {/* Left: Collection Info */}
              <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col justify-center p-8 border-b lg:border-b-0 lg:border-r" style={{ borderColor: '#E5E0D6' }}>
                <h3 className="font-syne text-[28px] font-bold leading-tight mb-2" style={{ color: '#1a1a1a' }}>
                  {featuredCollection.name}
                </h3>
                {featuredCollection.description && (
                  <p className="text-[13px] leading-relaxed line-clamp-2 mb-4" style={{ color: '#6b6b6b' }}>
                    {featuredCollection.description}
                  </p>
                )}
                {featuredTools.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-4" aria-label="Tools in this collection">
                    {featuredTools.slice(0, 8).map(t => (
                      <span
                        key={t.id}
                        title={t.name}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] border"
                        style={{ backgroundColor: '#F0EDE6', borderColor: '#E5E0D6' }}
                      >
                        {t.icon}
                      </span>
                    ))}
                    {featuredTools.length > 8 && (
                      <span className="text-[11px]" style={{ color: '#6b6b6b' }}>+{featuredTools.length - 8}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Wrench size={13} style={{ color: '#6b6b6b' }} />
                    <span className="text-[12px]" style={{ color: '#6b6b6b' }}>{featuredCollection.toolCount} tools</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star size={13} style={{ color: '#6b6b6b' }} />
                    <span className="text-[12px]" style={{ color: '#6b6b6b' }}>{featuredCollection.followerCount} followers</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/c/${featuredCollection.id}`)}
                  className="flex items-center gap-1.5 text-[13px] font-medium hover:underline w-fit"
                  style={{ color: '#2D6A4F' }}
                >
                  <span>View collection</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Center: Recently Published Tool */}
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-4" style={{ color: '#5a5a5a' }}>
                  Recently Published
                </p>
                {latestTool ? (
                  <div
                    onClick={() => navigate(`/tool/${hashId(latestTool.id)}`)}
                    className="group cursor-pointer flex flex-col items-center w-full max-w-[320px]"
                  >
                    <div className="w-full aspect-[5/3] rounded-lg overflow-hidden border shadow-sm group-hover:shadow-md transition-shadow" style={{ borderColor: '#E5E0D6' }}>
                      {latestTool.screenshotUrl ? (
                        <img src={latestTool.screenshotUrl} alt={latestTool.name} className="w-full h-full object-cover" />
                      ) : latestTool.ogImage ? (
                        <img src={latestTool.ogImage} alt={latestTool.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#F5F5F0' }}>
                          {latestTool.favicon ? (
                            <img src={latestTool.favicon} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <span className="text-[36px]">🔧</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[15px] font-syne font-semibold text-center mt-3 group-hover:text-[#2D6A4F] transition-colors" style={{ color: '#1a1a1a' }}>
                      {latestTool.name}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px]" style={{ color: '#6b6b6b' }}>No recent publications</p>
                )}
              </div>

              {/* Right: Cover Image */}
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
          </section>
        )}

        {/* ═══════════════════ ALL COLLECTIONS ═══════════════════ */}
        {visibleCollections.length > 0 && (
          <section id="collections-section" className="pt-8 pb-10">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest" style={{ color: '#5a5a5a' }}>
                All Collections
              </p>
              <button onClick={() => document.getElementById('collections-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-[12px] font-dmsans flex items-center gap-1" style={{ color: '#2D6A4F' }}>
                View all <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleCollections.map((col) => (
                <div
                  key={col.id}
                  onClick={() => navigate(`/c/${col.id}`)}
                  className="group rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}
                >
                  {col.coverImageUrl ? (
                    <div className="h-[180px] relative overflow-hidden">
                      <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="h-[180px] relative flex items-center justify-center"
                      style={{ background: collectionCoverGradient(col.name) }}
                    >
                      <span className="text-[56px] font-syne font-bold text-white/25 select-none">
                        {col.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-syne text-[17px] font-bold truncate mb-1" style={{ color: '#1a1a1a' }}>
                      {col.name}
                    </h3>
                    <p className="text-[11px] font-dmsans mb-1" style={{ color: '#2D6A4F' }}>
                      {col.toolCount} tools
                    </p>
                    <p className="text-[12px] font-dmsans leading-relaxed line-clamp-2 mb-4" style={{ color: '#5a5a5a' }}>
                      {col.description}
                    </p>
                    <div className="flex items-center gap-1">
                      {col.tools.slice(0, 4).map((t, j) => (
                        <div
                          key={j}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 border border-white/40"
                          style={{ backgroundColor: t.color }}
                          title={t.name}
                        >
                          {t.icon || t.name.charAt(0)}
                        </div>
                      ))}
                      {col.toolCount > 4 && (
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: '#F0EDE6', color: '#5a5a5a' }}
                        >
                          +{col.toolCount - 4}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════ RECENT REVIEWS ═══════════════════ */}
        {visibleReviews.length > 0 && (
          <section data-section="reviews" className="pt-8 pb-10">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest" style={{ color: '#5a5a5a' }}>
                Recent Reviews
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleReviews.slice(0, 3).map((review) => (
                <div
                  key={review.id}
                  onClick={() => navigate(`/tool/${hashId(review.toolId)}`)}
                  className="rounded-xl p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0"
                      style={{ backgroundColor: review.toolColor }}
                    >
                      {review.toolIcon || review.toolName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-syne text-[16px] font-bold truncate" style={{ color: '#1a1a1a' }}>
                        {review.toolName}
                      </p>
                      {review.rating > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-[11px] ${s <= Math.round(review.rating) ? '' : 'opacity-20'}`} style={{ color: '#2D6A4F' }}>★</span>
                          ))}
                          <span className="text-[11px] font-dmsans ml-1" style={{ color: '#5a5a5a' }}>{review.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {review.bestFor && (
                    <div className="mb-3">
                      <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#5a5a5a' }}>Best for</p>
                      <p className="text-[13px] font-dmsans leading-relaxed" style={{ color: '#1a1a1a' }}>{review.bestFor}</p>
                    </div>
                  )}
                  {review.gotcha && (
                    <div className="mb-3">
                      <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#5a5a5a' }}>Gotcha</p>
                      <p className="text-[12px] font-dmsans leading-relaxed" style={{ color: '#5a5a5a' }}>{review.gotcha}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#F0EDE6' }}>
                    <span className="text-[11px] font-dmsans" style={{ color: '#5a5a5a' }}>
                      {formatDistanceToNow(review.date, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════ ALTERNATIVES ═══════════════════ */}
        {alternativesCount > 0 && (
          <section className="pt-8 pb-10">
            <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-4" style={{ color: '#5a5a5a' }}>
              Suggested Alternatives — {alternativesCount}
            </p>
            <p className="text-[12px] font-dmsans mb-4" style={{ color: '#5a5a5a' }}>
              This curator suggested {alternativesCount} alternative pairing{alternativesCount > 1 ? 's' : ''}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {alternativesList.slice(0, 9).map((alt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}
                >
                  <span className="text-[13px] font-dmsans font-medium truncate" style={{ color: '#1a1a1a' }}>{alt.toolName}</span>
                  <span className="text-[11px] text-tv-text-m">→</span>
                  <span className="text-[13px] font-dmsans font-medium truncate" style={{ color: '#2D6A4F' }}>{alt.altName}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════ RECENT ACTIVITY ═══════════════════ */}
        {activity.length > 0 && (
          <section className="pt-8 pb-10">
            <p className="text-[10px] font-dmsans font-semibold uppercase tracking-widest mb-6" style={{ color: '#5a5a5a' }}>
              Recent Activity
            </p>
            <div className="max-w-2xl space-y-2.5">
              {activity.slice(0, 6).map((item) => {
                const iconMap: Record<string, { icon: React.ReactNode; label: string }> = {
                  added: { icon: <Plus size={14} />, label: 'Added tool' },
                  published: { icon: <Bookmark size={14} />, label: 'Published collection' },
                  reviewed: { icon: <Star size={14} />, label: 'Reviewed tool' },
                };
                const info = iconMap[item.type] || { icon: <Check size={14} />, label: 'Action' };
                return (
                  <div
                    key={item.type + item.time.toISOString() + item.text}
                    className="flex items-center gap-3.5 px-4 py-3 rounded-lg shadow-sm transition-all hover:shadow-md"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E0D6' }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${ACTIVITY_COLORS[item.type]}15` }}
                    >
                      <span style={{ color: ACTIVITY_COLORS[item.type] }}>{info.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-dmsans leading-snug" style={{ color: '#1a1a1a' }}>
                        <span className="font-medium">{info.label}</span>
                        {item.text.replace(/^(Added tool|Published collection|Reviewed)\s*/, ' ')}
                      </p>
                    </div>
                    <span className="text-[11px] font-dmsans flex-shrink-0" style={{ color: '#5a5a5a' }}>
                      {formatDistanceToNow(item.time, { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {isOwnProfile && (
        <ProfileSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); window.location.reload(); }}
        />
      )}
    </div>
    </>
  );
}
