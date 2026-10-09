import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Globe, Heart, Copy } from 'lucide-react';
import { Collection } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface CollectionCardProps {
  collection: Collection & { _uuid?: string; coverImageUrl?: string; curatorUsername?: string; curatorName?: string; curatorAvatar?: string; followerCount?: number; cloneCount?: number; viewCount?: number; tools?: { name: string; icon: string; favicon: string; _uuid: string }[] };
  index: number;
  linkTo?: string;
}

function collectionCoverGradient(name: string): string {
  const pairs = [
    ['#3A6B52', '#2D5540'], ['#B45309', '#92400E'], ['#1D4ED8', '#1E40AF'],
    ['#7E22CE', '#6B21A8'], ['#2D6A4F', '#1B4332'], ['#92400E', '#78350F'],
    ['#374151', '#1F2937'], ['#0F766E', '#115E59'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const pair = pairs[Math.abs(h) % pairs.length];
  return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
}

export default function CollectionCard({ collection, index, linkTo }: CollectionCardProps) {
  const navigate = useNavigate();
  const coverUrl = collection.coverImageUrl;
  const tools = collection.tools ?? [];
  const toolStrip = tools.slice(0, 5);

  const handleClick = () => {
    if (linkTo) { navigate(linkTo); return; }
    if (collection._uuid) navigate(`/c/${collection._uuid}`);
    else navigate(`/collections/${collection.id}`);
  };

  const handleCuratorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (collection.curatorUsername) navigate(`/u/${collection.curatorUsername}`);
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={handleClick}
      className="group relative flex flex-col items-start bg-surface border-2 border-tv-border rounded-xl text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal w-full overflow-hidden"
    >
      {coverUrl ? (
        <div className="w-full h-32 overflow-hidden flex-shrink-0">
          <img src={coverUrl} alt={collection.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="w-full h-32 flex items-center justify-center flex-shrink-0 border-b border-tv-border"
          style={{ background: collectionCoverGradient(collection.name) }}
        >
          <span className="text-[36px] font-syne font-bold text-white/30 select-none group-hover:scale-110 transition-transform duration-300">
            {collection.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-4 pb-3 w-full">
        <div className="flex items-center gap-2">
          <h3 className="font-syne text-[16px] text-tv-text leading-tight truncate">
            {collection.name}
          </h3>
          {collection.isPublic && (
            <Globe size={12} className="text-tv-primary flex-shrink-0" />
          )}
        </div>
        {collection.description && (
          <p className="text-[12px] text-tv-text-s line-clamp-2 leading-relaxed">
            {collection.description}
          </p>
        )}
        {(collection.curatorUsername || collection.curatorName) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {collection.curatorAvatar ? (
              <img src={collection.curatorAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-tv-primary flex items-center justify-center text-[8px] text-white font-mono">
                {(collection.curatorName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={handleCuratorClick}
              className="text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors truncate"
            >
              Curated by <span className="underline underline-offset-2 decoration-dotted">@{collection.curatorUsername || collection.curatorName}</span>
            </button>
          </div>
        )}
      </div>
      {toolStrip.length > 0 && (
        <div className="flex items-center gap-1 px-4 pb-2 w-full">
          {toolStrip.map((t, i) => (
            <div key={t._uuid || i} className="w-6 h-6 rounded-md bg-s2 flex items-center justify-center overflow-hidden border border-tv-border/30 -ml-1 first:ml-0">
              {t.favicon ? <img src={t.favicon} className="w-3.5 h-3.5 object-contain" alt="" /> : <span className="text-[9px]">{t.icon}</span>}
            </div>
          ))}
          {tools.length > 5 && (
            <span className="text-[9px] font-mono text-tv-text-m ml-1">+{tools.length - 5}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 text-[11px] font-mono text-tv-text-m px-4 pb-4 w-full flex-wrap">
        <span>{collection.toolCount} {collection.toolCount === 1 ? 'tool' : 'tools'}</span>
        {collection.followerCount !== undefined && (
          <>
            <span className="text-tv-border">·</span>
            <span className="flex items-center gap-1">
              <Heart size={10} />
              {collection.followerCount}
            </span>
          </>
        )}
        {collection.cloneCount !== undefined && collection.cloneCount > 0 && (
          <>
            <span className="text-tv-border">·</span>
            <span className="flex items-center gap-1">
              <Copy size={10} />
              {collection.cloneCount}
            </span>
          </>
        )}
        <span className="text-tv-border">·</span>
        <span>updated {formatDistanceToNow(collection.updatedAt, { addSuffix: true })}</span>
      </div>
    </motion.button>
  );
}
