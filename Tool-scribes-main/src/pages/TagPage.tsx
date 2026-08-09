import { useState, useEffect } from 'react';
import { SEO } from '@/components/SEO';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Hash, Users, Wrench, Bell, BellOff, ExternalLink } from 'lucide-react';
import { useTag } from '@/lib/tags';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Tool, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { hashId } from '@/lib/hashId';

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tag, loading, toggleSubscribe } = useTag(slug);
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  useEffect(() => {
    if (!tag || !isSupabaseConfigured) { setToolsLoading(false); return; }
    setToolsLoading(true);
    supabase
      .from('tool_tags')
      .select('tool_id')
      .eq('tag_id', tag.id)
      .then(({ data }) => {
        const toolIds = (data ?? []).map(r => r.tool_id as string);
        if (toolIds.length === 0) { setTools([]); setToolsLoading(false); return; }
        supabase.from('tools').select('*').in('id', toolIds).then(({ data: rows }) => {
          const mapped: Tool[] = (rows ?? []).map((r: Record<string, unknown>) => ({
            id: hashId(r.id as string),
            _uuid: r.id as string,
            name: (r.name as string) ?? '',
            url: (r.url as string) ?? '',
            description: (r.description as string) ?? '',
            category: (r.category as Tool['category']) ?? 'util',
            icon: (r.icon as string) ?? '🔧',
            favicon: (r.favicon as string) ?? '',
            ogImage: (r.og_image as string) ?? '',
            upvotes: (r.upvotes as number) ?? 0,
            upvotedByMe: false,
            savedToVault: false,
            isFavorite: false,
            addedAt: new Date(r.created_at as string).getTime(),
          }));
          setTools(mapped);
          setToolsLoading(false);
        });
      });
  }, [tag]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-tv-border border-t-tv-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <Hash size={28} className="text-tv-text-m mb-3" />
        <h2 className="font-syne text-[32px] text-tv-text mb-2">Tag not found</h2>
        <p className="text-[14px] text-tv-text-s mb-6">No tag exists for #{slug}.</p>
        <button onClick={() => navigate('/')} className="text-[13px] text-tv-text-s hover:text-tv-text font-mono transition-colors">
          ← Back home
        </button>
      </div>
    );
  }

  const bg = hexToRgba(tag.color, 0.08);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-4 border-b border-tv-border flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono">
          <ArrowLeft size={14} /> Back
        </button>
        {user && (
          <button
            onClick={toggleSubscribe}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              tag.subscribed
                ? 'border border-tv-border text-tv-text-s hover:bg-s2'
                : 'bg-tv-primary text-white hover:bg-tv-primary-dark'
            }`}
          >
            {tag.subscribed ? <BellOff size={13} /> : <Bell size={13} />}
            {tag.subscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-4">Community Tag</p>
        <div className="flex items-start gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
            <Hash size={20} style={{ color: tag.color }} />
          </div>
          <div>
            <h1 className="font-syne text-[40px] text-tv-text leading-tight" style={{ color: tag.color }}>#{tag.name}</h1>
            {tag.description && <p className="text-[14px] text-tv-text-s mt-1">{tag.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[13px] font-mono text-tv-text-s">
          <span className="flex items-center gap-1.5"><Wrench size={13} />{tag.toolCount} tool{tag.toolCount !== 1 ? 's' : ''}</span>
          <span className="text-tv-border">·</span>
          <span className="flex items-center gap-1.5"><Users size={13} />{tag.subscriberCount} subscriber{tag.subscriberCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16">
        {toolsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-tv-border border-t-tv-primary rounded-full animate-spin" />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Wrench size={24} className="text-tv-text-m mb-3" />
            <p className="text-[14px] text-tv-text-s font-mono">No tools tagged with #{tag.name} yet.</p>
          </div>
        ) : (
          <div className="space-y-0 border-t border-tv-border">
            {tools.map((tool, i) => {
              const catColor = CATEGORY_COLORS[tool.category];
              const catBg = CATEGORY_BG[tool.category];
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  onClick={() => navigate(`/tool/${tool.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/tool/${tool.id}`); } }}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-tv-border cursor-pointer group hover:bg-[rgba(58,107,82,0.035)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {tool.favicon ? <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" /> : <span className="text-base">{tool.icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-syne text-[16px] text-tv-text leading-snug">{tool.name}</span>
                    </div>
                    <p className="text-[13px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">{tool.description}</p>
                  </div>
                  <span className="hidden md:inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium flex-shrink-0" style={{ color: catColor, background: catBg }}>
                    {CATEGORY_SHORT[tool.category].toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono text-tv-text-m flex-shrink-0">
                    {formatDistanceToNow(tool.addedAt, { addSuffix: true })}
                  </span>
                  <a href={tool.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors opacity-0 group-hover:opacity-100">
                    <ExternalLink size={14} />
                  </a>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(107,114,128,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}
