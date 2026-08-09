import { useNavigate } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { motion } from 'framer-motion';
import { ArrowLeft, Bookmark, RefreshCw, FolderOpen, ExternalLink, Users, Award, Hash } from 'lucide-react';
import { useFollowingFeed } from '@/hooks/useFollowingFeed';
import { CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { hashId } from '@/lib/hashId';

export default function FollowingPage() {
  const navigate = useNavigate();
  const { feed, loading, followingCount, followedCollections, followedCurators, refetch } = useFollowingFeed();

  return (
    <div className="min-h-screen bg-bg">
      {/* Back nav */}
      <div className="max-w-3xl mx-auto px-6 py-4 border-b border-tv-border flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Following Feed</p>
        <h1 className="font-syne text-[40px] text-tv-text leading-tight mb-1">
          From your <em className="not-italic text-tv-primary">curators</em>.
        </h1>
        <p className="text-[13px] text-tv-text-s font-mono mt-2">
          {followingCount + followedCollections.length > 0
            ? `Following ${followingCount} curator${followingCount !== 1 ? 's' : ''} and ${followedCollections.length} collection${followedCollections.length !== 1 ? 's' : ''}`
            : 'Follow curators and collections to see their latest here.'}
        </p>
      </div>

      {loading && feed.length === 0 && followedCollections.length === 0 && followedCurators.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 pb-16">
          <div className="flex flex-col items-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-tv-text-m" />
            <span className="text-[12px] font-mono text-tv-text-m">Loading feed…</span>
          </div>
        </div>
      ) : followingCount + followedCollections.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 pb-16">
          <div className="flex flex-col items-center py-16 text-center">
            <Bookmark size={28} className="text-tv-text-m mb-4" />
            <h3 className="font-syne text-[20px] text-tv-text mb-2">No curators yet</h3>
            <p className="text-[14px] text-tv-text-s max-w-sm mb-6 leading-relaxed">
              Follow curators from their profile pages and collections to see their latest tools and collections here.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
            >
              Browse Discover
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 pb-16 space-y-10">

          {/* ═══ Section 1: Following Collections ═══ */}
          {followedCollections.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-4">
                <Bookmark size={12} className="text-tv-text-m" />
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Following Collections — {followedCollections.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {followedCollections.map((col, i) => (
                  <motion.button
                    key={col._uuid}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    onClick={() => navigate(`/c/${col._uuid}`)}
                    className="flex flex-col items-start gap-2 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                  >
                    <div className="w-9 h-9 rounded-xl bg-tv-primary-g flex items-center justify-center">
                      <span className="text-[14px]">📁</span>
                    </div>
                    <div className="min-w-0 w-full">
                      <h3 className="font-syne text-[15px] text-tv-text leading-tight truncate">{col.name}</h3>
                      <p className="text-[11px] font-mono text-tv-text-s mt-0.5">
                        by{' '}
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/u/${col.curatorUsername}`); }}
                          className="underline underline-offset-2 decoration-dotted hover:text-tv-primary transition-colors"
                        >
                          @{col.curatorUsername || col.curatorDisplayName}
                        </button>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-tv-text-m">
                      <span>{col.toolCount} tool{col.toolCount !== 1 ? 's' : ''}</span>
                      {col.createdAt && (
                        <>
                          <span className="text-tv-border">·</span>
                          <span>followed {formatDistanceToNow(new Date(col.createdAt), { addSuffix: true })}</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Section 2: Following Curators ═══ */}
          {followedCurators.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-4">
                <Users size={12} className="text-tv-text-m" />
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Following Curators — {followedCurators.length}</span>
              </div>
              <div className="space-y-0 border-t border-tv-border">
                {followedCurators.map((curator, i) => (
                  <motion.button
                    key={curator.userId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    onClick={() => navigate(`/u/${curator.username}`)}
                    className="flex items-center gap-4 px-4 py-3.5 border-b border-tv-border w-full text-left hover:bg-[rgba(58,107,82,0.035)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-tv-primary text-white text-[14px] font-syne font-bold flex items-center justify-center flex-shrink-0">
                      {(curator.displayName || curator.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-syne text-[15px] text-tv-text leading-snug truncate">
                        {curator.displayName}
                      </p>
                      {curator.username && (
                        <p className="text-[12px] font-mono text-tv-text-m">@{curator.username}</p>
                      )}
                      {curator.bio && (
                        <p className="text-[12px] text-tv-text-s mt-0.5 line-clamp-1">{curator.bio}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-tv-text-s flex-shrink-0">
                      <span className="flex items-center gap-1">
                        <Award size={11} className="text-tv-primary" />
                        {curator.reputationScore}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        {curator.followerCount}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Section 3: Recent Activity ═══ */}
          {feed.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-4">
                <Hash size={12} className="text-tv-text-m" />
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Recent Activity — {feed.length}</span>
              </div>
              <div className="space-y-0 border-t border-tv-border">
                {feed.map((item, i) => {
                  const curatorLink = item.curatorUsername ? `/u/${item.curatorUsername}` : null;
                  const domain = item.targetUrl ? (() => { try { return new URL(item.targetUrl).hostname.replace('www.', ''); } catch { return ''; } })() : '';

                  if (item.type === 'tool') {
                    const catColor = CATEGORY_COLORS[item.targetCategory as keyof typeof CATEGORY_COLORS] || '#374151';
                    const catBg = CATEGORY_BG[item.targetCategory as keyof typeof CATEGORY_BG] || 'rgba(55,65,81,0.08)';
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        className="flex items-start gap-4 px-4 py-4 border-b border-tv-border group"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-s2 overflow-hidden mt-0.5">
                          {item.targetFavicon ? (
                            <img src={item.targetFavicon} className="w-5 h-5 object-contain" alt="" />
                          ) : (
                            <span className="text-base">🔧</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[12px] text-tv-text-s font-mono">
                              {curatorLink ? (
                                <button
                                  onClick={e => { e.stopPropagation(); navigate(curatorLink); }}
                                  className="hover:text-tv-text transition-colors font-medium"
                                >
                                  {item.curatorDisplayName}
                                </button>
                              ) : (
                                item.curatorDisplayName
                              )}
                            </span>
                            <span className="text-[12px] text-tv-text-m font-mono">added</span>
                            <button
                              onClick={() => navigate(`/tool/${hashId(item.targetId)}`)}
                              className="font-syne text-[16px] text-tv-text leading-snug hover:text-tv-primary transition-colors truncate"
                            >
                              {item.targetName}
                            </button>
                            <span className="text-[11px] text-tv-text-m font-mono hidden sm:inline">{domain}</span>
                            <span className="text-[11px] font-mono text-tv-text-m ml-auto whitespace-nowrap">
                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          {item.targetDescription && (
                            <p className="text-[13px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">
                              {item.targetDescription}
                            </p>
                          )}
                        </div>
                        <span
                          className="hidden md:inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium flex-shrink-0 self-center"
                          style={{ color: catColor, background: catBg }}
                        >
                          {CATEGORY_SHORT[item.targetCategory as keyof typeof CATEGORY_SHORT]?.toUpperCase() || 'TOOL'}
                        </span>
                        <a
                          href={item.targetUrl} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors opacity-0 group-hover:opacity-100 self-center"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.2 }}
                      className="flex items-start gap-4 px-4 py-4 border-b border-tv-border group"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-tv-primary-g mt-0.5">
                        <span className="text-[14px]">📁</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-[12px] text-tv-text-s font-mono">
                            {curatorLink ? (
                              <button
                                onClick={e => { e.stopPropagation(); navigate(curatorLink); }}
                                className="hover:text-tv-text transition-colors font-medium"
                              >
                                {item.curatorDisplayName}
                              </button>
                            ) : (
                              item.curatorDisplayName
                            )}
                          </span>
                          <span className="text-[12px] text-tv-text-m font-mono">published</span>
                          <button
                            onClick={() => navigate(`/c/${item.targetId}`)}
                            className="font-syne text-[16px] text-tv-text leading-snug hover:text-tv-primary transition-colors truncate"
                          >
                            {item.targetName}
                          </button>
                          <span className="text-[11px] font-mono text-tv-text-m ml-auto whitespace-nowrap">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {item.targetDescription && (
                          <p className="text-[13px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">
                            {item.targetDescription}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — following people but no activity */}
          {followingCount > 0 && feed.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <FolderOpen size={28} className="text-tv-text-m mb-4" />
              <h3 className="font-syne text-[20px] text-tv-text mb-2">Nothing yet</h3>
              <p className="text-[14px] text-tv-text-s max-w-sm leading-relaxed">
                Your followed curators haven't added new tools or published collections recently.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
