-- ============================================================================
-- ToolScribe — GENERATED ROUTINE SNAPSHOT (28 functions)
-- ============================================================================
-- !!! DO NOT HAND-EDIT — GENERATED FROM THE LIVE DATABASE !!!
--
-- Sibling of schema_structure.sql. Contains every routine in schema public
-- (27 total), exactly as deployed on 2026-10-09, emitted verbatim from
-- pg_get_functiondef().
--
-- ─── clone_public_collection(uuid) / (uuid, uuid) ─────────────────────────────
-- HARDENED in migration 20261010045241 (#8). The owner used to be a PARAMETER
-- with no auth.uid() comparison, so any caller could create collections owned
-- by someone else. The one-argument form derives the owner from the session.
-- The two-argument form is a deprecated wrapper that IGNORES target_user_id,
-- so an un-migrated caller gets its own collection instead of someone else's.

-- ─── get_creator_email(uuid) / get_submitter_email(uuid) ──────────────────────
-- HARDENED in migration 20261010045241 (#10). Both read auth.users.email with
-- no authorization check and were callable by anon, so every user's address was
-- enumerable by iterating UUIDs. Each now requires a session and restricts the
-- read to the owner (or a moderator/admin).

-- 2026-10-09: appended moderate_review, check_rate_limit,
-- prune_rate_limit_counters and toggle_upvote (migrations 20261009135041 /
-- 20261009135051 / 20261009192643). All four are SECURITY DEFINER.
-- toggle_upvote, check_rate_limit, prune_rate_limit_counters and
-- moderate_review have EXECUTE revoked from anon; the first three are
-- service_role-only, moderate_review and toggle_upvote are authenticated-only.
-- increment_upvote remains defined but is executable by NO API role.
--
-- NOTE ON SECURITY DEFINER: 18 of these run as the table owner and therefore
-- BYPASS row level security. Any function that takes the target user as a
-- parameter MUST compare it against auth.uid() — see the hardening migration
-- 20260918072914_harden_notification_rpc_authz.sql for the pattern.
--
-- NOTE ON search_path: 24 of these functions have a mutable search_path
-- (Supabase advisor: function_search_path_mutable). They reference tables
-- UNQUALIFIED, so setting `search_path = ''` without schema-qualifying every
-- table reference WILL break them at runtime. Do not fix naively.
-- ============================================================================

-- ─── approve_submission(uuid) ───────────────────────────────────────────────
-- Admin-only. Creates a tool from a submission, auto-saves it to the
-- submitter's vault, and marks the submission approved.

CREATE OR REPLACE FUNCTION public.approve_submission(submission_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sub_record RECORD;
  new_tool_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tool_submissions WHERE id = submission_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Submission not found or already processed';
  END IF;

  SELECT * INTO sub_record FROM tool_submissions WHERE id = submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- 1. Insert into tools - makes the tool visible in Discovery
  INSERT INTO tools (
    name, url, description, category, icon, favicon, og_image, screenshot_url,
    price_model, is_open_source, requires_login,
    is_free, platforms, signup_required,
    added_by,
    ai_summary, ai_profile_generated_at, ai_profile_version
  ) VALUES (
    sub_record.title, sub_record.url, sub_record.description, sub_record.category,
    sub_record.icon, sub_record.favicon, sub_record.og_image, sub_record.screenshot_url,
    'free', FALSE, FALSE,
    sub_record.is_free, sub_record.platforms, sub_record.signup_required,
    sub_record.submitted_by,
    sub_record.ai_summary, sub_record.ai_profile_generated_at, sub_record.ai_profile_version
  )
  RETURNING id INTO new_tool_id;

  -- 2. Auto-save to submitter's vault - makes the tool appear in their Vault
  IF sub_record.submitted_by IS NOT NULL THEN
    INSERT INTO vault_items (user_id, tool_id)
    VALUES (sub_record.submitted_by, new_tool_id)
    ON CONFLICT (user_id, tool_id) DO NOTHING;
  END IF;

  -- 3. Mark the submission as approved
  UPDATE tool_submissions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = submission_id;

  RETURN new_tool_id;
END;
$function$;

-- ─── calculate_reputation(target_user_id uuid) ──────────────────────────────
-- SECURITY DEFINER, mutable search_path. Trigger-only intent: see the three
-- trigger_recalc_* functions. Called via POSTGREST by any authenticated user.

CREATE OR REPLACE FUNCTION public.calculate_reputation(target_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  approved_subs int;
  active_reviews int;
  follower_count int;
  total int;
begin
  select count(*)::int into approved_subs from tool_submissions
    where submitted_by = target_user_id and status = 'approved';
  select count(*)::int into active_reviews from reviews
    where user_id = target_user_id and moderation_status = 'active';
  select count(*)::int into follower_count from follows
    where following_id = target_user_id;
  total := approved_subs * 10 + active_reviews * 5 + follower_count * 1;
  return total;
end;
$function$;

-- ─── clone_public_collection(uuid, uuid) ────────────────────────────────────
-- SUPERSEDED by the one-argument clone_public_collection(p_source_collection_id)
-- in migration 20261010045241. This signature is now a wrapper that ignores
-- target_user_id entirely. The original body, which inserted a collection owned
-- by whatever id the caller passed, is preserved in that migration's history.

CREATE OR REPLACE FUNCTION public.clone_public_collection(
  source_collection_id uuid,
  target_user_id uuid
)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  select public.clone_public_collection(source_collection_id);
$function$;

-- ─── clone_public_collection(p_source_collection_id) ─────────────────────────
-- Clones a public collection into the CALLER's account. Owner comes from
-- auth.uid(); there is no owner parameter. Cloning increments clone_count on
-- the source, which is what usePublicCollections sorts on.

CREATE OR REPLACE FUNCTION public.clone_public_collection(p_source_collection_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_new_collection_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from collections
     where id = p_source_collection_id and is_public = true
  ) then
    raise exception 'Collection not found or is not public';
  end if;

  insert into collections (user_id, name, description, is_public, cover_image_url)
  select v_uid, name || ' (copy)', description, false, cover_image_url
    from collections
   where id = p_source_collection_id
  returning id into v_new_collection_id;

  insert into collection_tools (collection_id, tool_id)
  select v_new_collection_id, tool_id
    from collection_tools
   where collection_id = p_source_collection_id;

  update collections set clone_count = clone_count + 1
   where id = p_source_collection_id;

  return v_new_collection_id;
end;
$function$;

-- ─── create_notification(...) ───────────────────────────────────────────────
-- HARDENED in migration 20260918072914. Only writes when the actor is the
-- caller AND the claimed relationship actually exists.

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_actor_id uuid DEFAULT NULL::uuid, p_actor_name text DEFAULT ''::text, p_actor_username text DEFAULT ''::text, p_actor_avatar_url text DEFAULT ''::text, p_target_id text DEFAULT ''::text, p_target_name text DEFAULT ''::text, p_target_type text DEFAULT ''::text, p_metadata jsonb DEFAULT '{}'::jsonb)
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

  ) returning id into new_id;

  return new_id;
end;
$function$;

-- ─── delete_my_account() ────────────────────────────────────────────────────
-- Full cascade including the auth.users row. Correctly uses auth.uid()
-- internally rather than accepting a user id parameter.

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.notifications where user_id = v_user_id or actor_id = v_user_id;
  delete from public.vault_items where user_id = v_user_id;
  delete from public.upvotes where user_id = v_user_id;
  delete from public.follows where follower_id = v_user_id or following_id = v_user_id;
  delete from public.collection_followers where user_id = v_user_id;
  delete from public.reviews where user_id = v_user_id;
  delete from public.tag_subscriptions where user_id = v_user_id;
  delete from public.dust_items where user_id = v_user_id;
  delete from public.curator_shelf where user_id = v_user_id;
  delete from public.tool_submissions where submitted_by = v_user_id;
  delete from public.tool_alternatives where created_by = v_user_id;
  delete from public.alternative_votes where user_id = v_user_id;
  delete from public.collections where user_id = v_user_id;
  delete from public.profiles where user_id = v_user_id;
  delete from public.user_roles where user_id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$function$;

-- ─── get_creator_email(collection_id uuid) ──────────────────────────────────
-- HARDENED in migration 20261010045241 (#10).
--
-- Was: any authenticated user could read any public collection owner's email,
-- and anon could too -- the only check was `auth.role() <> 'anon'`. Iterating
-- collection UUIDs enumerated every user's address.
--
-- Now: requires a session, and restricts the read to the collection owner or
-- a moderator/admin. Note this is stricter than the old "public collection =>
-- anyone can see the curator's email" intent. PublicCollectionPage.tsx fetched
-- it on every load but only ever displayed it as a contact affordance.

CREATE OR REPLACE FUNCTION public.get_creator_email(collection_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM collections WHERE id = collection_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'No such collection';
  END IF;

  IF v_owner <> v_uid AND NOT (is_moderator() OR is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_owner;

  RETURN v_email;
END;
$function$;

-- ─── get_notifications(p_user_id, p_limit, p_offset) ────────────────────────
-- HARDENED in migration 20260918072914 (was an open read-anyone IDOR).

CREATE OR REPLACE FUNCTION public.get_notifications(p_user_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, type text, actor_id uuid, actor_name text, actor_username text, actor_avatar_url text, target_id text, target_name text, target_type text, metadata jsonb)
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

-- ─── get_similar_curators ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_similar_curators(p_curator_id uuid, p_limit integer DEFAULT 4)
 RETURNS TABLE(curator_id uuid, shared_followers bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    f2.following_id,
    COUNT(*)::bigint AS shared_followers
  FROM follows f1
  JOIN follows f2 ON f1.follower_id = f2.follower_id AND f2.following_id <> f1.following_id
  WHERE f1.following_id = p_curator_id
  GROUP BY f2.following_id
  ORDER BY shared_followers DESC
  LIMIT p_limit;
$function$;

-- ─── get_submissions_for_review() ───────────────────────────────────────────
-- Admin/moderator only. Returns 22 columns including submitter email.

CREATE OR REPLACE FUNCTION public.get_submissions_for_review()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, url text, normalized_domain text, title text, description text, category text, icon text, favicon text, og_image text, screenshot_url text, submitted_by uuid, reviewed_by uuid, reviewed_at timestamp with time zone, rejection_reason text, matched_tool_id uuid, submitter_email text, ai_summary text, is_free boolean, platforms text[], signup_required boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      s.id, s.created_at, s.updated_at, s.status,
      s.url, s.normalized_domain, s.title, s.description,
      s.category, s.icon, s.favicon, s.og_image,
      s.screenshot_url,
      s.submitted_by, s.reviewed_by, s.reviewed_at,
      s.rejection_reason, s.matched_tool_id,
      u.email::TEXT,
      s.ai_summary,
      s.is_free, s.platforms, s.signup_required
    FROM tool_submissions s
    LEFT JOIN auth.users u ON u.id = s.submitted_by
    ORDER BY s.created_at DESC;
END;
$function$;

-- ─── get_submitter_email(submission_id uuid) ────────────────────────────────
-- HARDENED in migration 20261010045241 (#10). The authorization check was
-- already correct (submitter themselves, or admin/moderator), but EXECUTE was
-- never revoked from anon, so the advisor flagged it and the check relied on
-- `auth.role() = 'anon'` rather than a missing session. Now revoked from
-- anon, and the role check is expressed via is_moderator()/is_admin().

CREATE OR REPLACE FUNCTION public.get_submitter_email(submission_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_submitted_by uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT submitted_by INTO v_submitted_by FROM tool_submissions WHERE id = submission_id;
  IF v_submitted_by IS NULL THEN
    RAISE EXCEPTION 'No such submission';
  END IF;

  IF v_submitted_by <> v_uid AND NOT (is_moderator() OR is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_submitted_by;
  RETURN v_email;
END;
$function$;

-- ─── get_tool_recommendations(p_tool_id, p_limit) ───────────────────────────
-- Collaborative filtering over vault_items. SECURITY INVOKER (respects RLS).

CREATE OR REPLACE FUNCTION public.get_tool_recommendations(p_tool_id uuid, p_limit integer DEFAULT 6)
 RETURNS TABLE(rec_tool_id uuid, co_score bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    vt2.tool_id,
    COUNT(*)::bigint AS co_score
  FROM vault_items vt1
  JOIN vault_items vt2 ON vt1.user_id = vt2.user_id AND vt2.tool_id <> vt1.tool_id
  WHERE vt1.tool_id = p_tool_id
  GROUP BY vt2.tool_id
  ORDER BY co_score DESC
  LIMIT p_limit;
$function$;

-- ─── get_unread_notification_count ──────────────────────────────────────────

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

-- ─── get_vault_recommendations ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_vault_recommendations(p_user_id uuid, p_limit integer DEFAULT 12)
 RETURNS TABLE(rec_tool_id uuid, reason_type text, score bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_existing uuid[];
BEGIN
  SELECT COALESCE(array_agg(tool_id), '{}'::uuid[]) INTO v_existing
  FROM vault_items WHERE user_id = p_user_id;

  RETURN QUERY
  -- Signal 1: Collaborative filtering (weight 2x)
  SELECT 
    vt2.tool_id,
    'collaborative'::text,
    (COUNT(*)::bigint * 2) AS score
  FROM vault_items vt1
  JOIN vault_items vt2 ON vt1.user_id = vt2.user_id AND vt2.tool_id <> vt1.tool_id
  WHERE vt1.tool_id = ANY(v_existing)
    AND NOT (vt2.tool_id = ANY(v_existing))
  GROUP BY vt2.tool_id

  UNION ALL

  -- Signal 2: From followed collections
  SELECT DISTINCT
    ct.tool_id,
    'collection'::text,
    1::bigint AS score
  FROM collection_followers cf
  JOIN collection_tools ct ON cf.collection_id = ct.collection_id
  WHERE cf.user_id = p_user_id
    AND NOT (ct.tool_id = ANY(v_existing))

  UNION ALL

  -- Signal 3: Tools added by followed curators
  SELECT DISTINCT
    t.id,
    'curator'::text,
    1::bigint AS score
  FROM follows f
  JOIN tools t ON t.added_by = f.following_id
  WHERE f.follower_id = p_user_id
    AND NOT (t.id = ANY(v_existing))

  ORDER BY score DESC
  LIMIT p_limit;
END;
$function$;

-- ─── handle_new_user() ──────────────────────────────────────────────────────
-- Trigger on auth.users insert. Creates a bare profile (username stays NULL,
-- so /u/:username is unreachable until the user picks one).

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$function$;

-- ─── increment_upvote(tool_id, delta) ───────────────────────────────────────
-- **RETIRED — no longer executable by any API role.** Superseded by
-- toggle_upvote() below; see migration 20261009192643. Kept only so the
-- history stays readable. Its ownership guard rejected a missing upvote row
-- only when delta = 1, so a caller with NO row could pass delta = -1 in a loop
-- and drive any tool's counter negative. It also INCREMENTED the counter
-- rather than deriving it, so the client's two round-trips could leave the
-- stored total permanently disagreeing with count(*).

CREATE OR REPLACE FUNCTION public.increment_upvote(tool_id uuid, delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if delta not in (-1, 1) then
    raise exception 'Invalid delta: must be -1 or 1';
  end if;
  if not exists (select 1 from upvotes where user_id = auth.uid() and upvotes.tool_id = increment_upvote.tool_id) then
    if delta = 1 then
      raise exception 'No upvote exists to increment';
    end if;
  end if;
  update tools set upvotes = upvotes + delta where id = tool_id;
end;
$function$;

-- ─── is_admin() / is_moderator() ────────────────────────────────────────────
-- Used by ~20 RLS policies. SECURITY DEFINER so RLS evaluation itself works.
-- Both have a mutable search_path (advisor finding).

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_moderator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('admin', 'moderator')
  );
$function$;

-- ─── mark_notifications_seen ────────────────────────────────────────────────

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

-- ─── reject_submission(uuid, text) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_submission(submission_id uuid, reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  reviewer_id uuid;
begin
  reviewer_id := auth.uid();
  if reviewer_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from user_roles where user_id = reviewer_id and role in ('admin', 'moderator')) then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from tool_submissions where id = submission_id and status = 'pending') then
    raise exception 'Submission not found or already processed';
  end if;

  update tool_submissions
  set status = 'rejected',
      rejection_reason = reason,
      reviewed_by = reviewer_id,
      reviewed_at = now()
  where id = submission_id;
end;
$function$;

-- ─── trigger_recalc_follow() / _review() / _submission() ────────────────────
-- Trigger-only functions. Exposed to `authenticated` via PostgREST (advisor
-- finding) but fail when called directly because tg_op/NEW are undefined.
-- NOTE: _follow() recalculates on the curator_follows table, which is legacy
-- and has 0 rows — so follower reputation changes never recalculate.

CREATE OR REPLACE FUNCTION public.trigger_recalc_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if tg_op = 'INSERT' then
    perform calculate_reputation(new.curator_id);
  end if;
  if tg_op = 'DELETE' then
    perform calculate_reputation(old.curator_id);
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform calculate_reputation(coalesce(new.user_id, old.user_id));
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.status = 'approved' and new.submitted_by is not null then
      perform calculate_reputation(new.submitted_by);
    end if;
  end if;
  return null;
end;
$function$;

-- ─── unvote_alternative / vote_alternative ──────────────────────────────────
-- Both correctly use auth.uid() internally. vote guards against duplicates;
-- unvote uses GREATEST(votes-1, 0) so the counter cannot go negative.

CREATE OR REPLACE FUNCTION public.unvote_alternative(p_alternative_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (SELECT 1 FROM alternative_votes WHERE alternative_id = p_alternative_id AND user_id = v_user_id) THEN
    RETURN false;
  END IF;

  DELETE FROM alternative_votes WHERE alternative_id = p_alternative_id AND user_id = v_user_id;
  UPDATE tool_alternatives SET votes = GREATEST(votes - 1, 0) WHERE id = p_alternative_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vote_alternative(p_alternative_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN false; END IF;

  -- Check if already voted
  IF EXISTS (SELECT 1 FROM alternative_votes WHERE alternative_id = p_alternative_id AND user_id = v_user_id) THEN
    RETURN false;
  END IF;

  -- Insert vote
  INSERT INTO alternative_votes (alternative_id, user_id) VALUES (p_alternative_id, v_user_id);

  -- Increment counter
  UPDATE tool_alternatives SET votes = votes + 1 WHERE id = p_alternative_id;

  RETURN true;
END;
$function$;

-- ─── END OF GENERATED ROUTINE SNAPSHOT (24 functions) ───────────────────────
-- ─── moderate_review(uuid, text, boolean, text) ──────────────────────────────
-- Added 2026-10-09 (migration 20261009135051). Replaces the client-side
-- .update() on reviews that let an author self-moderate.
--
-- SECURITY DEFINER, and EXECUTE is revoked from anon and authenticated --
-- only service_role may call it. It still checks auth.uid() and
-- is_moderator() internally, so a careless future GRANT does not make it
-- public. moderated_by is derived from auth.uid(), never from the client.

CREATE OR REPLACE FUNCTION public.moderate_review(
  p_review_id uuid,
  p_status text,
  p_flagged boolean DEFAULT NULL::boolean,
  p_flagged_reason text DEFAULT NULL::text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_moderator() then
    raise exception 'Not authorized: moderator privileges required';
  end if;

  if p_status not in ('active', 'hidden', 'removed') then
    raise exception 'Unsupported moderation status: %', p_status;
  end if;

  if p_review_id is null then
    raise exception 'Review id is required';
  end if;

  update public.reviews
     set moderation_status  = p_status,
         moderated_by       = auth.uid(),
         moderated_at       = now(),
         is_flagged         = coalesce(p_flagged, is_flagged),
         flagged_reason     = coalesce(p_flagged_reason, flagged_reason)
   where id = p_review_id;

  if not found then
    raise exception 'No such review: %', p_review_id;
  end if;
end;
$function$;

-- ─── check_rate_limit(text, integer, integer) / prune_rate_limit_counters() ──
-- Added 2026-10-09 (migration 20261009135041). Replaces an in-process Map in
-- the edge functions, which was per-container and keyed on a client-settable
-- x-forwarded-for header.
--
-- The increment is a single atomic upsert, so two concurrent requests from one
-- caller cannot both read the pre-increment count and both be admitted.
-- EXECUTE is revoked from anon and authenticated: a direct caller could
-- otherwise probe or poison another user's counter.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer DEFAULT 10,
  p_window_seconds integer DEFAULT 60
)
 RETURNS TABLE(allowed boolean, retry_after integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
declare
  v_count integer;
  v_window_started_at timestamptz;
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_limit integer := greatest(coalesce(p_limit, 10), 1);
begin
  if p_key is null or p_key = '' then
    raise exception 'Rate limit key is required';
  end if;

  insert into public.rate_limit_counters as c (key, count, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
                  when c.window_started_at <= now() - make_interval(secs => v_window_seconds)
                    then 1
                  else c.count + 1
                end,
        window_started_at = case
                  when c.window_started_at <= now() - make_interval(secs => v_window_seconds)
                    then now()
                  else c.window_started_at
                end
  returning c.count, c.window_started_at into v_count, v_window_started_at;

  return query
    select
      v_count <= v_limit,
      case
        when v_count <= v_limit then null
        else greatest(
          1,
          ceil(extract(epoch from (
            v_window_started_at + make_interval(secs => v_window_seconds) - now()
          )))::integer
        )
      end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prune_rate_limit_counters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
declare
  v_removed integer;
begin
  delete from public.rate_limit_counters
    where window_started_at <= now() - interval '1 hour';
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$function$;

-- ─── toggle_upvote(p_tool_id) ────────────────────────────────────────────────
-- Added 2026-10-09 (migrations 20261009192643 + 20261009193102). Replaces
-- increment_upvote, which could be driven negative.
--
-- Two properties that make the old holes unreachable:
--   * there is no delta parameter, so there is nothing to forge;
--   * tools.upvotes is DERIVED from count(*) rather than incremented, so it
--     cannot go negative, cannot drift from the upvotes table, and self-heals
--     on the next toggle for that tool.
--
-- The DELETE..GET DIAGNOSTICS pair is read-and-remove in one atomic step, and
-- the FOR UPDATE on tools serialises concurrent toggles of the same tool.
--
-- Uses get diagnostics row_count, NOT eturning ... into: a zero-row DELETE
-- returns no row, which would leave an INTO target NULL rather than 0. That bug
-- shipped briefly and made upvotes impossible to add -- see 20261009193102.

CREATE OR REPLACE FUNCTION public.toggle_upvote(p_tool_id uuid)
 RETURNS TABLE(upvoted boolean, upvotes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
declare
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_tool_id is null then
    raise exception 'Tool id is required';
  end if;

  perform 1 from tools where id = p_tool_id for update;
  if not found then
    raise exception 'No such tool: %', p_tool_id;
  end if;

  delete from public.upvotes
    where user_id = v_uid and tool_id = p_tool_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into public.upvotes (user_id, tool_id)
      values (v_uid, p_tool_id)
      on conflict (user_id, tool_id) do nothing;
  end if;

  select count(*)::integer into v_count
    from public.upvotes where tool_id = p_tool_id;

  update tools set upvotes = v_count where id = p_tool_id;

  return query select (v_deleted = 0), v_count;
end;
$function$;
