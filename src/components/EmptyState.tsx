import { Plus } from 'lucide-react';

interface EmptyStateProps {
  onAdd: () => void;
  variant?: 'vault' | 'discover';
}

export default function EmptyState({ onAdd, variant = 'vault' }: EmptyStateProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center">
      <p className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest mb-4">
        {variant === 'vault' ? 'Your Collection' : 'Community'}
      </p>
      <h3 className="font-syne text-[32px] text-tv-text mb-3 leading-tight">
        {variant === 'vault' ? (
          <>The <em className="not-italic text-tv-primary">stack</em> awaits.</>
        ) : (
          <>Nothing here <em className="not-italic text-tv-primary">yet.</em></>
        )}
      </h3>
      <p className="text-[14px] text-tv-text-s mb-8 max-w-sm leading-relaxed">
        {variant === 'vault'
          ? 'Add your first tool to start building your personal stack of go-to software.'
          : 'Be the first to submit a tool to the community.'}
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg transition-all duration-150 hover:bg-tv-primary-dark"
      >
        <Plus size={14} />
        {variant === 'vault' ? 'Add your first tool' : 'Submit a tool'}
      </button>
    </div>
  );
}
