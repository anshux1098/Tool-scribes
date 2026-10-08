-- Stub RPCs for functions called in frontend but not yet defined.
-- TODO: Replace each placeholder body with the real implementation.

create or replace function get_tool_recommendations(p_tool_id uuid, p_limit int default 6)
returns table (tool_id uuid, score bigint)
language sql stable
as $$
  select null::uuid, 0::bigint where false;
$$;

create or replace function get_vault_recommendations(p_user_id uuid, p_limit int default 12)
returns table (tool_id uuid, score bigint, reason text, reason_type text)
language sql stable
as $$
  select null::uuid, 0::bigint, ''::text, ''::text where false;
$$;

create or replace function get_similar_curators(p_curator_id uuid, p_limit int default 4)
returns table (curator_id uuid, shared_followers bigint)
language sql stable
as $$
  select null::uuid, 0::bigint where false;
$$;

create or replace function vote_alternative(p_alternative_id uuid)
returns void
language sql security definer
as $$
$$;

create or replace function unvote_alternative(p_alternative_id uuid)
returns void
language sql security definer
as $$
$$;

create or replace function delete_my_account()
returns void
language sql security definer
as $$
$$;

create or replace function create_notification(
  p_user_id uuid,
  p_type text,
  p_actor_id uuid default null,
  p_actor_name text default '',
  p_actor_username text default '',
  p_actor_avatar_url text default '',
  p_target_id text default '',
  p_target_name text default '',
  p_target_type text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql security definer
as $$
$$;

create or replace function get_unread_notification_count(p_user_id uuid)
returns bigint
language sql stable security definer
as $$
  select 0::bigint;
$$;

create or replace function get_notifications(p_user_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  created_at timestamptz,
  type text,
  actor_id uuid,
  actor_name text,
  actor_username text,
  actor_avatar_url text,
  target_id text,
  target_name text,
  target_type text,
  metadata jsonb
)
language sql stable security definer
as $$
  select null::uuid, null::timestamptz, ''::text, null::uuid, ''::text, ''::text, ''::text, ''::text, ''::text, ''::text, '{}'::jsonb where false;
$$;

create or replace function mark_notifications_seen(p_user_id uuid)
returns void
language sql security definer
as $$
$$;

create or replace function approve_submission(submission_id uuid)
returns void
language sql security definer
as $$
$$;

create or replace function reject_submission(submission_id uuid, reason text default null)
returns void
language sql security definer
as $$
$$;
