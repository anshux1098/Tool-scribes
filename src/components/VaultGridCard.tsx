import { Star, ExternalLink, Copy, Check, MoreVertical, Trash2, FolderPlus } from 'lucide-react';
import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Tool, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';

interface VaultGridCardProps {
  tool: Tool;
  onToggleFavorite: (id: number) => void;
  onRemoveFromVault: (id: number) => void;
  index: number;
  onSaveToVault?: (id: number) => void;
}

const VaultGridCard = memo(function VaultGridCard({ tool, onToggleFavorite, onRemoveFromVault, index, onSaveToVault }: VaultGridCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const domain = (() => {
    try { return new URL(tool.url).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tool.url).catch((e) => console.error('[VaultGridCard] copy URL failed:', e));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm('Remove this tool from your vault?')) return;
    onRemoveFromVault(tool.id);
    toast('Tool removed from vault', {
      action: { label: 'Undo', onClick: () => onSaveToVault?.(tool.id) },
    });
  };

  const handleVisit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    window.open(tool.url, '_blank', 'noopener,noreferrer');
  };

  const healthIndicator = tool.healthStatus === 'warning' || tool.healthStatus === 'sunset' || tool.healthStatus === 'archived'
    ? { warning: 'bg-amber-500', sunset: 'bg-gray-400', archived: 'bg-red-500' }[tool.healthStatus]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.25 }}
      onClick={() => navigate(`/tool/${tool.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/tool/${tool.id}`); } }}
      className="group relative flex flex-col bg-surface border-2 border-tv-border rounded-xl cursor-pointer transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover shadow-brutal overflow-hidden"
    >
      {/* Header area — logo row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="relative w-9 h-9 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {tool.favicon ? (
            <img src={tool.favicon} loading="lazy" className="w-5.5 h-5.5 object-contain" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-base">{tool.icon}</span>
          )}
          {healthIndicator && (
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${healthIndicator} border-2 border-surface rounded-full`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-syne text-[16px] text-tv-text leading-snug truncate">{tool.name}</h3>
          </div>
          {domain && (
            <p className="text-[11px] font-mono text-tv-text-m truncate mt-0.5">{domain}</p>
          )}
        </div>
        <div className="flex items-center gap-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(tool.id); }}
            className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-yellow-600 transition-colors flex-shrink-0"
          >
            <Star
              size={14}
              fill={tool.isFavorite ? 'currentColor' : 'none'}
              className={tool.isFavorite ? 'text-yellow-500' : ''}
            />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
              className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors flex-shrink-0"
              aria-label="More actions"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-tv-border rounded-lg shadow-brutal z-50 py-1" onClick={e => e.stopPropagation()}>
                <button onClick={handleRemove} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors text-left">
                  <Trash2 size={14} /> Remove From Vault
                </button>
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/tool/${tool.id}`); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-tv-text hover:bg-s2 transition-colors text-left">
                  <FolderPlus size={14} /> Add To Collection
                </button>
                <button onClick={handleVisit} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-tv-text hover:bg-s2 transition-colors text-left">
                  <ExternalLink size={14} /> Visit Tool
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body — description */}
      <div className="px-4 pb-2 flex-1">
        <p className="text-[12px] text-tv-text-s leading-relaxed line-clamp-2">{tool.description}</p>
      </div>

      {/* Footer — category + actions */}
      <div className="flex items-center justify-between px-4 pb-4 pt-1">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium"
          style={{ color: catColor, background: catBg }}
        >
          {CATEGORY_SHORT[tool.category].toUpperCase()}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={copyUrl}
            className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors"
          >
            {copied ? <Check size={13} className="text-tv-primary" /> : <Copy size={13} />}
          </button>
          <a
            href={tool.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </motion.div>
  );
});

export default VaultGridCard;
