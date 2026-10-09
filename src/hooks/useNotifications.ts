import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type NotificationType =
  | 'new_tool'
  | 'new_collection'
  | 'collection_updated'
  | 'new_review'
  | 'new_follower'
  | 'tool_approved'
  | 'collection_followed';

export interface NotificationItem {
  id: string;
  createdAt: string;
  type: NotificationType;
  actorId: string | null;
  actorName: string;
  actorUsername: string;
  actorAvatarUrl: string;
  targetId: string;
  targetName: string;
  targetType: string;
  metadata: Record<string, unknown>;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchUnreadCount = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setUnreadCount(0); return; }
    const { data } = await supabase.rpc('get_unread_notification_count', { p_user_id: user.id });
    setUnreadCount((data as number) ?? 0);
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setNotifications([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.rpc('get_notifications', { p_user_id: user.id, p_limit: 50, p_offset: 0 });
    if (data) {
      const mapped: NotificationItem[] = (data as Array<Record<string, unknown>>).map(r => ({
        id: r.id as string,
        createdAt: r.created_at as string,
        type: r.type as NotificationType,
        actorId: r.actor_id as string | null,
        actorName: (r.actor_name as string) ?? '',
        actorUsername: (r.actor_username as string) ?? '',
        actorAvatarUrl: (r.actor_avatar_url as string) ?? '',
        targetId: (r.target_id as string) ?? '',
        targetName: (r.target_name as string) ?? '',
        targetType: (r.target_type as string) ?? '',
        metadata: (r.metadata as Record<string, unknown>) ?? {},
      }));
      setNotifications(mapped);
    }
    setLoading(false);
  }, [user]);

  const markAsSeen = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    await supabase.rpc('mark_notifications_seen', { p_user_id: user.id });
    setUnreadCount(0);
  }, [user]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchUnreadCount(), fetchNotifications()]);
  }, [fetchUnreadCount, fetchNotifications]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh, fetchUnreadCount]);

  return { notifications, unreadCount, loading, markAsSeen, refresh };
}
