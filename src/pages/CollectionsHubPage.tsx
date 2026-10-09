import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Sparkles, Clock, Heart, Copy, Plus, Layers, Loader2 } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_SHORT } from '@/lib/types';
import { usePublicCollections, CollectionSort, EnhancedCollection } from '@/hooks/usePublicCollections';
import CollectionCard from '@/components/CollectionCard';

const SORT_OPTIONS: { key: CollectionSort; label: string; icon: typeof TrendingUp }[] = [
  { key: 'trending', label: 'Trending', icon: TrendingUp },
  { key: 'newest', label: 'Newest', icon: Clock },
  { key: 'followers', label: 'Most Followed', icon: Heart },
  { key: 'updated', label: 'Recently Updated', icon: Clock },
  { key: 'clones', label: 'Most Cloned', icon: Copy },
];

export default function CollectionsHubPage() {
  const navigate = useNavigate();
  const {
    collections, featured, trending, loading, error,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    sort, setSort,
    filtered, allCategories, refetch,
  } = usePublicCollections();

  const [showAllFeatured, setShowAllFeatured] = useState(false);
  const displayFeatured = showAllFeatured ? featured : featured.slice(0, 3);

  const sectionDelay = 0.06;

  if (!loading && collections.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
        <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Collections</p>
        <h3 className="font-syne text-[32px] text-tv-text mb-3 leading-tight">
          No collections <em className="not-italic text-tv-primary">yet.</em>
        </h3>
        <p className="text-[14px] text-tv-text-s mb-8 max-w-sm leading-relaxed">
          Create the first collection and start organizing tools for the community.
        </p>
        <button
          onClick={() => navigate('/collections/me')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
        >
          <Plus size={14} /> Create a collection
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pb-24">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pt-12 pb-10 border-b border-tv-border"
      >
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1">Explore</p>
        <h1 className="font-syne text-[48px] sm:text-[56px] text-tv-text leading-[1.05] tracking-tight">
          Curated <em className="not-italic text-tv-primary">Collections.</em>
        </h1>
        <p className="text-[15px] text-tv-text-s mt-3 max-w-lg leading-relaxed">
          Browse collections built by the community. Follow, clone, and discover new tools.
        </p>

        <div className="relative mt-8 max-w-xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-tv-text-m" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search collections by name, description, or curator..."
            className="w-full pl-11 pr-4 py-3 bg-s2 border-2 border-tv-border rounded-xl text-[15px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150"
          />
        </div>
      </motion.section>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-tv-text-m" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-[14px] text-tv-text-s font-mono">{error}</p>
          <button onClick={refetch} className="mt-3 text-[13px] text-tv-primary hover:underline font-mono">
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Featured Collections */}
          {featured.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: sectionDelay }}
              className="py-8 border-b border-tv-border"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-600" />
                  <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Featured Collections</span>
                </div>
                {featured.length > 3 && (
                  <button
                    onClick={() => setShowAllFeatured(!showAllFeatured)}
                    className="text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
                  >
                    {showAllFeatured ? 'Show less' : `View all (${featured.length})`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayFeatured.map((col, i) => (
                  <FeaturedCollectionCard key={col._uuid} collection={col} index={i} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Trending Collections */}
          {trending.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: sectionDelay * 2 }}
              className="py-8 border-b border-tv-border"
            >
              <div className="flex items-center gap-1.5 mb-5">
                <TrendingUp size={12} className="text-tv-text-m" />
                <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Trending Collections</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
                {trending.map((col, i) => (
                  <motion.button
                    key={col._uuid}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    onClick={() => navigate(`/c/${col._uuid}`)}
                    className="flex-shrink-0 w-56 flex flex-col items-start gap-2.5 p-4 bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal"
                  >
                    <span className="text-[32px] font-syne font-bold text-tv-text/10 leading-none select-none">
                      #{i + 1}
                    </span>
                    <h3 className="font-syne text-[15px] text-tv-text leading-tight line-clamp-1">{col.name}</h3>
                    {col.description && (
                      <p className="text-[11px] text-tv-text-s font-mono line-clamp-2 leading-relaxed">{col.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-tv-text-m mt-auto">
                      <span>{col.toolCount} tools</span>
                      {col.followerCount !== undefined && (
                        <>
                          <span className="text-tv-border">·</span>
                          <span className="flex items-center gap-1"><Heart size={10} />{col.followerCount}</span>
                        </>
                      )}
                    </div>
                    {col.curatorUsername && (
                      <p className="text-[10px] font-mono text-tv-text-s">
                        by <span className="underline underline-offset-2 decoration-dotted">@{col.curatorUsername}</span>
                      </p>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.section>
          )}

          {/* All Collections */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: sectionDelay * 3 }}
            className="py-8"
          >
            <div className="flex items-center gap-1.5 mb-5">
              <Layers size={12} className="text-tv-text-m" />
              <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">All Collections</span>
              <span className="text-[10px] font-mono text-tv-text-m">— {filtered.length}</span>
            </div>

            {/* Filters bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                {allCategories.map(cat => {
                  const isActive = categoryFilter === cat;
                  const color = CATEGORY_COLORS[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(isActive ? null : cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition-all duration-150 ${
                        isActive
                          ? 'border-tv-primary bg-tv-primary-g text-tv-primary'
                          : 'border-tv-border text-tv-text-s hover:border-tv-primary hover:text-tv-primary bg-surface'
                      }`}
                      style={isActive ? { borderColor: color, color } : {}}
                    >
                      {CATEGORY_SHORT[cat]}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-surface border border-tv-border rounded-lg p-0.5">
                  {SORT_OPTIONS.map(opt => {
                    const isActive = sort === opt.key;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setSort(opt.key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-mono transition-colors ${
                          isActive
                            ? 'bg-tv-text text-bg'
                            : 'text-tv-text-s hover:text-tv-text'
                        }`}
                        title={opt.label}
                      >
                        <Icon size={11} />
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-[14px] text-tv-text-s font-mono">No collections match your filters.</p>
                <button
                  onClick={() => { setSearch(''); setCategoryFilter(null); }}
                  className="mt-3 text-[13px] text-tv-primary hover:underline font-mono"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((col, i) => (
                  <CollectionCard
                    key={col._uuid}
                    collection={col}
                    index={i}
                    linkTo={`/c/${col._uuid}`}
                  />
                ))}
              </div>
            )}
          </motion.section>
        </>
      )}
    </div>
  );
}

function FeaturedCollectionCard({ collection, index }: { collection: EnhancedCollection; index: number }) {
  const navigate = useNavigate();
  const tools = collection.tools ?? [];
  const toolStrip = tools.slice(0, 6);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => navigate(`/c/${collection._uuid}`)}
      className="group relative flex flex-col overflow-hidden rounded-xl border-2 border-amber-500/30 bg-surface cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal text-left"
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-amber-900/60 to-amber-950/80">
        {collection.coverImageUrl ? (
          <img src={collection.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={40} className="text-amber-400/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-amber-400" />
            <span className="text-[9px] font-mono text-amber-300 uppercase tracking-widest">Featured</span>
          </div>
          <h3 className="font-syne text-[18px] text-white leading-tight">{collection.name}</h3>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2">
        {collection.description && (
          <p className="text-[12px] text-tv-text-s leading-relaxed line-clamp-2">{collection.description}</p>
        )}
        {collection.curatorUsername && (
          <p className="text-[11px] font-mono text-tv-text-s">
            Curated by <span className="underline underline-offset-2 decoration-dotted">@{collection.curatorUsername}</span>
          </p>
        )}
        {toolStrip.length > 0 && (
          <div className="flex items-center gap-1">
            {toolStrip.map((t, i) => (
              <div key={t._uuid || i} className="w-6 h-6 rounded-md bg-s2 flex items-center justify-center overflow-hidden border border-tv-border/30 -ml-1 first:ml-0">
                {t.favicon ? <img src={t.favicon} className="w-3.5 h-3.5 object-contain" alt="" /> : <span className="text-[9px]">{t.icon}</span>}
              </div>
            ))}
            {tools.length > 6 && (
              <span className="text-[9px] font-mono text-tv-text-m ml-1">+{tools.length - 6}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px] font-mono text-tv-text-m mt-1">
          <span>{collection.toolCount} {collection.toolCount === 1 ? 'tool' : 'tools'}</span>
          {collection.followerCount !== undefined && (
            <>
              <span className="text-tv-border">·</span>
              <span className="flex items-center gap-1"><Heart size={10} />{collection.followerCount}</span>
            </>
          )}
        </div>
      </div>
    </motion.button>
  );
}
