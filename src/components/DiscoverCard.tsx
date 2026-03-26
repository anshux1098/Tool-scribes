import { Triangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tool, CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/types';

interface DiscoverCardProps {
  tool: Tool;
  onUpvote: (id: number) => void;
  onSave: (id: number) => void;
}

export default function DiscoverCard({ tool, onUpvote, onSave }: DiscoverCardProps) {
  const catColor = CATEGORY_COLORS[tool.category];
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/tool/${tool.id}`);
  };

  return (
    <div
      className="bg-surface border border-tv-border rounded-xl overflow-hidden transition-all duration-200 hover:border-tv-primary/30 cursor-pointer"
      onClick={handleCardClick}
    >
      {tool.ogImage && (
        <div className="relative h-[200px]">
          <img src={tool.ogImage} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          {tool.favicon ? (
            <img src={tool.favicon} className="w-7 h-7 rounded-full" alt="" />
          ) : (
            <span className="text-xl">{tool.icon}</span>
          )}
          <h3 className="font-syne font-semibold text-[17px] text-tv-text">{tool.name}</h3>
          <span className="ml-auto px-2 py-1 rounded-md text-[11px] font-medium font-dmsans"
            style={{ backgroundColor: `${catColor}1F`, color: catColor }}>
            {CATEGORY_LABELS[tool.category]}
          </span>
        </div>
        <p className="text-tv-text-s text-sm font-dmsans line-clamp-2 mb-4">{tool.description}</p>

        <div className="flex items-center gap-2">
          <button onClick={() => onUpvote(tool.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
              tool.upvotedByMe
                ? 'bg-tv-primary-g border-tv-primary text-tv-primary'
                : 'bg-s2 border-tv-border text-tv-text-s hover:text-tv-text'
            }`}>
            <Triangle size={12} className="fill-current" />
            <span className="tabular-nums">{tool.upvotes}</span>
          </button>

          <a href={tool.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-s2 border border-tv-border rounded-lg text-sm text-tv-text-s hover:text-tv-text transition-colors duration-150">
            <ExternalLink size={14} />
            Visit
          </a>

          <button onClick={() => onSave(tool.id)}
            className={`ml-auto px-4 py-1.5 rounded-lg text-sm font-medium font-dmsans transition-all duration-150 ${
              tool.savedToVault
                ? 'bg-tv-primary-g text-tv-primary'
                : 'bg-tv-primary text-white hover:bg-tv-primary-dark hover:shadow-glow'
            }`}>
            {tool.savedToVault ? 'Saved ✓' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
