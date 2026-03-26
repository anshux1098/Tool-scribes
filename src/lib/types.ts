export type ToolCategory = 'ai' | 'dev' | 'design' | 'prod' | 'learn' | 'util';

export interface Tool {
  id: number;
  name: string;
  url: string;
  description: string;
  category: ToolCategory;
  icon: string;
  favicon: string;
  ogImage: string;
  upvotes: number;
  upvotedByMe: boolean;
  savedToVault: boolean;
  isFavorite: boolean;
  addedAt: number;
  notes?: string;
  tags?: string[];
  lastVisited?: number;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  ai: 'AI Tools',
  dev: 'Dev Tools',
  design: 'Design',
  prod: 'Productivity',
  learn: 'Learning',
  util: 'Utilities',
};

export const CATEGORY_SHORT: Record<ToolCategory, string> = {
  ai: 'AI',
  dev: 'Dev',
  design: 'Design',
  prod: 'Prod',
  learn: 'Learn',
  util: 'Util',
};

// Warm, editorial category colors — used only on labels
export const CATEGORY_COLORS: Record<ToolCategory, string> = {
  ai: '#B45309',
  dev: '#1D4ED8',
  design: '#7E22CE',
  prod: '#2D6A4F',
  learn: '#92400E',
  util: '#374151',
};

export const CATEGORY_BG: Record<ToolCategory, string> = {
  ai: 'rgba(180,83,9,0.08)',
  dev: 'rgba(29,78,216,0.08)',
  design: 'rgba(126,34,206,0.08)',
  prod: 'rgba(45,106,79,0.08)',
  learn: 'rgba(146,64,14,0.08)',
  util: 'rgba(55,65,81,0.08)',
};

export const CATEGORY_EMOJIS: Record<ToolCategory, string> = {
  ai: '🤖',
  dev: '⚡',
  design: '🎨',
  prod: '🚀',
  learn: '📚',
  util: '🔧',
};
