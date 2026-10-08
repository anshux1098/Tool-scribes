import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Link, ExternalLink, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolCategory, CATEGORY_LABELS, CATEGORY_SHORT, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { fetchAndSuggest, checkDuplicate, submitTool, DuplicateResult } from '@/lib/submission';
import { captureScreenshot } from '@/lib/screenshot';
import { supabase } from '@/lib/supabase';
import FocusTrap from '@/components/FocusTrap';

type Step = 'url' | 'fetching' | 'preview' | 'submitted';

interface SubmitToolModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SubmitToolModal({ open, onClose }: SubmitToolModalProps) {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ToolCategory>('ai');
  const [favicon, setFavicon] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>(['web']);
  const [signupRequired, setSignupRequired] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep('url'); setUrl(''); setTitle(''); setDescription('');
      setCategory('ai'); setFavicon(''); setOgImage('');
      setFetchError(null); setDuplicate(null); setSubmitting(false);
      setSubmitError(null); setIsFree(true); setPlatforms(['web']); setSignupRequired(false);
      setScreenshotUrl(null); setScreenshotUploading(false);
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleFetch = async () => {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
      setUrl(normalizedUrl);
    }
    try { new URL(normalizedUrl); } catch {
      setFetchError('Please enter a valid URL.');
      return;
    }
    setStep('fetching');
    setFetchError(null);
    setDuplicate(null);

    const dup = await checkDuplicate(normalizedUrl);
    setDuplicate(dup);

    const meta = await fetchAndSuggest(normalizedUrl);
    if (meta) {
      setTitle(meta.title);
      setDescription(meta.description);
      setFavicon(meta.favicon);
      setOgImage(meta.ogImage);
      setCategory(meta.suggestedCategory);
    }

    const ss = await captureScreenshot(normalizedUrl);
    setScreenshotUrl(ss);

    setStep('preview');
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotUploading(true);
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) { setScreenshotUploading(false); return; }
    const ext = file.name.split('.').pop() || 'png';
    const filename = `screenshots/${userId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('screenshots').upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error || !data) { setScreenshotUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(data.path);
    setScreenshotUrl(publicUrl);
    setScreenshotUploading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitTool({
      url: url.trim(),
      title: title.trim(),
      description: description.trim(),
      category,
      icon: CATEGORY_EMOJIS[category],
      favicon,
      ogImage,
      isFree,
      platforms,
      signupRequired,
      screenshotUrl: screenshotUrl ?? undefined,
    });
    if (result.error) {
      setSubmitError(result.error);
      setSubmitting(false);
    } else {
      setStep('submitted');
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150";
  const labelClass = "block text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="submit-tool-title">
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
              className="relative z-10 w-full max-w-[480px] bg-surface border border-tv-border rounded-2xl shadow-card flex flex-col max-h-[85vh]"
            >
            <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border flex-shrink-0">
              <span className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">
                {step === 'submitted' ? 'Submitted' : 'Submit a tool'}
              </span>
              <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors">
                <X size={16} />
              </button>
            </div>

            {step === 'url' && (
              <div className="px-6 py-8 overflow-y-auto flex-1">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-tv-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Link size={22} className="text-tv-primary" />
                  </div>
                  <h2 id="submit-tool-title" className="font-syne text-[20px] text-tv-text mb-1">Submit a tool</h2>
                  <p className="text-[12px] text-tv-text-s font-mono">Paste a URL and we'll fetch the details automatically.</p>
                </div>
                <div className="relative">
                  <input
                    ref={urlInputRef}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleFetch(); }}
                    placeholder="https://example.com"
                    className={inputClass + ' pr-10 text-[14px]'}
                    aria-label="Tool URL"
                  />
                  {url && (
                    <button
                      onClick={() => setUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-tv-text-m hover:text-tv-text"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {fetchError && (
                  <p role="alert" className="text-[11px] text-red-600 font-mono mt-2">{fetchError}</p>
                )}
                <div className="flex items-center justify-end gap-2 mt-5">
                  <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-tv-text-s hover:text-tv-text transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleFetch}
                    disabled={!url.trim()}
                    className="px-5 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-tv-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Fetch metadata
                  </button>
                </div>
              </div>
            )}

            {step === 'fetching' && (
              <div className="px-6 py-12 text-center overflow-y-auto flex-1">
                <Loader2 size={22} className="animate-spin text-tv-primary mx-auto mb-3" />
                <p className="text-[13px] text-tv-text font-mono">Fetching metadata...</p>
                <p className="text-[11px] text-tv-text-s font-mono mt-1">Checking for duplicates.</p>
              </div>
            )}

            {step === 'preview' && (
              <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {duplicate?.isDuplicate && duplicate.tool && (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-medium text-amber-800 font-mono">Duplicate detected</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        This domain matches <strong>{duplicate.tool.name}</strong>.
                        {' '}{duplicate.tool.url && (
                          <a href={duplicate.tool.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                            View <ExternalLink size={10} />
                          </a>
                        )}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-1">You can still submit if this is a different tool on the same domain.</p>
                    </div>
                  </div>
                )}

                {/* Preview card */}
                <div className="flex items-center gap-3 p-3.5 bg-s2 border border-tv-border rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-surface border border-tv-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {favicon ? <img src={favicon} className="w-7 h-7 object-contain" alt="" /> : <span className="text-lg">🔧</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-syne text-[15px] text-tv-text truncate">{title || 'Tool name'}</p>
                    <p className="text-[11px] text-tv-text-s font-mono truncate">{url}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-medium flex-shrink-0"
                    style={{ color: CATEGORY_COLORS[category], background: CATEGORY_BG[category] }}
                  >
                    {CATEGORY_SHORT[category]}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <label className={labelClass}>Name</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSubmit(); }} placeholder="Tool name" className={inputClass} />
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

                {/* Screenshot */}
                <div>
                  <label className={labelClass}>Screenshot</label>
                  {screenshotUrl ? (
                    <img src={screenshotUrl} alt="Tool screenshot" className="w-full h-32 object-cover rounded-lg border border-tv-border" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={screenshotUploading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-mono border border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-text-s transition-colors disabled:opacity-40"
                      >
                        {screenshotUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {screenshotUploading ? 'Uploading...' : 'Upload screenshot'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleScreenshotUpload}
                      />
                    </div>
                  )}
                </div>

                {ogImage && (
                  <div>
                    <label className={labelClass}>OG Image</label>
                    <img src={ogImage} alt="" className="w-full h-32 object-cover rounded-lg border border-tv-border" />
                  </div>
                )}

                {submitError && (
                  <p role="alert" className="text-[11px] text-red-600 font-mono">{submitError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] text-tv-text-s hover:text-tv-text transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !title.trim()}
                    className="flex items-center gap-1.5 px-5 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-tv-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    Submit for review
                  </button>
                </div>
              </form>
            )}

            {step === 'submitted' && (
              <div className="px-6 py-10 text-center overflow-y-auto flex-1">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <h2 className="font-syne text-[20px] text-tv-text mb-1">Submitted!</h2>
                <p className="text-[12px] text-tv-text-s font-mono mb-6 max-w-xs mx-auto">
                  Your tool has been submitted for review. We'll notify you once it's approved.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
                >
                  Done
                </button>
              </div>
            )}
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </AnimatePresence>
  );
}

const CATEGORY_EMOJIS: Record<ToolCategory, string> = {
  ai: '🤖', dev: '⚡', design: '🎨', prod: '🚀', learn: '📚', util: '🔧',
};
