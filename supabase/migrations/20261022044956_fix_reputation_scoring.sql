-- ============================================================================
-- Make reputation actually work — it has never been written
--
-- Found while closing the anon RPC surface: every profile has
-- reputation_score = 0, and nothing in the database ever writes that column.
--
-- Three compounding bugs:
--
-- 1. THE TRIGGERS DISCARD THE RESULT.
--    All three recalc triggers do:
--
--      perform calculate_reputation(new.user_id);
--
--    `perform` runs the function and throws the result away. calculate_reputation
--    RETURNS a computed integer, but nothing was ever assigned to it and no
--    UPDATE was issued. The score was computed on every write and then
--    discarded.
--
-- 2. THE FOLLOW TRIGGER IS ON THE WRONG TABLE.
--    recalc_rep_follow is attached to public.curator_follows, but the
--    application never writes that table -- it is a legacy table with 0 rows
--    and no references in src/. The live follow relationship is public.follows
--    (src/hooks/useProfile.ts, useFollowingFeed.ts, lib/notifications.ts all
--    use it), and follows has NO trigger at all. So the follower component of
--    the score could never move.
--
-- 3. calculate_reputation COUNTS `follows`, NOT `curator_follows`.
--    So even if the trigger had been on the right table, the table it counts
--    is the other one.
--
-- Verified before writing this:
--   select count(*) from profiles where reputation_score <> 0;  -->  0 of 8
--   select count(*) from curator_follows;                        -->  0
--   select count(*) from follows;                               -->  1
--
-- Fix:
--   * a helper that actually PERSISTS the score,
--   * the three triggers rewritten to call it, including handling UPDATE and
--     the old row, so un-approving a submission or un-following adjusts the
--     score instead of leaving it stale,
--   * the follow trigger moved from curator_follows to follows,
--   * a one-off backfill for the scores that were never written.
--
-- The score formula is unchanged: approved_submissions * 10 + active_reviews
-- * 5 + followers * 1.
-- ============================================================================

-- ─── the helper that actually writes ──────────────────────────────────────────

create or replace function public.recalculate_reputation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_user_id is null then
    return;
  end if;

  -- calculate_reputation() is SECURITY DEFINER and computes the score; this is
  -- the step that was missing. It runs as the table owner, so the column
  -- grant that keeps clients out of reputation_score does not block it.
  update public.profiles
     set reputation_score = public.calculate_reputation(p_user_id)
   where user_id = p_user_id;
end;
$function$;

revoke execute on function public.recalculate_reputation(uuid) from public, anon, authenticated;

comment on function public.recalculate_reputation(uuid) is
  'Persists the computed reputation score onto profiles. The recalc triggers used to compute it with `perform` and discard the result, so reputation_score was never written.';

-- ─── the triggers, rewritten ──────────────────────────────────────────────────

-- reviews: a review's author gains 5 points while it is active.
create or replace function public.trigger_recalc_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_reputation(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.recalculate_reputation(old.user_id);
  elsif tg_op = 'UPDATE' then
    -- Both rows: the review may have moved between users, and its moderation
    -- status may have changed, which changes whether it counts at all.
    perform public.recalculate_reputation(new.user_id);
    if old.user_id is distinct from new.user_id then
      perform public.recalculate_reputation(old.user_id);
    end if;
  end if;
  return null;
end;
$function$;

-- follows: the LIVE follow table. The previous trigger was on curator_follows,
-- which the application never writes.
create or replace function public.trigger_recalc_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_reputation(new.following_id);
  elsif tg_op = 'DELETE' then
    perform public.recalculate_reputation(old.following_id);
  elsif tg_op = 'UPDATE' then
    perform public.recalculate_reputation(new.following_id);
    if old.following_id is distinct from new.following_id then
      perform public.recalculate_reputation(old.following_id);
    end if;
  end if;
  return null;
end;
$function$;

-- tool_submissions: an approved submission is worth 10 points.
create or replace function public.trigger_recalc_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.status = 'approved' and new.submitted_by is not null then
      perform public.recalculate_reputation(new.submitted_by);
    end if;
    -- Un-approving must take the points back, otherwise the score only ever
    -- goes up.
    if tg_op = 'UPDATE' and old.status = 'approved' and old.submitted_by is not null
       and (new.status is distinct from 'approved' or new.submitted_by is distinct from old.submitted_by) then
      perform public.recalculate_reputation(old.submitted_by);
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'approved' and old.submitted_by is not null then
      perform public.recalculate_reputation(old.submitted_by);
    end if;
  end if;
  return null;
end;
$function$;

-- ─── move the follow trigger onto the table the app actually uses ─────────────

drop trigger if exists recalc_rep_follow on public.curator_follows;
drop trigger if exists recalc_rep_follow on public.follows;

create trigger recalc_rep_follow
  after insert or update or delete on public.follows
  for each row execute function public.trigger_recalc_follow();

-- ─── backfill the scores that were never written ──────────────────────────────

update public.profiles p
   set reputation_score = public.calculate_reputation(p.user_id)
 where p.user_id is not null;
