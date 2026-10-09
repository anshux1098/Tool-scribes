import { motion } from 'framer-motion';
import { ExternalLink, Trash2, Clock, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DustTool } from '@/hooks/useDustCollector';
import { CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface VaultDustSectionProps {
  dustTools: DustTool[];
  loading: boolean;
  onDismiss: (toolId: number) => void;
  onRemove: (toolId: number) => void;
}

export default function VaultDustSection({ dustTools, loading, onDismiss, onRemove }: VaultDustSectionProps) {
  const navigate = useNavigate();

  if (loading) return null;
  if (dustTools.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 px-6 mb-4">
        <Clock size={12} className="text-tv-text-m" />
        <span className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Rediscover These Tools</span>
        <span className="text-[10px] font-mono text-tv-text-s">— {dustTools.length}</span>
      </div>

      <div className="max-w-3xl mx-auto px-6">
        <p className="text-[12px] font-mono text-tv-text-s mb-4">
          Tools you saved more than 30 days ago but haven't visited yet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dustTools.map((tool, i) => {
            const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return tool.url; } })();
            const catColor = CATEGORY_COLORS[tool.category];
            const catBg = CATEGORY_BG[tool.category];

            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="bg-surface border border-tv-border rounded-xl overflow-hidden group"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl bg-s2 border border-tv-border flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/tool/${tool.id}`)}
                    >
                      {tool.favicon ? (
                        <img src={tool.favicon} className="w-7 h-7 object-contain" alt="" />
                      ) : (
                        <span className="text-sm">🔧</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-syne text-[14px] text-tv-text truncate cursor-pointer hover:text-tv-primary transition-colors"
                          onClick={() => navigate(`/tool/${tool.id}`)}
                        >
                          {tool.name}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium flex-shrink-0"
                          style={{ color: catColor, background: catBg }}
                        >
                          {CATEGORY_SHORT[tool.category]}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-tv-text-s mt-0.5 truncate">{domain}</p>
                      <p className="text-[10px] font-mono text-tv-text-m mt-1.5 flex items-center gap-1">
                        <Clock size={10} />
                        Saved {formatDistanceToNow(tool.savedAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-tv-border flex items-center gap-2">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-tv-primary text-white rounded-lg text-[11px] font-medium hover:bg-tv-primary-dark transition-colors"
                    >
                      <ExternalLink size={11} />
                      Visit
                    </a>
                    <button
                      onClick={() => onDismiss(tool.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-tv-border rounded-lg text-[11px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors"
                    >
                      <EyeOff size={11} />
                      Dismiss
                    </button>
                    <button
                      onClick={() => onRemove(tool.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-tv-border rounded-lg text-[11px] text-tv-text-s hover:text-red-600 hover:border-red-300 transition-colors ml-auto"
                    >
                      <Trash2 size={11} />
                      Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
