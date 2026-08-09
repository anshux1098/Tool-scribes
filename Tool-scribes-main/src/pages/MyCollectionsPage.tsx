import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, ExternalLink, Trash2, Edit3, Globe, Lock, Copy, Star, Loader2, Bookmark } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollections } from '@/hooks/useCollections';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';

export default function MyCollectionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { collections, loading, createCollection, renameCollection, deleteCollection, togglePublic, refetch } = useCollections();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [featured, setFeatured] = useState<string | null>(() => { try { return localStorage.getItem('featuredCollection'); } catch { return null; } });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCollection(newName.trim(), newDesc.trim());
    setNewName('');
    setNewDesc('');
    setCreating(false);
    toast.success('Collection created');
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    await renameCollection(id, editName.trim());
    setEditingId(null);
    toast.success('Collection renamed');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteCollection(id);
    toast.success('Collection deleted');
  };

  const handleCopyLink = (uuid: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${uuid}`);
    toast.success('Collection link copied');
  };

  const handleToggleFeatured = (uuid: string) => {
    const next = featured === uuid ? null : uuid;
    setFeatured(next);
    if (next) { try { localStorage.setItem('featuredCollection', next); } catch {} }
    else { try { localStorage.removeItem('featuredCollection'); } catch {} }
    toast.success(featured === uuid ? 'Unfeatured collection' : 'Featured collection set');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[14px] text-tv-text-m font-mono">Sign in to manage your collections.</p>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Collections" description="Manage your curated tool collections on Tool Scribe." path="/collections/me" />
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-[28px] font-bold text-tv-text tracking-tight">My Collections</h1>
            <p className="text-[13px] text-tv-text-s font-mono mt-1">Manage your curated tool collections</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
          >
            <Plus size={15} />
            New Collection
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface border border-tv-border rounded-xl p-6 mb-8 space-y-4"
          >
            <div>
              <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Collection name"
                className="w-full h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="What's this collection about?"
                rows={2}
                className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 text-[13px] text-tv-text-s hover:text-tv-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Collections grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-tv-text-m" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-tv-border rounded-xl">
            <Bookmark size={32} className="mx-auto text-tv-text-s mb-3" />
            <p className="text-[14px] text-tv-text-s font-mono">No collections yet.</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-3 px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
            >
              Create your first collection
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {collections.map((col, i) => {
              const isEditing = editingId === col.id;
              const isFeatured = featured === col._uuid;
              return (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                  className={`bg-surface border rounded-xl p-5 transition-shadow ${
                    isFeatured ? 'border-tv-primary ring-1 ring-tv-primary/20' : 'border-tv-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="h-9 bg-s2 border border-tv-border rounded-lg px-3 text-[15px] text-tv-text font-medium focus:outline-none focus:border-tv-primary transition-colors flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRename(col.id)}
                            className="px-3 py-1.5 bg-tv-primary text-white rounded-lg text-[12px] font-medium hover:bg-tv-primary-dark transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-[12px] text-tv-text-s hover:text-tv-text transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <h3
                            className="text-[17px] font-semibold text-tv-text cursor-pointer hover:text-tv-primary transition-colors"
                            onClick={() => navigate(`/collections/${col.id}`)}
                          >
                            {col.name}
                          </h3>
                          {isFeatured && (
                            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                              <Star size={10} />
                              Featured
                            </span>
                          )}
                        </div>
                      )}
                      {!isEditing && (
                        <p className="text-[13px] text-tv-text-s mt-1 line-clamp-2">{col.description || 'No description'}</p>
                      )}
                      {!isEditing && (
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[11px] font-mono text-tv-text-m">{col.toolCount} tool{col.toolCount !== 1 ? 's' : ''}</span>
                          <span className={`text-[11px] font-mono flex items-center gap-1 ${col.isPublic ? 'text-tv-primary' : 'text-tv-text-s'}`}>
                            {col.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                            {col.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleFeatured(col._uuid)}
                        className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-amber-600 transition-colors"
                        title={isFeatured ? 'Unfeature' : 'Feature on profile'}
                      >
                        <Star size={14} fill={isFeatured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => navigate(`/collections/${col.id}`)}
                        className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors"
                        title="Open collection"
                      >
                        <ExternalLink size={14} />
                      </button>
                      {col.isPublic && (
                        <button
                          onClick={() => handleCopyLink(col._uuid)}
                          className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors"
                          title="Copy share link"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingId(col.id); setEditName(col.name); }}
                        className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors"
                        title="Rename"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => togglePublic(col.id)}
                        className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-primary transition-colors"
                        title={col.isPublic ? 'Make private' : 'Make public'}
                      >
                        {col.isPublic ? <Lock size={14} /> : <Globe size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(col.id, col.name)}
                        className="p-2.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-red-500 transition-colors"
                        title="Delete collection"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
