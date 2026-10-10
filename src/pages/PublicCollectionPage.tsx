import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Copy, Check, BookmarkPlus, Globe, Heart, Users, TrendingUp, Clock, Lock, Trash2, Edit3, Camera, X } from 'lucide-react';
import { Tool, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { notifyCollectionFollowed } from '@/lib/notifications';
import { hashId } from '@/lib/hashId';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import ImageCropDialog from '@/components/ImageCropDialog';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';

interface PublicCollectionData {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorUsername: string | null;
  creatorDisplayName: string;
  followerCount: number;
  cloneCount: number;
  viewCount: number;
  isPublic: boolean;
  coverImageUrl?: string;
}

export default function PublicCollectionPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [col, setCol] = useState<PublicCollectionData | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneDone, setCloneDone] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [similarCollections, setSimilarCollections] = useState<{ uuid: string; name: string; toolCount: number; sharedTools: number }[]>([]);
  const [editing, setEditing] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { upload, uploading: coverUploading } = useStorageUpload('collection-covers');
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [showCoverCrop, setShowCoverCrop] = useState(false);

  useEffect(() => {
    if (!uuid || !isSupabaseConfigured) return;
    if (authLoading) return;
    setLoading(true);
    setError(null);
    setSimilarCollections([]);

    Promise.all([
      supabase.from('collections').select('*').eq('id', uuid).single(),
      supabase.from('collection_tools').select('tool_id').eq('collection_id', uuid),
      // get_creator_email is deliberately NOT fetched here. It returned the
      // owner's address to anyone, which was finding #10, and migration
      // 20261010045241 restricts it to the owner and staff. The value was only
      // ever stored on the `col` object and never rendered, so dropping the
      // call loses nothing and stops this firing on every page load.
      supabase.from('collection_followers').select('id', { count: 'exact', head: true }).eq('collection_id', uuid),
      user ? supabase.from('collection_followers').select('id').eq('user_id', user.id).eq('collection_id', uuid).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(async ([colRes, ctRes, countRes, myFollowRes]) => {
      if (colRes.error || !colRes.data) {
        setError('Collection not found.');
        setLoading(false);
        return;
      }
      const data = colRes.data as Record<string, unknown>;
      const creatorId = data.user_id as string;
      if (!data.is_public && user?.id !== creatorId) {
        setError('Collection not found or is not public.');
        setLoading(false);
        return;
      }
      const toolIds = (ctRes.data ?? []).map((r: Record<string, unknown>) => r.tool_id as string);

      setFollowing(!!(myFollowRes as { data: unknown })?.data);
      const followerCount = (countRes as { count: number })?.count ?? 0;
      const cloneCount = (data.clone_count as number) ?? 0;
      const viewCount = (data.view_count as number) ?? 0;

      const { data: profData } = await supabase.from('profiles').select('username, display_name').eq('user_id', creatorId).maybeSingle();
      const creatorUsername = (profData as Record<string, unknown> | null)?.username as string ?? null;
      const creatorDisplayName = (profData as Record<string, unknown> | null)?.display_name as string || creatorUsername || 'Unknown';

      supabase.from('collections').update({ view_count: viewCount + 1 }).eq('id', uuid).then();

      if (toolIds.length === 0) {
        setCol({
          id: data.id as string,
          name: data.name as string,
          description: (data.description as string) ?? '',
          toolCount: 0,
          createdAt: data.created_at as string,
          updatedAt: data.updated_at as string,
          creatorId,
          creatorUsername,
          creatorDisplayName,
          followerCount,
          cloneCount,
          viewCount: viewCount + 1,
          isPublic: data.is_public as boolean,
          coverImageUrl: (data.cover_image_url as string) ?? '',
        });
        setTools([]);
        setLoading(false);
        return;
      }

      supabase.from('tools').select('*').in('id', toolIds).then(toolRes => {
        if (toolRes.data) {
          const mapped: Tool[] = (toolRes.data as Record<string, unknown>[]).map(row => ({
            id: hashId(row.id as string),
            _uuid: row.id as string,
            name: (row.name as string) ?? '',
            url: (row.url as string) ?? '',
            description: (row.description as string) ?? '',
            category: (row.category as Tool['category']) ?? 'util',
            icon: (row.icon as string) ?? '',
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
          setTools(mapped);

          if (toolIds.length > 0) {
            supabase.from('collection_tools')
              .select('collection_id, tool_id')
              .in('tool_id', toolIds)
              .then(({ data: similarCt }) => {
                if (!similarCt) return;
                const shareCount = new Map<string, number>();
                for (const row of similarCt as Array<{ collection_id: string; tool_id: string }>) {
                  if (row.collection_id === uuid) continue;
                  shareCount.set(row.collection_id, (shareCount.get(row.collection_id) || 0) + 1);
                }
                const similarIds = [...shareCount.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([id]) => id);
                if (similarIds.length > 0) {
                  supabase.from('collections')
                    .select('id, name, collection_tools(count)')
                    .eq('is_public', true)
                    .in('id', similarIds)
                    .then(({ data: similarCols }) => {
                      if (!similarCols) return;
                      setSimilarCollections(
                        (similarCols as Array<Record<string, unknown>>).map(r => {
                          const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
                          const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number } | undefined)?.count ?? 0;
                          return {
                            uuid: r.id as string,
                            name: r.name as string,
                            toolCount: countVal,
                            sharedTools: shareCount.get(r.id as string) ?? 0,
                          };
                        })
                      );
                    });
                }
              });
          }
        }
        setCol({
          id: data.id as string,
          name: data.name as string,
          description: (data.description as string) ?? '',
          toolCount: toolIds.length,
          createdAt: data.created_at as string,
          updatedAt: data.updated_at as string,
          creatorId,
          creatorUsername,
          creatorDisplayName,
          followerCount,
          cloneCount,
          viewCount: viewCount + 1,
          isPublic: data.is_public as boolean,
          coverImageUrl: (data.cover_image_url as string) ?? '',
        });
        setLoading(false);
      });
    }).catch((e) => {
      console.error('[PublicCollectionPage] load collection failed:', e);
      setError('Failed to load collection.');
      setLoading(false);
    });
  }, [uuid, user?.id, authLoading]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch((e) => console.warn('[PublicCollectionPage] copy link failed:', e));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClone = async () => {
    if (!user || !uuid || cloning) return;
    setCloning(true);
    // No target_user_id: the RPC derives the owner from the session. It used
    // to accept an owner parameter, so anyone could create collections in
    // another user's account.
    const { error: err } = await supabase.rpc('clone_public_collection', {
      p_source_collection_id: uuid,
    });
    if (err) { setCloning(false); return; }
    setCloneDone(true);
    if (col) setCol({ ...col, cloneCount: col.cloneCount + 1 });
    setCloning(false);
  };

  const handleFollow = async () => {
    if (!user || !uuid || followLoading) return;
    setFollowLoading(true);
    if (following) {
      const { error: err } = await supabase
        .from('collection_followers')
        .delete()
        .eq('user_id', user.id)
        .eq('collection_id', uuid);
      if (!err) { setFollowing(false); setCol(prev => prev ? { ...prev, followerCount: prev.followerCount - 1 } : prev); }
    } else {
      const { error: err } = await supabase
        .from('collection_followers')
        .insert({ user_id: user.id, collection_id: uuid });
      if (!err) {
        setFollowing(true); setCol(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev);
        if (col && col.creatorId !== user.id) {
          supabase.from('profiles').select('display_name, username, avatar_url').eq('user_id', user.id).maybeSingle()
            .then(({ data: me }) => {
              notifyCollectionFollowed(
                col.creatorId,
                user.id,
                (me as Record<string, unknown> | null)?.display_name as string || user.email || 'Someone',
                (me as Record<string, unknown> | null)?.username as string ?? '',
                (me as Record<string, unknown> | null)?.avatar_url as string ?? '',
                col.name,
                uuid,
              );
            });
        }
      }
    }
    setFollowLoading(false);
  };

  const isOwner = user && col && col.creatorId === user.id;

  const handleStartRename = () => {
    if (!col) return;
    setRenameValue(col.name);
    setEditing(true);
  };

  const handleSaveRename = async () => {
    if (!renameValue.trim() || !uuid || !col) return;
    const { error: err } = await supabase
      .from('collections')
      .update({ name: renameValue.trim(), updated_at: new Date().toISOString() })
      .eq('id', uuid);
    if (err) { toast.error('Failed to rename'); return; }
    setCol(prev => prev ? { ...prev, name: renameValue.trim() } : prev);
    setEditing(false);
    toast.success('Renamed');
  };

  const handleTogglePublic = async () => {
    if (!uuid || !col) return;
    const newVal = !col.isPublic;
    setCol(prev => prev ? { ...prev, isPublic: newVal } : prev);
    const { error: err } = await supabase
      .from('collections')
      .update({ is_public: newVal, updated_at: new Date().toISOString() })
      .eq('id', uuid);
    if (err) {
      setCol(prev => prev ? { ...prev, isPublic: !newVal } : prev);
      toast.error('Failed to update visibility');
      return;
    }
    toast.success(newVal ? 'Collection is now public' : 'Collection is now private');
  };

  const handleDeleteCollection = async () => {
    if (!uuid || !col) return;
    setShowDeleteConfirm(false);
    await supabase.from('profiles').update({ featured_collection_id: null }).eq('featured_collection_id', uuid);
    const { error: err } = await supabase.from('collections').delete().eq('id', uuid);
    if (err) { toast.error('Failed to delete'); return; }
    toast.success('Collection deleted');
    navigate('/');
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
    setShowCoverCrop(true);
  };

  const handleCoverCrop = async (blob: Blob) => {
    if (!uuid || !user) return;
    const file = new File([blob], `cover-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const url = await upload(file, user.id + '/' + crypto.randomUUID() + '.jpg');
    setShowCoverCrop(false);
    setCoverPreviewUrl(null);
    if (url) {
      const { error: err } = await supabase
        .from('collections')
        .update({ cover_image_url: url, updated_at: new Date().toISOString() })
        .eq('id', uuid);
      if (err) { toast.error('Failed to save cover'); return; }
      setCol(prev => prev ? { ...prev, coverImageUrl: url } : prev);
      toast.success('Cover updated');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[13px] text-tv-text-s font-mono">Loading collection...</p>
      </div>
    );
  }

  if (error || !col) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center py-24">
        <h2 className="font-syne text-xl text-tv-text mb-2">Collection not found</h2>
        <p className="text-[13px] text-tv-text-s font-mono mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-tv-primary text-sm hover:underline">&larr; Back to Home</button>
      </div>
    );
  }

  const pageTitle = col ? `${col.name} — Collection` : 'Collection';
  const pageDesc = col?.description || 'A curated collection of tools on Tool Scribe.';
  const pageImage = col?.coverImageUrl || undefined;

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDesc}
        image={pageImage}
        path={`/c/${uuid}`}
        type="website"
      />
      <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto">
        <div className="px-6 py-4 border-b border-tv-border flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors">
              {copied ? <Check size={13} className="text-tv-primary" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleTogglePublic}
                  className={'p-1.5 rounded-lg transition-colors ' + (col.isPublic ? 'text-tv-primary bg-tv-primary-g' : 'text-tv-text-s hover:bg-s2')}
                  title={col.isPublic ? 'Make private' : 'Make public'}
                >
                  <Globe size={14} />
                </button>
                <button onClick={handleStartRename} className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors" title="Rename">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-red-50 text-tv-text-s hover:text-red-600 transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {col.coverImageUrl && (
          <div className="w-full h-48 overflow-hidden">
            <img src={col.coverImageUrl} alt={col.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-6 pt-8 pb-6 border-b border-tv-border">
          <div className="flex items-center gap-2 mb-3">
            <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ' + (col.isPublic ? 'text-tv-primary bg-tv-primary-g border-tv-primary/20' : 'text-tv-text-s bg-s2 border-tv-border')}>
              {col.isPublic ? <span className="inline-flex items-center gap-1"><Globe size={11} /> Public</span> : <span className="inline-flex items-center gap-1"><Lock size={11} /> Private</span>}
            </span>
            {isOwner && (
              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-tv-text-s hover:text-tv-text bg-s2 border border-tv-border cursor-pointer hover:border-tv-border-l transition-colors">
                <Camera size={11} />
                {coverUploading ? '...' : 'Cover'}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} disabled={coverUploading} />
              </label>
            )}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
                className="flex-1 h-10 px-3 bg-s2 border border-tv-border rounded-lg text-[20px] font-syne text-tv-text focus:outline-none focus:border-tv-primary transition-colors"
                autoFocus
              />
              <button onClick={handleSaveRename} className="p-2 rounded-lg bg-tv-primary text-white hover:bg-tv-primary-dark transition-colors">
                <Check size={15} />
              </button>
              <button onClick={() => setEditing(false)} className="p-2 rounded-lg hover:bg-s2 text-tv-text-s transition-colors">
                <X size={15} />
              </button>
            </div>
          ) : (
            <h1 className="font-syne text-[36px] text-tv-text leading-tight">{col.name}</h1>
          )}
          {col.description && (
            <p className="text-[14px] text-tv-text-s mt-2 leading-relaxed max-w-lg">{col.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 text-[13px] text-tv-text-s font-mono flex-wrap">
            {col.creatorUsername ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/u/${col.creatorUsername}`); }}
                className="hover:text-tv-primary transition-colors underline underline-offset-2 decoration-dotted"
              >
                by @{col.creatorUsername}
              </button>
            ) : (
              <span>by {col.creatorDisplayName}</span>
            )}
            <span className="text-tv-border">&middot;</span>
            <span>{col.toolCount} {col.toolCount === 1 ? 'tool' : 'tools'}</span>
            <span className="text-tv-border">&middot;</span>
            <span>updated {formatDistanceToNow(new Date(col.updatedAt), { addSuffix: true })}</span>
          </div>

          <div className="flex items-center gap-5 mt-4 text-[12px] font-mono text-tv-text-s flex-wrap">
            <span className="flex items-center gap-1.5">
              <Users size={13} className="text-tv-text-m" />
              <strong className="text-tv-text">{col.followerCount}</strong> {col.followerCount === 1 ? 'follower' : 'followers'}
            </span>
            <span className="flex items-center gap-1.5">
              <Copy size={13} className="text-tv-text-m" />
              <strong className="text-tv-text">{col.cloneCount}</strong> {col.cloneCount === 1 ? 'clone' : 'clones'}
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-tv-text-m" />
              <strong className="text-tv-text">{col.viewCount}</strong> {col.viewCount === 1 ? 'view' : 'views'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-tv-text-m" />
              Created {formatDistanceToNow(new Date(col.createdAt), { addSuffix: true })}
            </span>
          </div>

          {user && (
            <div className="mt-5 flex items-center gap-3">
              {col.creatorId !== user.id && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={'flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ' + (following
                    ? 'border border-tv-border text-tv-text-s hover:bg-s2 hover:text-tv-text'
                    : 'bg-tv-primary text-white hover:bg-tv-primary-dark')}
                >
                  <Heart size={14} fill={following ? 'currentColor' : 'none'} />
                  {followLoading ? '...' : following ? 'Following' : 'Follow'}
                </button>
              )}
              {cloneDone ? (
                <p className="text-[12px] text-tv-primary font-mono">Collection cloned to your vault.</p>
              ) : (
                <button
                  onClick={handleClone}
                  disabled={cloning}
                  className="flex items-center gap-1.5 px-4 py-2 border border-tv-border text-tv-text-s text-[13px] font-medium rounded-lg hover:bg-s2 hover:text-tv-text transition-colors disabled:opacity-40"
                >
                  <BookmarkPlus size={14} />
                  {cloning ? 'Cloning...' : 'Clone'}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          {tools.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] text-tv-text-s font-mono">This collection is empty.</p>
            </div>
          ) : (
            tools.map((t, i) => {
              const catColor = CATEGORY_COLORS[t.category];
              const catBg = CATEGORY_BG[t.category];
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  className="tool-row relative px-6 py-3.5 border-b border-tv-border"
                >
                  <Link
                    to={`/tool/${t.id}`}
                    className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-tv-primary focus-visible:ring-inset rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {t.favicon ? <img src={t.favicon} className="w-6 h-6 object-contain" alt="" /> : <span className="text-sm">{t.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-tv-text font-medium truncate">{t.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex-shrink-0" style={{ color: catColor, background: catBg }}>
                          {CATEGORY_LABELS[t.category]}
                        </span>
                      </div>
                      <p className="text-[12px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">{t.description}</p>
                    </div>
                  </Link>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <a href={t.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors pointer-events-auto"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {similarCollections.length > 0 && (
          <div className="px-6 py-8 border-t border-tv-border">
            <div className="flex items-center gap-1.5 mb-5">
              <TrendingUp size={12} className="text-tv-text-m" />
              <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Similar Collections</span>
            </div>
            <p className="text-[12px] text-tv-text-s font-mono mb-4">People who liked this collection also liked...</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {similarCollections.map((sc, i) => (
                <motion.button
                  key={sc.uuid}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => navigate(`/c/${sc.uuid}`)}
                  className="flex items-center gap-3 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-hover shadow-brutal"
                >
                  <div className="w-10 h-10 rounded-xl bg-tv-primary-g flex items-center justify-center flex-shrink-0">
                    <span className="text-[16px]">{sc.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-syne text-[14px] text-tv-text leading-tight truncate">{sc.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-tv-text-m mt-0.5">
                      <span>{sc.toolCount} tools</span>
                      <span className="text-tv-border">&middot;</span>
                      <span>{sc.sharedTools} shared</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

      {showCoverCrop && coverPreviewUrl && (
        <ImageCropDialog
          open={showCoverCrop}
          onClose={() => { setShowCoverCrop(false); setCoverPreviewUrl(null); }}
          imageUrl={coverPreviewUrl}
          onCrop={handleCoverCrop}
          aspectRatio={16 / 9}
          title="Crop Cover Image"
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-tv-border rounded-2xl shadow-card p-6">
            <h3 className="font-syne text-[18px] text-tv-text mb-2">Delete this collection?</h3>
            <p className="text-[13px] text-tv-text-s font-mono mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-[13px] font-mono text-tv-text-s hover:text-tv-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollection}
                className="px-4 py-2 text-[13px] font-mono text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </>
  );
}
