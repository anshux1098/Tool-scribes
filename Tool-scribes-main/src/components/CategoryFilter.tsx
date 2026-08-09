import { ToolCategory, CATEGORY_COLORS, CATEGORY_BG, CATEGORY_SHORT } from '@/lib/types';

type FilterCategory = ToolCategory | 'all';

interface CategoryFilterProps {
  categories: FilterCategory[];
  activeCategory: FilterCategory | null;
  onChange: (category: FilterCategory) => void;
  counts?: Record<string, number>;
}

export default function CategoryFilter({ categories, activeCategory, onChange, counts }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map(cat => {
        const isActive = activeCategory === cat;
        const color = cat !== 'all' ? CATEGORY_COLORS[cat] : undefined;
        const bg = cat !== 'all' ? CATEGORY_BG[cat] : undefined;
        const count = counts ? counts[cat] ?? 0 : undefined;

        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`px-3 py-2 min-h-[44px] rounded text-[11px] font-mono font-medium uppercase tracking-wide border transition-all duration-150 ${
              isActive
                ? 'border-transparent'
                : 'border-tv-border text-tv-text-s hover:text-tv-text hover:border-tv-border-l bg-surface'
            }`}
            style={isActive ? {
              color: cat === 'all' ? '#fff' : color,
              background: cat === 'all' ? '#1C1917' : bg,
              borderColor: 'transparent',
            } : undefined}
          >
            {cat === 'all' ? 'ALL' : CATEGORY_SHORT[cat]}
            {count !== undefined && count > 0 && (
              <span className="ml-1 opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
