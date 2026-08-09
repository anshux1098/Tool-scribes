import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit3, Trash2, Check, X, ExternalLink, Star, Globe, Copy } from 'lucide-react';
import { Tool, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_BG } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface CollectionPageProps {
  tools: Tool[];
  collections: { id: number; name: string; description: string; toolCount: number; updatedAt: number; _uuid: string; isPublic: boolean }[];
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => Promise<boolean>;
  onToggleFavorite: (id: number) => void;
  onRemoveFromCollection: (collectionNumId: number, toolUuid: string) => void;
  onTogglePublic?: (id: number) => void;
}

export default function CollectionPage({
  tools, collections, onRename, onDelete, onToggleFavorite, onRemoveFromCollection, onTogglePublic,
}: CollectionPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const collection = collections.find(c => c.id === Number(id));
  const [editing, setEditing] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [toolUuids, setToolUuids] = useState<string[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!collection) return;
    setLoadingTools(true);
    supabase
      .from('collection_tools')
      .select('tool_id')
      .eq('collection_id', collection._uuid)
      .then(({ data }) => {
        setToolUuids((data ?? []).map(d => d.tool_id as string));
        setLoadingTools(false);
      })
      .catch((e) => { console.error('[CollectionPage] fetch tool IDs failed:', e); setLoadingTools(false); });
  }, [collection?._uuid]);

  const collectionTools = useMemo(() =>
    tools.filter(t => t._uuid && toolUuids.includes(t._uuid)),
    [tools, toolUuids]
  );

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="font-syne text-xl text-tv-text mb-2">Collection not found</h2>
        <button onClick={() => navigate('/')} className="text-tv-primary text-sm hover:underline">← Back to Vault</button>
      </div>
    );
  }

  const handleStartRename = () => {
    setRenameValue(collection.name);
    setEditing(true);
  };

  const handleSaveRename = () => {
    if (renameValue.trim()) onRename(collection.id, renameValue.trim());
    setEditing(false);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    const ok = await onDelete(collection.id);
    if (ok) {
      toast.success('Collection deleted');
      navigate('/');
    } else {
      toast.error('Failed to delete collection');
    }
  };

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/c/${collection._uuid}`;
    navigator.clipboard.writeText(publicUrl).catch((e) => console.error('[CollectionPage] copy link failed:', e));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
    <div className="max-w-3xl mx-auto">
      <div className="px-6 py-4 border-b border-tv-border flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors" title="Copy share link">
            {copied ? <Check size={13} className="text-tv-primary" /> : <Copy size={13} />}
          </button>
          {onTogglePublic && (
            <button
              onClick={() => onTogglePublic(collection.id)}
              className={`p-1.5 rounded-lg transition-colors ${collection.isPublic ? 'text-tv-primary bg-tv-primary-g' : 'text-tv-text-s hover:bg-s2'}`}
              title={collection.isPublic ? 'Make private' : 'Make public'}
            >
              <Globe size={14} />
            </button>
          )}
          <button onClick={handleStartRename} className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors" title="Rename">
            <Edit3 size={14} />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-tv-text-s hover:text-red-600 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="px-6 pt-8 pb-6 border-b border-tv-border">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveRename()}
              className="flex-1 h-10 px-3 bg-s2 border border-tv-border rounded-lg text-[20px] font-syne text-tv-text focus:outline-none focus:border-tv-primary transition-colors"
              autoFocus
            />
            <button onClick={handleSaveRename} className="p-2 rounded-lg bg-tv-primary text-white hover:bg-tv-primary-dark transition-colors">
              <Check size={15} />
            </button>
            <button onClick={() => setEditing(false)} className="p-2 rounded-lg hover:bg-s2 text-tv-text-s transition-colors">
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="font-syne text-[36px] text-tv-text leading-tight">{collection.name}</h1>
            {collection.isPublic && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-tv-primary bg-tv-primary-g border border-tv-primary/20 flex-shrink-0">
                <Globe size={11} />
                Public
              </span>
            )}
          </div>
        )}
        {collection.description && (
          <p className="text-[14px] text-tv-text-s mt-2 leading-relaxed max-w-lg">{collection.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-[13px] text-tv-text-s font-mono">
          <span>{collection.toolCount} {collection.toolCount === 1 ? 'tool' : 'tools'}</span>
          <span className="text-tv-border">·</span>
          <span>updated {formatDistanceToNow(collection.updatedAt, { addSuffix: true })}</span>
        </div>
      </div>

      <div>
        {loadingTools ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-6 py-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : collectionTools.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] text-tv-text-s font-mono mb-2">This collection is empty.</p>
            <p className="text-[12px] text-tv-text-m font-mono">Add tools from the tool detail page.</p>
          </div>
        ) : (
          collectionTools.map((t, i) => {
            const catColor = CATEGORY_COLORS[t.category];
            const catBg = CATEGORY_BG[t.category];
            const domain = (() => { try { return new URL(t.url).hostname.replace('www.', ''); } catch { return t.url; } })();
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="tool-row relative px-6 py-3.5 border-b border-tv-border"
              >
                <Link
                  to={`/tool/${t.id}`}
                  className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-tv-primary focus-visible:ring-inset rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {t.favicon ? <img src={t.favicon} className="w-6 h-6 object-contain" alt="" /> : <span className="text-sm">{t.icon}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-tv-text font-medium truncate">{t.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex-shrink-0" style={{ color: catColor, background: catBg }}>
                        {CATEGORY_LABELS[t.category]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] font-mono text-tv-text-m mt-0.5">
                      <span className="truncate">{domain}</span>
                    </div>
                  </div>
                </Link>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <button
                    onClick={e => { e.stopPropagation(); onToggleFavorite(t.id); }}
                    className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-yellow-600 transition-colors pointer-events-auto"
                  >
                    <Star size={14} fill={t.isFavorite ? 'currentColor' : 'none'} className={t.isFavorite ? 'text-yellow-500' : ''} />
                  </button>
                  <a href={t.url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors pointer-events-auto"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(6px)' }} onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-tv-border rounded-2xl shadow-card p-6">
            <h3 className="font-syne text-[18px] text-tv-text mb-2">Delete this collection?</h3>
            <p className="text-[13px] text-tv-text-s font-mono mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-[13px] font-mono text-tv-text-s hover:text-tv-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-[13px] font-mono text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
  </>
  );
}
