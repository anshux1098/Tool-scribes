import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCategory, CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';
import { fetchMetadata } from '@/lib/fetchMetadata';
import FocusTrap from '@/components/FocusTrap';

interface AddToolModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (tool: { name: string; url: string; description: string; category: ToolCategory; icon: string; favicon: string; ogImage: string; isFree: boolean; platforms: string[]; signupRequired: boolean }) => void;
}

export default function AddToolModal({ open, onClose, onAdd }: AddToolModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ToolCategory>('ai');
  const [icon, setIcon] = useState('🤖');
  const [favicon, setFavicon] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [fetching, setFetching] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>(['web']);
  const [signupRequired, setSignupRequired] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setUrl(''); setName(''); setDescription(''); setCategory('ai'); setIcon('🤖');
      setFavicon(''); setOgImage(''); setFetching(false);
      setIsFree(true); setPlatforms(['web']); setSignupRequired(false);
    } else {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    setIcon(CATEGORY_EMOJIS[category]);
  }, [category]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try { new URL(url); } catch { return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      const meta = await fetchMetadata(url);
      if (meta) {
        if (meta.favicon) setFavicon(meta.favicon);
        if (meta.ogImage) setOgImage(meta.ogImage);
        if (meta.name && !name) setName(meta.name);
        if (meta.description && !description) setDescription(meta.description);
      }
      setFetching(false);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleSubmit = () => {
    if (!name || !url) return;
    onAdd({ name, url, description, category, icon, favicon, ogImage, isFree, platforms, signupRequired });
    onClose();
  };

  const inputClass = "w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150";
  const labelClass = "block text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="add-tool-title">
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
              className="relative z-10 w-full max-w-[480px] bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
            >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
              <span id="add-tool-title" className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Add tool to vault</span>
              <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* URL with auto-fetch */}
              <div>
                <label className={labelClass}>URL</label>
                <div className="relative">
                  <input
                    ref={urlInputRef}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className={inputClass}
                    aria-label="Tool URL"
                  />
                  {fetching && (
                    <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-tv-text-m" />
                  )}
                </div>
              </div>

              {/* Preview row — shows once metadata arrives */}
              {(favicon || name) && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-s2 border border-tv-border rounded-lg">
                  <div className="w-7 h-7 rounded-lg bg-surface border border-tv-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {favicon ? <img src={favicon} className="w-5 h-5 object-contain" alt="" /> : <span>{icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-[14px] text-tv-text truncate">{name || 'Tool Name'}</p>
                    {ogImage && (
                      <p className="text-[11px] font-mono text-tv-text-m">OG image found ✓</p>
                    )}
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-medium flex-shrink-0"
                    style={{ color: CATEGORY_COLORS[category], background: CATEGORY_BG[category] }}
                  >
                    {CATEGORY_SHORT[category].toUpperCase()}
                  </span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className={labelClass}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Tool name" className={inputClass} />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this tool do?"
                  rows={2}
                  className={inputClass + ' resize-none'}
                />
              </div>

              {/* Category */}
              <div>
                <label className={labelClass}>Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(CATEGORY_LABELS) as [ToolCategory, string][]).map(([key]) => {
                    const isActive = category === key;
                    return (
                      <button type="button"
                        key={key}
                        onClick={() => setCategory(key)}
                        className="px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150"
                        style={isActive
                          ? { color: CATEGORY_COLORS[key], background: CATEGORY_BG[key], borderColor: 'transparent' }
                          : { borderColor: '#E2D9CC', color: '#78716C', background: 'transparent' }
                        }
                      >
                        {CATEGORY_SHORT[key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Features */}
              <div>
                <label className={labelClass}>Features</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="rounded border-tv-border text-tv-primary focus:ring-tv-primary" />
                    <span className="text-[13px] text-tv-text">Free to use</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={signupRequired} onChange={e => setSignupRequired(e.target.checked)} className="rounded border-tv-border text-tv-primary focus:ring-tv-primary" />
                    <span className="text-[13px] text-tv-text">Requires signup</span>
                  </label>
                  <div>
                    <span className="text-[13px] text-tv-text block mb-1">Platforms</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['web', 'mobile', 'desktop', 'cli', 'api'].map(p => (
                        <button type="button"
                          key={p}
                          onClick={() => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 ${
                            platforms.includes(p)
                              ? 'bg-tv-primary-g border-tv-primary text-tv-primary'
                              : 'border-tv-border text-tv-text-s'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-tv-border bg-s2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-[13px] text-tv-text-s hover:text-tv-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name || !url}
                className="px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-tv-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to vault
              </button>
            </div>
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </AnimatePresence>
  );
}
