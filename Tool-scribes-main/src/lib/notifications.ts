import { supabase, isSupabaseConfigured } from '@/lib/supabase';

async function createNotification(params: {
  userId: string;
  type: string;
  actorId: string | null;
  actorName: string;
  actorUsername: string;
  actorAvatarUrl: string;
  targetId?: string;
  targetName?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured) return;
  await supabase.rpc('create_notification', {
    p_user_id: params.userId,
    p_type: params.type,
    p_actor_id: params.actorId,
    p_actor_name: params.actorName,
    p_actor_username: params.actorUsername,
    p_actor_avatar_url: params.actorAvatarUrl,
    p_target_id: params.targetId ?? '',
    p_target_name: params.targetName ?? '',
    p_target_type: params.targetType ?? '',
    p_metadata: params.metadata ?? {},
  });
}

export async function notifyNewFollower(followedUserId: string, actorId: string, actorName: string, actorUsername: string, actorAvatarUrl: string) {
  await createNotification({
    userId: followedUserId,
    type: 'new_follower',
    actorId,
    actorName,
    actorUsername,
    actorAvatarUrl,
  });
}

export async function notifyCollectionFollowed(ownerId: string, actorId: string, actorName: string, actorUsername: string, actorAvatarUrl: string, collectionName: string, collectionId: string) {
  await createNotification({
    userId: ownerId,
    type: 'collection_followed',
    actorId,
    actorName,
    actorUsername,
    actorAvatarUrl,
    targetId: collectionId,
    targetName: collectionName,
    targetType: 'collection',
  });
}

export async function notifyNewReview(actorId: string, actorName: string, actorUsername: string, actorAvatarUrl: string, toolName: string, toolId: string) {
  if (!isSupabaseConfigured) return;
  const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', actorId);
  if (!followers) return;
  for (const f of followers as Array<{ follower_id: string }>) {
    if (f.follower_id !== actorId) {
      await createNotification({
        userId: f.follower_id,
        type: 'new_review',
        actorId,
        actorName,
        actorUsername,
        actorAvatarUrl,
        targetId: toolId,
        targetName: toolName,
        targetType: 'review',
      });
    }
  }
}

export async function notifyNewCollection(userId: string, actorName: string, actorUsername: string, actorAvatarUrl: string, collectionName: string, collectionId: string) {
  if (!isSupabaseConfigured) return;
  const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', userId);
  if (!followers) return;
  for (const f of followers as Array<{ follower_id: string }>) {
    if (f.follower_id !== userId) {
      await createNotification({
        userId: f.follower_id,
        type: 'new_collection',
        actorId: userId,
        actorName,
        actorUsername,
        actorAvatarUrl,
        targetId: collectionId,
        targetName: collectionName,
        targetType: 'collection',
      });
    }
  }
}

export async function notifyCollectionUpdated(collectionId: string, collectionName: string, actorId: string, actorName: string) {
  if (!isSupabaseConfigured) return;
  const { data: followers } = await supabase.from('collection_followers').select('user_id').eq('collection_id', collectionId);
  if (!followers) return;
  for (const f of followers as Array<{ user_id: string }>) {
    if (f.user_id !== actorId) {
      await createNotification({
        userId: f.user_id,
        type: 'collection_updated',
        actorId,
        actorName,
        actorUsername: '',
        actorAvatarUrl: '',
        targetId: collectionId,
        targetName: collectionName,
        targetType: 'collection',
      });
    }
  }
}
