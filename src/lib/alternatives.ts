import { supabase } from '@/lib/supabase';

export interface Alternative {
  id: string;
  toolId: string;
  alternativeToolId: string;
  votes: number;
  createdBy: string | null;
  createdAt: string;
  approved: boolean;
  /* joined from tools */
  altName: string;
  altIcon: string;
  altFavicon: string;
  altDescription: string;
  altCategory: string;
  altSaveCount: number;
  altAvgRating: number | null;
  votedByMe: boolean;
}

export interface AlternativeSuggestion {
  toolId: string;
  alternativeToolId: string;
  reason: string;
}

export async function fetchAlternatives(toolUuid: string): Promise<Alternative[]> {
  const { data: rows, error } = await supabase
    .from('tool_alternatives')
    .select(`
      id, tool_id, alternative_tool_id, votes, created_by, created_at, approved
    `)
    .eq('tool_id', toolUuid)
    .eq('approved', true)
    .order('votes', { ascending: false });

  if (error || !rows) return [];

  const altIds = rows.map(r => r.alternative_tool_id as string);
  if (altIds.length === 0) return [];

  // Fetch tool details + save counts + ratings
  const { data: tools } = await supabase
    .from('tools')
    .select('id, name, icon, favicon, description, category')
    .in('id', altIds);

  const { data: vaultCounts } = await supabase
    .from('vault_items')
    .select('tool_id')
    .in('tool_id', altIds);

  const { data: reviewData } = await supabase
    .from('reviews')
    .select('tool_id, rating')
    .in('tool_id', altIds)
    .eq('moderation_status', 'active');

  const toolMap = new Map((tools || []).map(t => [t.id, t]));
  const saveCountMap = new Map<string, number>();
  for (const v of (vaultCounts || [])) {
    const tid = v.tool_id as string;
    saveCountMap.set(tid, (saveCountMap.get(tid) || 0) + 1);
  }
  const ratingMap = new Map<string, number[]>();
  for (const r of (reviewData || [])) {
    const tid = r.tool_id as string;
    if (!ratingMap.has(tid)) ratingMap.set(tid, []);
    ratingMap.get(tid)!.push(r.rating as number);
  }

  // Check user votes
  // Only the caller's own votes matter, and only for these alternatives.
  const { data: userVotes } = await supabase
    .from('alternative_votes')
    .select('alternative_id')
    .in('alternative_id', rows.map(r => r.id as string));

  const votedSet = new Set((userVotes || []).map(v => v.alternative_id as string));

  return rows.map(r => {
    const t = toolMap.get(r.alternative_tool_id as string);
    const ratings = ratingMap.get(r.alternative_tool_id as string) || [];
    const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: r.id as string,
      toolId: r.tool_id as string,
      alternativeToolId: r.alternative_tool_id as string,
      votes: (r.votes as number) || 0,
      createdBy: r.created_by as string | null,
      createdAt: r.created_at as string,
      approved: r.approved as boolean,
      altName: t?.name || 'Unknown',
      altIcon: t?.icon || '🔧',
      altFavicon: t?.favicon || '',
      altDescription: t?.description || '',
      altCategory: t?.category || 'util',
      altSaveCount: saveCountMap.get(r.alternative_tool_id as string) || 0,
      altAvgRating: avg,
      votedByMe: votedSet.has(r.id as string),
    };
  });
}

/**
 * Suggests a bidirectional alternative pairing. Both rows are inserted together
 * and are idempotent — re-suggesting an existing pair is a no-op rather than an error.
 *
 * Note: tool_alternatives has no `reason` column, so any caller-supplied
 * rationale is not persisted. Add the column before accepting one.
 */
export async function suggestAlternative(
  toolUuid: string,
  alternativeToolUuid: string,
  userId: string
): Promise<{ error?: string }> {
  // Insert both directions for bidirectional relationship
  const rows = [
    { tool_id: toolUuid, alternative_tool_id: alternativeToolUuid, created_by: userId, approved: false },
    { tool_id: alternativeToolUuid, alternative_tool_id: toolUuid, created_by: userId, approved: false },
  ];

  const { error } = await supabase.from('tool_alternatives').upsert(rows, {
    onConflict: 'tool_id,alternative_tool_id',
    ignoreDuplicates: true,
  });
  if (error) return { error: error.message };
  return {};
}

export async function voteAlternative(alternativeId: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('vote_alternative', { p_alternative_id: alternativeId });
  if (error) return { error: error.message };
  if (!data) return { error: 'Already voted' };
  return {};
}

export async function unvoteAlternative(alternativeId: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('unvote_alternative', { p_alternative_id: alternativeId });
  if (error) return { error: error.message };
  if (!data) return { error: 'Not voted yet' };
  return {};
}

