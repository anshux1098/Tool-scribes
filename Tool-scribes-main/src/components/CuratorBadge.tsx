import { CURATOR_BADGES, CuratorBadge as CuratorBadgeType } from '@/lib/types';
import { Award } from 'lucide-react';

interface CuratorBadgeProps {
  badge: CuratorBadgeType;
  size?: 'sm' | 'md' | 'lg';
}

export default function CuratorBadge({ badge, size = 'md' }: CuratorBadgeProps) {
  const badgeInfo = CURATOR_BADGES.find(b => b.key === badge);
  if (!badgeInfo || badge === 'none') return null;

  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-[13px]' : 'text-[11px]';
  const px = size === 'sm' ? 'px-1.5' : 'px-2';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 ${px} ${py} rounded-lg ${textSize} font-medium flex-shrink-0`}
      style={{ color: badgeInfo.color, background: badgeInfo.bg, border: `1px solid ${badgeInfo.color}20` }}
      title={badgeInfo.description}
    >
      <Award size={iconSize} />
      {badgeInfo.label}
    </span>
  );
}
