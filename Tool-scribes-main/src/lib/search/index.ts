export type { SearchEngine } from './engine';
export type { SearchFilters, SearchGroupedResults, SearchResultItem, SearchScope } from './types';
export { SimpleSearchEngine } from './simple-engine';

import type { SearchEngine } from './engine';
import type { SearchFilters, SearchGroupedResults } from './types';

let _engine: SearchEngine | null = null;

export function setSearchEngine(engine: SearchEngine) {
  _engine = engine;
}

export function getSearchEngine(): SearchEngine {
  if (!_engine) {
    throw new Error('Search engine not configured. Call setSearchEngine() first.');
  }
  return _engine;
}

export async function search(filters: SearchFilters): Promise<SearchGroupedResults> {
  return getSearchEngine().search(filters);
}
