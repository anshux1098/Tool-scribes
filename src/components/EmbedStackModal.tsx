import { useState, useMemo } from 'react';
import { X, Check, Copy, Code2 } from 'lucide-react';
import { Profile } from '@/lib/types';
import { toast } from 'sonner';

interface EmbedStackModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  shelfTools: { id: string; name: string; icon: string; category?: string }[];
}

export default function EmbedStackModal({ open, onClose, profile, shelfTools }: EmbedStackModalProps) {
  const [embedType, setEmbedType] = useState<'markdown' | 'html' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);

  // Generate self-contained dynamic SVG representation
  const svgDataUrl = useMemo(() => {
    const tools = shelfTools.slice(0, 3);
    const width = 640;
    const height = 190;
    const username = profile.username || 'curator';
    const displayName = profile.displayName || username;

    const cardsSvg = tools.map((t, idx) => {
      const x = 20 + idx * 200;
      return `
        <g transform="translate(${x}, 75)">
          <rect width="190" height="95" rx="10" fill="#FFFFFF" stroke="#E2DDD2" stroke-width="1.2" />
          <text x="16" y="32" font-size="20">${t.icon || '🔧'}</text>
          <text x="46" y="30" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#1A1A1A">${t.name.slice(0, 16)}</text>
          <text x="16" y="58" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" fill="#6B6B6B">Daily Stack Pick</text>
          <rect x="16" y="70" width="60" height="15" rx="4" fill="#F0EDE6" />
          <text x="22" y="81" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="9" font-weight="600" fill="#2D6A4F">CURATED</text>
        </g>
      `;
    }).join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" rx="16" fill="#F0EDE6" stroke="#DCD6C8" stroke-width="1.5" />
        <text x="24" y="36" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#1A1A1A">
          ${displayName.slice(0, 24)}<tspan font-weight="400" font-size="14" fill="#6B6B6B">'s Daily Stack</tspan>
        </text>
        <text x="24" y="54" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11" fill="#2D6A4F" font-weight="600">
          POWERED BY TOOLSCRIBE.COM · @${username}
        </text>
        ${cardsSvg || `<text x="24" y="110" font-family="sans-serif" font-size="13" fill="#6B6B6B">No shelf tools pinned yet</text>`}
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [profile, shelfTools]);

  const targetProfileUrl = `https://tool-scribes-p9lk.vercel.app/u/${profile.username}`;

  const markdownSnippet = `[![${profile.displayName || profile.username}'s Stack on ToolScribe](${svgDataUrl})](${targetProfileUrl})`;
  const htmlSnippet = `<a href="${targetProfileUrl}" target="_blank" rel="noopener noreferrer">\n  <img src="${svgDataUrl}" alt="${profile.displayName || profile.username}'s Stack on ToolScribe" />\n</a>`;

  const currentSnippet = embedType === 'markdown' ? markdownSnippet : htmlSnippet;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    toast.success('Embed snippet copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-tv-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border bg-s2/30">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-tv-primary/10 text-tv-primary">
              <Code2 size={18} />
            </span>
            <h2 className="font-syne font-bold text-lg text-tv-text">Embed My Stack Card</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-tv-text-m hover:text-tv-text hover:bg-s2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-[13px] text-tv-text-s leading-relaxed">
            Showcase your daily-driver tools on your <strong>GitHub README.md</strong>, developer portfolio, or blog.
            It links back to your verified ToolScribe curator profile.
          </p>

          {/* Live Preview Card */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-tv-text-m">Live Preview</label>
            <div className="p-4 bg-s2/50 border border-tv-border rounded-xl flex items-center justify-center overflow-x-auto">
              <img src={svgDataUrl} alt="Embed stack preview" className="max-w-full h-auto rounded-lg shadow-sm" />
            </div>
          </div>

          {/* Format Tabs & Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-s2 p-1 rounded-lg border border-tv-border">
                <button
                  onClick={() => setEmbedType('markdown')}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                    embedType === 'markdown' ? 'bg-surface text-tv-primary shadow-sm font-bold' : 'text-tv-text-m hover:text-tv-text'
                  }`}
                >
                  GitHub Markdown
                </button>
                <button
                  onClick={() => setEmbedType('html')}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                    embedType === 'html' ? 'bg-surface text-tv-primary shadow-sm font-bold' : 'text-tv-text-m hover:text-tv-text'
                  }`}
                >
                  HTML / Website
                </button>
              </div>

              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tv-primary text-white text-xs font-medium rounded-lg hover:bg-tv-primary-dark transition-colors shadow-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>

            <textarea
              readOnly
              rows={4}
              value={currentSnippet}
              className="w-full p-3 font-mono text-xs bg-s2 border border-tv-border rounded-xl text-tv-text focus:outline-none select-all"
            />
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-tv-border bg-s2/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-tv-border rounded-lg text-xs font-medium text-tv-text hover:bg-s2 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
