import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Star, Copy, Check, Tag, X, Send, Loader2 } from 'lucide-react';
import { Tool, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_LABELS } from '@/lib/types';
import { generateSummary } from '@/lib/generateSummary';
import { formatDistanceToNow } from 'date-fns';

interface ToolDetailPageProps {
  tools: Tool[];
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateNotes: (id: number, notes: string) => void;
  onAddTag: (id: number, tag: string) => void;
  onRemoveTag: (id: number, tag: string) => void;
  onRecordVisit: (id: number) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ToolDetailPage({
  tools, onUpvote, onSave, onToggleFavorite, onUpdateNotes, onAddTag, onRemoveTag, onRecordVisit
}: ToolDetailPageProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const tool = tools.find(t => t.id === Number(id));
  const [imageError, setImageError] = useState(false);
  const [notes, setNotes] = useState('');
  const [newTag, setNewTag] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tool) {
      setNotes(tool.notes || '');
      onRecordVisit(tool.id);
    }
  }, [tool?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="font-syne text-xl text-tv-text mb-2">Tool not found</h2>
        <button onClick={() => navigate('/')} className="text-tv-primary text-sm hover:underline">
          ← Back to Vault
        </button>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[tool.category];
  const catBg = CATEGORY_BG[tool.category];
  const domain = (() => { try { return new URL(tool.url).hostname.replace('www.', ''); } catch { return tool.url; } })();
  const summary = generateSummary(tool);

  const handleNotesBlur = () => {
    onUpdateNotes(tool.id, notes);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      onAddTag(tool.id, newTag.trim().toLowerCase());
      setNewTag('');
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(tool.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const systemPrompt = `You are a helpful assistant with deep knowledge about the tool "${tool.name}" (${tool.url}). 
      Description: ${tool.description}
      Category: ${CATEGORY_LABELS[tool.category]}
      Answer questions concisely and helpfully. Focus on practical use cases, tips, and comparisons.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data.content?.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('') || 'Sorry, I could not generate a response.';
      setChatMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back nav */}
      <div className="px-6 py-4 border-b border-tv-border flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s hover:text-tv-text hover:border-tv-border-l transition-colors">
            {copied ? <Check size={13} className="text-tv-primary" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          <a href={tool.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors">
            <ExternalLink size={13} />
            Visit
          </a>
        </div>
      </div>

      <div className="px-6 py-8">
        {/* Tool header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-s2 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {tool.favicon ? (
              <img src={tool.favicon} className="w-8 h-8 object-contain" alt="" />
            ) : (
              <span className="text-2xl">{tool.icon}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-syne text-[28px] text-tv-text leading-tight">{tool.name}</h1>
              <span
                className="px-2 py-0.5 rounded text-[11px] font-mono font-medium"
                style={{ color: catColor, background: catBg }}
              >
                {CATEGORY_LABELS[tool.category].toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[12px] font-mono text-tv-text-m">
              <span>{domain}</span>
              <span>·</span>
              <span>Added {formatDistanceToNow(tool.addedAt, { addSuffix: true })}</span>
              {tool.lastVisited && (
                <>
                  <span>·</span>
                  <span>Visited {formatDistanceToNow(tool.lastVisited, { addSuffix: true })}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => onToggleFavorite(tool.id)}
            className="p-2 rounded-lg hover:bg-s2 text-tv-text-s hover:text-yellow-600 transition-colors"
          >
            <Star size={18} fill={tool.isFavorite ? 'currentColor' : 'none'}
              className={tool.isFavorite ? 'text-yellow-500' : ''} />
          </button>
        </div>

        {/* Screenshot / OG image */}
        {!imageError && (tool.ogImage) && (
          <div className="rounded-xl overflow-hidden mb-6 border border-tv-border" style={{ height: '220px' }}>
            <img
              src={tool.ogImage}
              alt={tool.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Description */}
        <p className="text-[15px] text-tv-text leading-relaxed mb-6">{summary}</p>

        {/* Tags */}
        <div className="mb-6">
          <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {(tool.tags || []).map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-s2 border border-tv-border rounded text-[12px] font-mono text-tv-text-s">
                {tag}
                <button onClick={() => onRemoveTag(tool.id, tag)} className="hover:text-tv-text transition-colors ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="+ add tag"
              className="px-2 py-0.5 bg-transparent border border-dashed border-tv-border rounded text-[12px] font-mono text-tv-text-s placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary w-20"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mb-8">
          <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-2">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add personal notes about this tool…"
            rows={3}
            className="w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary resize-none transition-colors"
          />
        </div>

        {/* AI Chat */}
        <div className="border border-tv-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-tv-border bg-s2 flex items-center gap-2">
            <span className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Ask about {tool.name}</span>
          </div>

          {chatMessages.length > 0 && (
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-tv-primary text-white'
                      : 'bg-s2 border border-tv-border text-tv-text'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-s2 border border-tv-border">
                    <Loader2 size={14} className="animate-spin text-tv-text-s" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          <div className="p-3 flex items-center gap-2 border-t border-tv-border">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder={`What's ${tool.name} best for?`}
              className="flex-1 h-8 px-3 bg-s2 border border-tv-border rounded-lg text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="p-2 rounded-lg bg-tv-primary text-white disabled:opacity-40 hover:bg-tv-primary-dark transition-colors"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


