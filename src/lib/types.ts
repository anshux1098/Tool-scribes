export type ToolCategory = 'ai' | 'dev' | 'design' | 'prod' | 'learn' | 'util';
export type PriceModel = 'free' | 'freemium' | 'paid';

export type HealthStatus = 'active' | 'warning' | 'sunset' | 'archived' | 'unknown';

export interface DustItem {
  id: number;
  toolId: number;
  toolName: string;
  toolUrl: string;
  toolFavicon: string;
  toolCategory: ToolCategory;
  savedAt: number;
  status: 'stale' | 'dismissed';
}

export interface Tool {
  id: number;
  _uuid?: string;
  name: string;
  url: string;
  description: string;
  category: ToolCategory;
  icon: string;
  favicon: string;
  ogImage: string;
  screenshotUrl: string;
  upvotes: number;
  priceModel: PriceModel;
  isOpenSource: boolean;
  requiresLogin: boolean;
  isFree: boolean;
  platforms: string[];
  signupRequired: boolean;
  upvotedByMe: boolean;
  savedToVault: boolean;
  isFavorite: boolean;
  addedAt: number;
  notes?: string;
  tags?: string[];
  lastVisited?: number;
  visitCount?: number;
  healthStatus?: string;
  addedByUsername?: string;
  addedByDisplayName?: string;
  averageRating?: number;
  aiSummary?: string;
  aiProfileGeneratedAt?: string;
  aiProfileVersion?: number;
}

/**
 * The subset of Tool fields a user supplies when submitting a new tool.
 * Everything else is server- or session-derived (identity, counters, vault
 * state) and must never be accepted from client input.
 */
export type NewTool = Pick<
  Tool,
  'name' | 'url' | 'description' | 'category' | 'icon' | 'favicon' | 'ogImage'
> &
  Partial<
    Pick<
      Tool,
      | 'screenshotUrl'
      | 'priceModel'
      | 'isOpenSource'
      | 'requiresLogin'
      | 'isFree'
      | 'platforms'
      | 'signupRequired'
    >
  >;

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

export interface Collection {
  id: number;
  _uuid?: string;
  name: string;
  description: string;
  isPublic: boolean;
  toolCount: number;
  createdAt: number;
  updatedAt: number;
  coverImageUrl?: string;
  followerCount?: number;
  cloneCount?: number;
  viewCount?: number;
  featured?: boolean;
  curatorName?: string;
  curatorUsername?: string;
  curatorAvatar?: string;
  categories?: ToolCategory[];
  tools?: { name: string; icon: string; favicon: string; _uuid: string }[];
}

export interface Review {
  id: number;
  _uuid: string;
  toolId: string;
  userId: string;
  authorDisplayName: string;
  authorUsername: string | null;
  bestFor: string;
  gotcha: string;
  freeTier: string;
  rating: number;
  isMine: boolean;
  moderationStatus: string;
  createdAt: number;
  updatedAt: number;
}

export type CuratorBadge = 'student_builder' | 'ai_curator' | 'learning_explorer' | 'tool_collector' | 'none';

export const CURATOR_BADGES: { key: CuratorBadge; label: string; description: string; color: string; bg: string }[] = [
  { key: 'student_builder', label: 'Student Builder', description: 'Builds with tools, not just collects them', color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  { key: 'ai_curator', label: 'AI Curator', description: 'Specializes in AI and ML tools', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  { key: 'learning_explorer', label: 'Learning Explorer', description: 'Focuses on educational resources', color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  { key: 'tool_collector', label: 'Tool Collector', description: 'Amasses a vast library of tools', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  { key: 'none', label: '', description: '', color: '', bg: '' },
];

export interface Profile {
  id: number;
  _uuid?: string;
  username: string | null;
  displayName: string;
  tagline: string;
  bio: string;
  location: string;
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  avatarUrl: string;
  bannerUrl: string;
  publicProfile: boolean;
  featuredCollectionId: string | null;
  createdAt: string | null;
  curatorBadge: CuratorBadge;
  showReviews: boolean;
  showCollections: boolean;
  showFollowers: boolean;
  reputationScore: number;
  signature_quote: string;
  contact_url: string;
  followerCount: number;
  followingCount: number;
}

export interface ReputationTier {
  min: number;
  label: string;
  color: string;
  bg: string;
}

export const REPUTATION_TIERS: ReputationTier[] = [
  { min: 0, label: 'New Curator', color: '#78716C', bg: 'rgba(120,113,108,0.08)' },
  { min: 25, label: 'Rising Curator', color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  { min: 100, label: 'Trusted Curator', color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  { min: 500, label: 'Expert Curator', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  { min: 1500, label: 'Legendary Curator', color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
];

export const CATEGORY_EMOJIS: Record<ToolCategory, string> = {
  ai: '🤖',
  dev: '⚡',
  design: '🎨',
  prod: '🚀',
  learn: '📚',
  util: '🔧',
};
