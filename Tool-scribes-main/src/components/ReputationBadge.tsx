import { Award } from 'lucide-react';
import { REPUTATION_TIERS } from '@/lib/types';

interface ReputationBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function ReputationBadge({ score, size = 'md' }: ReputationBadgeProps) {
  const tier = REPUTATION_TIERS.find(t => score >= t.min) ?? REPUTATION_TIERS[REPUTATION_TIERS.length - 1];
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-[13px]' : 'text-[11px]';
  const px = size === 'sm' ? 'px-1.5' : 'px-2';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';

  if (tier.label === 'New Curator') {
    return (
      <span className={`inline-flex items-center gap-1 ${px} ${py} rounded-lg bg-s2 border border-tv-border ${textSize} font-mono font-medium text-tv-text-s flex-shrink-0`}>
        <Award size={iconSize} className="text-tv-text-m" />
        {score} pts
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${px} ${py} rounded-lg ${textSize} font-mono font-medium flex-shrink-0`}
      style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.color}20` }}
      title={`${tier.label} — ${score} reputation points`}
    >
      <Award size={iconSize} />
      {tier.label}
    </span>
  );
}
