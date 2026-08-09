import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchFilters, SearchGroupedResults, search } from '@/lib/search';
import { useAuth } from '@/hooks/useAuth';

const DEBOUNCE_MS = 250;

export function useSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const [results, setResults] = useState<SearchGroupedResults>({ vault: [], community: [], collections: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const hasResults = results.total > 0;
  const hasQuery = query.trim().length > 0;

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() && !filters.category) {
      setResults({ vault: [], community: [], collections: [], total: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await search({ ...filters, query: q });
      setResults(res);
    } catch (e) { console.error('[useSearch] search failed:', e);
      setResults({ vault: [], community: [], collections: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, runSearch]);

  const updateCategory = useCallback((category: SearchFilters['category']) => {
    setFilters(prev => ({ ...prev, category }));
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults({ vault: [], community: [], collections: [], total: 0 });
  }, []);

  return {
    query, setQuery, filters, setFilters,
    results, loading, hasResults, hasQuery,
    updateCategory, clearSearch,
  };
}
