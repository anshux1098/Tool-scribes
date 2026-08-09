import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';
import { Collection } from '@/lib/types';
import FocusTrap from '@/components/FocusTrap';

interface AddToCollectionModalProps {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  collectionIds: number[];
  onAddToCollection: (collectionId: number) => void;
  onRemoveFromCollection: (collectionId: number) => void;
  onCreateCollection: (name: string, description?: string) => void;
}

export default function AddToCollectionModal({
  open, onClose, collections, collectionIds,
  onAddToCollection, onRemoveFromCollection, onCreateCollection,
}: AddToCollectionModalProps) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    if (open) { setNewName(''); setNewDesc(''); }
  }, [open]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection(newName.trim(), newDesc.trim() || undefined);
    setNewName('');
    setNewDesc('');
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
          aria-labelledby="add-to-collection-title"
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
              <span id="add-to-collection-title" className="text-[13px] font-mono text-tv-text-m uppercase tracking-widest">Add to Collection</span>
              <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded-md hover:bg-s2 text-tv-text-s transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-64 overflow-y-auto space-y-1">
              {collections.length === 0 && (
                <p className="text-[12px] text-tv-text-s font-mono py-2 text-center">No collections yet.</p>
              )}
              {collections.map(col => {
                const isIn = collectionIds.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => isIn ? onRemoveFromCollection(col.id) : onAddToCollection(col.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-s2 transition-colors text-left"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isIn
                        ? 'bg-tv-primary border-tv-primary text-white'
                        : 'border-tv-border'
                    }`}>
                      {isIn && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-tv-text truncate">{col.name}</p>
                      <p className="text-[11px] text-tv-text-m font-mono">{col.toolCount} tools</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-tv-border space-y-2.5">
              <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">New collection</p>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Collection name"
                className="w-full h-9 px-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                aria-label="New collection name"
              />
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Description (optional)"
                className="w-full h-9 px-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                aria-label="New collection description"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex items-center justify-center gap-1.5 w-full py-2 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
              >
                <Plus size={13} />
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
