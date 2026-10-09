import { HealthStatus, HEALTH_LABELS, HEALTH_COLORS, HEALTH_BG } from '@/lib/health';

interface ToolHealthBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md';
}

export default function ToolHealthBadge({ status, size = 'sm' }: ToolHealthBadgeProps) {
  if (status === 'unknown') return null;

  const color = HEALTH_COLORS[status];
  const bg = HEALTH_BG[status];
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${textSize} font-mono font-medium flex-shrink-0`}
      style={{ color, background: bg }}
    >
      <span className={`${dotSize} rounded-full`} style={{ backgroundColor: color }} />
      {HEALTH_LABELS[status]}
    </span>
  );
}
