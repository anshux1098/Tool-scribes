import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import FocusTrap from '@/components/FocusTrap';

interface CreateCollectionModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

export default function CreateCollectionModal({ open, onClose, onCreate }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => { if (open) { setName(''); setDesc(''); } }, [open]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), desc.trim() || undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-collection-title"
        >
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <FocusTrap active={open}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-sm bg-surface border-2 border-tv-border rounded-xl shadow-brutal overflow-hidden"
            >
            <div className="flex items-center justify-between px-5 py-4 border-b border-tv-border">
              <span id="create-collection-title" className="text-[13px] font-mono text-tv-text-m uppercase tracking-widest">New Collection</span>
              <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded-md hover:bg-s2 text-tv-text-s transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Collection name"
                className="w-full h-10 px-3 bg-s2 border border-tv-border rounded-lg text-[14px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                autoFocus
                aria-label="Collection name"
              />
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Description (optional)"
                className="w-full h-10 px-3 bg-s2 border border-tv-border rounded-lg text-[14px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                aria-label="Collection description"
              />
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
              >
                <Plus size={14} />
                Create Collection
              </button>
            </div>
            </motion.div>
          </FocusTrap>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
