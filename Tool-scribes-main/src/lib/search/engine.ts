import { SearchFilters, SearchGroupedResults } from './types';

export interface SearchEngine {
  readonly name: string;
  search(filters: SearchFilters): Promise<SearchGroupedResults>;
}
