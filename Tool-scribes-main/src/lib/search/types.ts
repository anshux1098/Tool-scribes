import { ToolCategory } from '@/lib/types';

export type SearchScope = 'vault' | 'community' | 'collections';

export interface SearchFilters {
  query: string;
  category?: ToolCategory | null;
  priceModel?: 'free' | 'freemium' | 'paid' | null;
  isOpenSource?: boolean | null;
  requiresLogin?: boolean | null;
}

export interface SearchResultItem {
  id: number;
  _uuid: string;
  name: string;
  description: string;
  url?: string;
  icon?: string;
  favicon?: string;
  category?: ToolCategory;
  scope: SearchScope;
  matchField?: string;
}

export interface SearchGroupedResults {
  vault: SearchResultItem[];
  community: SearchResultItem[];
  collections: SearchResultItem[];
  total: number;
}
