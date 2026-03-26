import { ExternalLink, Star, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tool, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';

interface VaultCardProps {
  tool: Tool;
  onToggleFavorite: (id: number) => void;
}

export default function VaultCard({ tool, onToggleFavorite }: VaultCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tool.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/tool/${tool.id}`);
  };

  const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return ''; } })();

  return (
    <div
      className="tool-row flex items-center gap-4 px-4 py-3.5 border-b border-tv-border cursor-pointer group"
      onClick={handleRowClick}
    >
      {/* Favicon */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-s2 overflow-hidden">
        {tool.favicon ? (
          <img src={tool.favicon} className="w-5 h-5 object-contain" alt="" />
        ) : (
          <span className="text-base">{tool.icon}</span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-syne text-[16px] text-tv-text leading-snug">{tool.name}</span>
          <span className="text-[11px] text-tv-text-m font-mono hidden sm:inline">{domain}</span>
        </div>
        <p className="text-[13px] text-tv-text-s leading-snug mt-0.5 line-clamp-1">{tool.description}</p>
      </div>

      {/* Category label */}
      <span
        className="hidden md:inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium flex-shrink-0"
        style={{ color: catColor, background: catBg }}
      >
        {CATEGORY_SHORT[tool.category].toUpperCase()}
      </span>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={copyUrl}
          title="Copy URL"
          className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors"
        >
          {copied ? <Check size={14} className="text-tv-primary" /> : <Copy size={14} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(tool.id); }}
          title={tool.isFavorite ? 'Unfavorite' : 'Favorite'}
          className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-yellow-600 transition-colors"
        >
          <Star size={14} fill={tool.isFavorite ? 'currentColor' : 'none'}
            className={tool.isFavorite ? 'text-yellow-500' : ''} />
        </button>
        <a
          href={tool.url} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-1.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
