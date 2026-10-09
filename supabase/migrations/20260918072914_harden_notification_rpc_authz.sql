-- ────────────────────────────────────────────────────────────────────────
-- Harden the notification RPCs.
--
-- Root cause: these SECURITY DEFINER functions accepted the target user as a
-- PARAMETER and never compared it to auth.uid(). Because SECURITY DEFINER
-- bypasses RLS, the "notifications: owner all" policy (user_id = auth.uid())
-- was never enforced. A proven consequence: an anonymous caller could read any
-- user's notifications and move any user's unread marker.
--
-- Uses CREATE OR REPLACE (not DROP) so the function OIDs and the explicit
-- EXECUTE grants for authenticated/service_role are preserved.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. get_notifications ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_notifications(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, created_at timestamp with time zone, type text, actor_id uuid,
  actor_name text, actor_username text, actor_avatar_url text,
  target_id text, target_name text, target_type text, metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  return query
  select n.id, n.created_at, n.type,
    n.actor_id, n.actor_name, n.actor_username, n.actor_avatar_url,
    n.target_id, n.target_name, n.target_type, n.metadata
  from notifications n
  where n.user_id = p_user_id
  order by n.created_at desc
  limit p_limit
  offset p_offset;
end;
$function$;

-- 2. get_unread_notification_count ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  last_seen timestamptz;
  count_val int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  select last_seen_notifications_at into last_seen from profiles where user_id = p_user_id;
  if last_seen is null then
    select count(*)::int into count_val from notifications where user_id = p_user_id;
    return count_val;
  end if;
  select count(*)::int into count_val
    from notifications where user_id = p_user_id and created_at > last_seen;
  return count_val;
end;
$function$;

-- 3. mark_notifications_seen ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_notifications_seen(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  update profiles set last_seen_notifications_at = now() where user_id = p_user_id;
end;
$function$;

-- 4. create_notification ─────────────────────────────────────────────────
-- The actor must be the caller, and the relationship the notification claims
-- must actually exist (so a user can only notify people who follow them, or
-- the owner/followers of a collection they genuinely own or follow).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_actor_name text DEFAULT ''::text,
  p_actor_username text DEFAULT ''::text,
  p_actor_avatar_url text DEFAULT ''::text,
  p_target_id text DEFAULT ''::text,
  p_target_name text DEFAULT ''::text,
  p_target_type text DEFAULT ''::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  new_id uuid;
  v_collection_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Never let a caller act as somebody else
  if p_actor_id is distinct from auth.uid() then
    raise exception 'Not authorized: actor must be the caller';
  end if;

  if p_user_id is null then
    raise exception 'Recipient is required';
  end if;

  if p_user_id = p_actor_id then
    raise exception 'Not authorized: cannot notify yourself';
  end if;

  if p_type not in ('new_follower', 'collection_followed', 'new_review',
                    'new_collection', 'collection_updated') then
    raise exception 'Unsupported notification type: %', p_type;
  end if;

  if p_type = 'new_follower' then
    -- recipient is followed by the actor
    if not exists (
      select 1 from follows where follower_id = p_actor_id and following_id = p_user_id
    ) then
      raise exception 'Not authorized: no such follow relationship';
    end if;

  elsif p_type in ('new_review', 'new_collection') then
    -- recipient follows the actor
    if not exists (
      select 1 from follows where follower_id = p_user_id and following_id = p_actor_id
    ) then
      raise exception 'Not authorized: recipient does not follow the actor';
    end if;

  else -- collection_followed, collection_updated
    begin
      v_collection_id := p_target_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid collection reference';
    end;

    if p_type = 'collection_followed' then
      -- recipient owns the collection, actor follows it
      if not exists (
        select 1 from collections where id = v_collection_id and user_id = p_user_id
      ) then
        raise exception 'Not authorized: recipient does not own the collection';
      end if;
      if not exists (
        select 1 from collection_followers
        where collection_id = v_collection_id and user_id = p_actor_id
      ) then
        raise exception 'Not authorized: actor does not follow the collection';
      end if;
    else
      -- actor owns the collection, recipient follows it
      if not exists (
        select 1 from collections where id = v_collection_id and user_id = p_actor_id
      ) then
        raise exception 'Not authorized: actor does not own the collection';
      end if;
      if not exists (
        select 1 from collection_followers
        where collection_id = v_collection_id and user_id = p_user_id
      ) then
        raise exception 'Not authorized: recipient does not follow the collection';
      end if;
    end if;
  end if;

  insert into notifications (
    user_id, type, actor_id, actor_name, actor_username,
    actor_avatar_url, target_id, target_name, target_type, metadata
  ) values (
    p_user_id, p_type, p_actor_id, p_actor_name, p_actor_username,
    p_actor_avatar_url, p_target_id, p_target_name, p_target_type, p_metadata
  ) returning id into new_id;

  return new_id;
end;
$function$;

-- 5. Least privilege: notifications are never an anonymous-usable feature ──
revoke execute on function public.get_notifications(uuid, integer, integer) from public, anon;
revoke execute on function public.get_unread_notification_count(uuid) from public, anon;
revoke execute on function public.mark_notifications_seen(uuid) from public, anon;
revoke execute on function public.create_notification(uuid, text, uuid, text, text, text, text, text, text, jsonb) from public, anon;