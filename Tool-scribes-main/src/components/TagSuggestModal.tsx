import { useState } from 'react';
import { motion } from 'framer-motion';
import { Hash, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { suggestTag } from '@/lib/tags';
import FocusTrap from '@/components/FocusTrap';

interface TagSuggestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TagSuggestModal({ isOpen, onClose }: TagSuggestModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const ok = await suggestTag(name.trim(), description.trim(), user.id);
    setSubmitting(false);
    if (ok) { setSuccess(true); setTimeout(() => { onClose(); setSuccess(false); setName(''); setDescription(''); }, 1500); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="tag-suggest-title">
      <FocusTrap active={isOpen}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          onClick={e => e.stopPropagation()}
          className="bg-bg border border-tv-border rounded-xl w-full max-w-sm"
        >
        <div className="flex items-center justify-between px-5 py-4 border-b border-tv-border">
          <div className="flex items-center gap-2">
            <Hash size={15} className="text-tv-text" />
            <span id="tag-suggest-title" className="text-[14px] font-mono font-medium text-tv-text">Suggest a Tag</span>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded hover:bg-s2 text-tv-text-s transition-colors">
            <X size={15} />
          </button>
        </div>
        {success ? (
          <div role="status" className="px-5 py-8 text-center text-[14px] font-mono text-green-600">Submitted for review!</div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-[11px] font-mono text-tv-text-s mb-1">Name</label>
              <input
                type="text" required placeholder="e.g. design-tools" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2 text-[13px] font-mono text-tv-text placeholder:text-tv-text-s focus:outline-none focus:border-tv-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-tv-text-s mb-1">Description</label>
              <textarea
                rows={2} placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2 text-[13px] font-mono text-tv-text placeholder:text-tv-text-s focus:outline-none focus:border-tv-primary transition-colors resize-none"
              />
            </div>
            <button
              type="submit" disabled={submitting || !name.trim()}
              className="w-full py-2 rounded-lg bg-tv-primary text-white text-[13px] font-mono font-medium hover:bg-tv-primary-dark transition-colors disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </form>
        )}
        </motion.div>
      </FocusTrap>
    </div>
  );
}
