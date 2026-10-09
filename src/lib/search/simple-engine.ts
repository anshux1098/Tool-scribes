import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ToolCategory } from '@/lib/types';
import type { SearchEngine } from './engine';
import type { SearchFilters, SearchGroupedResults } from './types';
import { hashId } from '@/lib/hashId';

function escapeLike(val: string): string {
  return val.replace(/[%_\\]/g, '\\$&');
}

function buildTokenizedOrClause(query: string, prefix?: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  const p = prefix ? prefix + '.' : '';
  const clauses: string[] = [];
  for (const token of tokens) {
    const safe = escapeLike(token);
    clauses.push(`${p}name.ilike.%${safe}%`);
    clauses.push(`${p}description.ilike.%${safe}%`);
  }
  return clauses.join(',');
}

type ToolRow = {
  id: string; name: string; description: string; category: string; icon: string; favicon: string; url: string;
};

/** The `tool:tools!inner(...)` embed arrives as a single object, but PostgREST
 * types it as an array because the FK is not statically declared. */
type VaultToolRow = { tool_id: string; tool: ToolRow | ToolRow[] };

function oneTool(embed: ToolRow | ToolRow[] | null | undefined): ToolRow | null {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
}

export class SimpleSearchEngine implements SearchEngine {
  readonly name = 'simple';

  async search(filters: SearchFilters): Promise<SearchGroupedResults> {
    const empty = { vault: [], community: [], collections: [], total: 0 };

    if (!isSupabaseConfigured) return empty;
    if (!filters.query.trim() && !filters.category) return empty;

    const results: SearchGroupedResults = { vault: [], community: [], collections: [], total: 0 };
    const user = (await supabase.auth.getSession()).data.session?.user ?? null;
    const hasQuery = filters.query.trim().length > 0;
    const orClause = hasQuery ? buildTokenizedOrClause(filters.query) : '';
    const orClauseTools = hasQuery ? buildTokenizedOrClause(filters.query, 'tools') : '';

    try {
      if (hasQuery && user) {
        const { data: userCollections } = await supabase
          .from('collections')
          .select('id, name, description')
          .eq('user_id', user.id)
          .or(orClause)
          .limit(5);

        if (userCollections) {
          results.collections = userCollections.map(c => ({
            id: hashId(c.id),
            _uuid: c.id,
            name: c.name,
            description: c.description || '',
            scope: 'collections' as const,
          }));
        }
      }

      if (hasQuery) {
        if (user) {
          let vaultQuery = supabase
            .from('vault_items')
            .select('tool_id, tool:tools!inner(id, name, description, category, icon, favicon, url)')
            .eq('user_id', user.id);

          vaultQuery = vaultQuery.or(orClauseTools);
          if (filters.category) vaultQuery = vaultQuery.eq('tools.category', filters.category);

          const { data: vaultRows } = await vaultQuery.limit(8);
          if (vaultRows) {
            results.vault = (vaultRows as unknown as VaultToolRow[])
            .map(r => {
              const t = oneTool(r.tool);
              return t
                ? {
                    id: hashId(t.id),
                    _uuid: t.id,
                    name: t.name,
                    description: t.description || '',
                    url: t.url,
                    icon: t.icon,
                    favicon: t.favicon,
                    category: t.category as ToolCategory,
                    scope: 'vault' as const,
                  }
                : null;
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);
          }
        }

        let communityQuery = supabase
          .from('tools')
          .select('id, name, description, category, icon, favicon, url');

        communityQuery = communityQuery.or(orClause);
        if (filters.category) communityQuery = communityQuery.eq('category', filters.category);

        const { data: communityRows } = await communityQuery.limit(12);
        if (communityRows) {
          const vaultUuids = new Set(results.vault.map(t => t._uuid));
          results.community = (communityRows as ToolRow[])
            .filter(r => !vaultUuids.has(r.id))
            .map(r => ({
              id: hashId(r.id),
              _uuid: r.id,
              name: r.name,
              description: r.description || '',
              url: r.url,
              icon: r.icon,
              favicon: r.favicon,
              category: r.category as ToolCategory,
              scope: 'community' as const,
            }));
        }
      }

      results.total = results.vault.length + results.community.length + results.collections.length;
      return results;
    } catch (e) {
      console.error('SimpleSearchEngine.search error', e);
      return empty;
    }
  }
}