export async function approveAlternative(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('tool_alternatives')
    .update({ approved: true })
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function rejectAlternative(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('tool_alternatives')
    .delete()
    .eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function fetchPendingAlternatives(): Promise<Alternative[]> {
  const { data: rows, error } = await supabase
    .from('tool_alternatives')
    .select(`
      id, tool_id, alternative_tool_id, votes, created_by, created_at, approved
    `)
    .eq('approved', false)
    .order('created_at', { ascending: false });

  if (error || !rows) return [];

  // Deduplicate by tool_id + alternative_tool_id pair (take first occurrence)
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const pair = [r.tool_id, r.alternative_tool_id].sort().join(':');
    if (seen.has(pair)) return false;
    seen.add(pair);
    return true;
  });

  const allIds = [...new Set(unique.flatMap(r => [r.tool_id as string, r.alternative_tool_id as string]))];
  const { data: tools } = await supabase
    .from('tools')
    .select('id, name, icon, favicon')
    .in('id', allIds);

  const toolMap = new Map((tools || []).map(t => [t.id, t]));

  return unique.map(r => {
    const t = toolMap.get(r.tool_id as string);
    const alt = toolMap.get(r.alternative_tool_id as string);
    return {
      id: r.id as string,
      toolId: r.tool_id as string,
      alternativeToolId: r.alternative_tool_id as string,
      votes: (r.votes as number) || 0,
      createdBy: r.created_by as string | null,
      createdAt: r.created_at as string,
      approved: r.approved as boolean,
      altName: alt?.name || 'Unknown',
      altIcon: alt?.icon || '🔧',
      altFavicon: alt?.favicon || '',
      altDescription: '',
      altCategory: 'util',
      altSaveCount: 0,
      altAvgRating: null,
      votedByMe: false,
      /* source tool name for display */
      sourceName: t?.name || 'Unknown',
    } as Alternative & { sourceName: string };
  });
}

export function confidenceLevel(votes: number, saveCount: number, ratingCount: number): { label: string; color: string; bg: string } {
  const score = votes * 3 + saveCount * 1 + ratingCount * 2;
  if (score >= 20) return { label: 'High Confidence', color: '#059669', bg: 'rgba(5,150,105,0.08)' };
  if (score >= 8) return { label: 'Medium Confidence', color: '#D97706', bg: 'rgba(217,119,6,0.08)' };
  return { label: 'Low Confidence', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' };
}

export async function searchToolForAlternative(query: string): Promise<{ id: string; name: string; icon: string; favicon: string; category: string }[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const { data } = await supabase
    .from('tools')
    .select('id, name, icon, favicon, category')
    .ilike('name', `%${q}%`)
    .limit(10);
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    favicon: r.favicon,
    category: r.category,
  }));
}

export async function fetchPopularAlternatives(limit = 6): Promise<{ toolId: string; toolName: string; toolIcon: string; toolFavicon: string; alternatives: { id: string; name: string; votes: number }[] }[]> {
  // Get top tools by upvotes that have approved alternatives
  const { data: altRows } = await supabase
    .from('tool_alternatives')
    .select('tool_id, alternative_tool_id, votes, id')
    .eq('approved', true);

  if (!altRows || altRows.length === 0) return [];

  // Count alternatives per tool (as source)
  const altCountMap = new Map<string, { altId: string; altToolId: string; votes: number }[]>();
  for (const r of altRows) {
    const tid = r.tool_id as string;
    if (!altCountMap.has(tid)) altCountMap.set(tid, []);
    const arr = altCountMap.get(tid)!;
    if (arr.length < 3) arr.push({ altId: r.id as string, altToolId: r.alternative_tool_id as string, votes: (r.votes as number) || 0 });
  }

  const toolIds = [...altCountMap.keys()];
  if (toolIds.length === 0) return [];

  const { data: tools } = await supabase
    .from('tools')
    .select('id, name, icon, favicon, upvotes')
    .in('id', toolIds)
    .order('upvotes', { ascending: false })
    .limit(limit);

  if (!tools) return [];

  const altToolIds = [...new Set(tools.flatMap(t => (altCountMap.get(t.id) || []).map(a => a.altToolId)))];
  const { data: altTools } = await supabase
    .from('tools')
    .select('id, name')
    .in('id', altToolIds);

  const altNameMap = new Map((altTools || []).map(t => [t.id, t.name]));

  return tools.map(t => ({
    toolId: t.id,
    toolName: t.name,
    toolIcon: t.icon,
    toolFavicon: t.favicon,
    alternatives: (altCountMap.get(t.id) || []).map(a => ({
      id: a.altId,
      name: altNameMap.get(a.altToolId) || 'Unknown',
      votes: a.votes,
    })),
  }));
}
