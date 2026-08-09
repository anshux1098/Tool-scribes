import { supabase } from '@/lib/supabase';
import { hashId } from '@/lib/hashId';

export interface RecItem {
  id: number;
  _uuid: string;
  name: string;
  icon: string;
  favicon: string;
  description: string;
  category: string;
  reason: string;
  reasonType: string;
}

async function fetchToolDetails(uuids: string[]): Promise<RecItem[]> {
  if (uuids.length === 0) return [];
  const { data } = await supabase
    .from('tools')
    .select('id, name, icon, favicon, description, category')
    .in('id', uuids);
  if (!data) return [];
  return data.map(r => ({
    id: hashId(r.id),
    _uuid: r.id,
    name: r.name,
    icon: r.icon,
    favicon: r.favicon,
    description: r.description,
    category: r.category,
    reason: '',
    reasonType: '',
  }));
}

export async function getToolRecommendations(toolUuid: string, limit = 6): Promise<string[]> {
  const { data } = await supabase.rpc('get_tool_recommendations', {
    p_tool_id: toolUuid,
    p_limit: limit,
  });
  if (!data) return [];
  return data.map((r: { rec_tool_id: string }) => r.rec_tool_id);
}

export async function getVaultRecommendations(userId: string, limit = 12): Promise<{ toolId: string; reasonType: string }[]> {
  const { data } = await supabase.rpc('get_vault_recommendations', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (!data) return [];
  return data.map((r: { rec_tool_id: string; reason_type: string }) => ({
    toolId: r.rec_tool_id,
    reasonType: r.reason_type,
  }));
}

export async function getSimilarCurators(curatorId: string, limit = 4): Promise<{ curatorId: string; sharedFollowers: number }[]> {
  const { data } = await supabase.rpc('get_similar_curators', {
    p_curator_id: curatorId,
    p_limit: limit,
  });
  if (!data) return [];
  return data.map((r: { curator_id: string; shared_followers: number }) => ({
    curatorId: r.curator_id,
    sharedFollowers: r.shared_followers,
  }));
}

export async function getColdStartTrending(limit = 6): Promise<RecItem[]> {
  const { data } = await supabase
    .from('tools')
    .select('id, name, icon, favicon, description, category')
    .order('upvotes', { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data.map(r => ({
    id: hashId(r.id),
    _uuid: r.id,
    name: r.name,
    icon: r.icon,
    favicon: r.favicon,
    description: r.description,
    category: r.category,
    reason: 'Trending now',
    reasonType: 'trending',
  }));
}

export function reasonLabel(reasonType: string): string {
  switch (reasonType) {
    case 'collaborative': return 'Based on tools you saved';
    case 'collection': return 'From collections you follow';
    case 'curator': return 'From curators you follow';
    case 'trending': return 'Trending now';
    default: return 'Recommended';
  }
}

export async function buildToolRecs(toolUuid: string, limit = 6): Promise<RecItem[]> {
  const recUuids = await getToolRecommendations(toolUuid, limit);
  const items = await fetchToolDetails(recUuids.length > 0 ? recUuids : []);
  for (const item of items) {
    item.reason = 'Users who saved this also saved this';
    item.reasonType = 'collaborative';
  }
  if (items.length === 0) {
    const fallback = await getColdStartTrending(limit);
    return fallback;
  }
  return items;
}

export async function buildVaultRecs(userId: string, limit = 12): Promise<RecItem[]> {
  const recs = await getVaultRecommendations(userId, limit);
  const uuids = recs.map(r => r.toolId);
  const items = await fetchToolDetails(uuids);
  const reasonMap = new Map(recs.map(r => [r.toolId, r.reasonType]));
  for (const item of items) {
    item.reasonType = reasonMap.get(item._uuid) || 'trending';
    item.reason = reasonLabel(item.reasonType);
  }
  if (items.length === 0) {
    return getColdStartTrending(limit);
  }
  return items;
}

export async function buildCuratorRecs(curatorId: string, limit = 4): Promise<{ curatorId: string; sharedFollowers: number; username: string; displayName: string; avatarUrl: string; bio: string }[]> {
  const similar = await getSimilarCurators(curatorId, limit);
  if (similar.length === 0) return [];
  const ids = similar.map(s => s.curatorId);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url, bio')
    .in('user_id', ids);
  if (!profiles) return [];
  const profileMap = new Map(profiles.map(p => [p.user_id, p]));
  return similar.map(s => {
    const p = profileMap.get(s.curatorId);
    return {
      curatorId: s.curatorId,
      sharedFollowers: s.sharedFollowers,
      username: p?.username || '',
      displayName: p?.display_name || 'Unknown',
      avatarUrl: p?.avatar_url || '',
      bio: p?.bio || '',
    };
  });
}
