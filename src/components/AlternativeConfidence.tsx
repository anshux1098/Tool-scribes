import { confidenceLevel } from '@/lib/alternatives';

interface AlternativeConfidenceProps {
  votes: number;
  saveCount: number;
  ratingCount: number;
}

export default function AlternativeConfidence({ votes, saveCount, ratingCount }: AlternativeConfidenceProps) {
  const conf = confidenceLevel(votes, saveCount, ratingCount);
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-medium flex-shrink-0"
      style={{ color: conf.color, background: conf.bg }}
    >
      {conf.label}
    </span>
  );
}
