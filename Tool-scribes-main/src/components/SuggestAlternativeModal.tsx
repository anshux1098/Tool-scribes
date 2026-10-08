import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { searchToolForAlternative, suggestAlternative } from '@/lib/alternatives';
import { toast } from 'sonner';
import { CATEGORY_LABELS } from '@/lib/types';

interface SuggestAlternativeModalProps {
  open: boolean;
  onClose: () => void;
  toolUuid: string;
  toolName: string;
}

export default function SuggestAlternativeModal({ open, onClose, toolUuid, toolName }: SuggestAlternativeModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; icon: string; favicon: string; category: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedId(null);
      setSelectedName(null);
      setReason('');
      setSubmitted(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim() || selectedId) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      const items = await searchToolForAlternative(query);
      setResults(items.filter(i => i.id !== toolUuid));
    }, 200);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, selectedId, toolUuid]);

  const handleSubmit = async () => {
    if (!user || !selectedId) return;
    setSubmitting(true);
    const { error } = await suggestAlternative(toolUuid, selectedId, user.id);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitted(true);
    toast.success('Alternative suggested! It will appear after review.');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface border border-tv-border rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-tv-border">
          <span className="text-[12px] font-mono text-tv-text-m uppercase tracking-widest">Suggest Alternative</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-s2 transition-colors">
            <X size={14} className="text-tv-text-s" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-tv-primary-g flex items-center justify-center">
              <Check size={20} className="text-tv-primary" />
            </div>
            <p className="text-[14px] font-syne text-tv-text">Alternative suggested!</p>
            <p className="text-[11px] font-mono text-tv-text-s">Your suggestion is pending review and will appear once approved.</p>
            <button onClick={onClose} className="mt-2 px-4 py-1.5 bg-tv-primary text-white text-[12px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-[13px] font-mono text-tv-text">
              What tool is an alternative to <strong>{toolName}</strong>?
            </p>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
              <input
                ref={inputRef}
                value={selectedName ? `Selected: ${selectedName}` : query}
                onChange={e => { if (!selectedId) setQuery(e.target.value); }}
                placeholder="Search tools..."
                disabled={!!selectedId}
                className="w-full pl-9 pr-3 py-2 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors disabled:opacity-50"
              />
              {selectedId && (
                <button
                  onClick={() => { setSelectedId(null); setSelectedName(null); setQuery(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-tv-border transition-colors"
                >
                  <X size={12} className="text-tv-text-m" />
                </button>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && !selectedId && (
              <div className="max-h-48 overflow-y-auto border border-tv-border rounded-lg divide-y divide-tv-border">
                {results.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedId(t.id); setSelectedName(t.name); setResults([]); }}
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-s2 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-s2 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {t.favicon ? <img src={t.favicon} className="w-4 h-4 object-contain" alt="" /> : <span className="text-xs">{t.icon}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-syne text-tv-text truncate">{t.name}</p>
                      <p className="text-[10px] font-mono text-tv-text-m">{CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS] || t.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query && results.length === 0 && !selectedId && (
              <p className="text-[11px] font-mono text-tv-text-s text-center py-4">No tools found. Try a different search.</p>
            )}

            {/* Reason (optional) */}
            <div>
              <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest block mb-1.5">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why is this an alternative?"
                rows={2}
                className="w-full px-3 py-2 bg-s2 border border-tv-border rounded-lg text-[12px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none transition-colors"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] font-mono text-tv-text-s hover:text-tv-text border border-tv-border rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedId || submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-tv-primary text-white text-[12px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors disabled:opacity-40"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                Submit for Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
