import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, X, ExternalLink, ArrowRight } from 'lucide-react';
import { askToolScribe, ToolRecommendation } from '@/lib/ask-toolscribe';
import FocusTrap from '@/components/FocusTrap';
import { CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { hashId } from '@/lib/hashId';

interface AskToolScribeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AskToolScribeModal({ open, onClose }: AskToolScribeModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ToolRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    const res = await askToolScribe(q);
    if (res.error) {
      setError(res.error);
      setResults([]);
    } else {
      setResults(res.recommendations);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleOpenTool = (toolId: string) => {
    onClose();
    navigate(`/tool/${hashId(toolId)}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-labelledby="ask-toolscribe-title">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />
          <FocusTrap active={open}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative z-10 w-full max-w-lg bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-tv-border">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-tv-primary" />
                  <span id="ask-toolscribe-title" className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Ask ToolScribe</span>
                </div>
                <button onClick={onClose} aria-label="Close dialog" className="p-2 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors">
                  <X size={15} />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Best free AI coding assistant"
                    className="flex-1 h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[14px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                    aria-label="Ask about tools"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!query.trim() || loading}
                    className="flex items-center gap-1.5 px-4 h-10 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Ask
                  </button>
                </div>

                {error && (
                  <p role="alert" className="text-[12px] text-red-600 font-mono mt-3">{error}</p>
                )}

                {loading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={18} className="animate-spin text-tv-primary" />
                    <span className="ml-2 text-[13px] font-mono text-tv-text-s">Searching tools...</span>
                  </div>
                )}

                {!loading && hasSearched && results.length === 0 && !error && (
                  <div className="text-center py-10">
                    <p className="text-[13px] font-mono text-tv-text-s">No matching tools found. Try a different query.</p>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest">
                      Recommendations ({results.length})
                    </p>
                    {results.map((r, i) => {
                      const catColor = CATEGORY_COLORS[r.category as keyof typeof CATEGORY_COLORS] || '#374151';
                      const catBg = CATEGORY_BG[r.category as keyof typeof CATEGORY_BG] || 'rgba(55,65,81,0.08)';
                      return (
                        <div
                          key={r.toolId}
                          className="border border-tv-border rounded-xl bg-surface overflow-hidden cursor-pointer hover:border-tv-primary/40 transition-colors"
                          onClick={() => handleOpenTool(r.toolId)}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-s2 border border-tv-border flex items-center justify-center flex-shrink-0 text-lg">
                                {r.icon || '🔧'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[14px] font-syne text-tv-text font-medium truncate">{r.name}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium flex-shrink-0" style={{ color: catColor, background: catBg }}>
                                    {CATEGORY_SHORT[r.category as keyof typeof CATEGORY_SHORT] || r.category}
                                  </span>
                                </div>
                                <p className="text-[12px] text-tv-text-s mt-1.5 leading-relaxed">{r.reason}</p>
                              </div>
                              <ArrowRight size={14} className="text-tv-text-m flex-shrink-0 mt-1" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </AnimatePresence>
  );
}
