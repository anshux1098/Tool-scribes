import { useNavigate } from 'react-router-dom';
import { Hash } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  slug?: string;
  color?: string;
  size?: 'sm' | 'md';
  clickable?: boolean;
  onRemove?: () => void;
}

export default function TagBadge({ name, slug, color = '#6B7280', size = 'sm', clickable = true, onRemove }: TagBadgeProps) {
  const navigate = useNavigate();
  const px = size === 'sm' ? 'px-1.5' : 'px-2.5';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-[12px]';
  const bg = `rgba(${hexToRgb(color)},0.08)`;

  const inner = (
    <span
      className={`inline-flex items-center gap-1 ${px} ${py} rounded ${textSize} font-mono font-medium transition-colors`}
      style={{ color, background: bg }}
    >
      <Hash size={size === 'sm' ? 9 : 11} />
      {name}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:opacity-60">
          ×
        </button>
      )}
    </span>
  );

  if (clickable && slug) {
    return (
      <button onClick={() => navigate(`/tag/${slug}`)} className="hover:opacity-80 transition-opacity">
        {inner}
      </button>
    );
  }

  return inner;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '107,114,128';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
