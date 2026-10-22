-- ============================================================================
-- Close the anon-callable SECURITY DEFINER surface, and fix a regression
--
-- The Supabase security advisor reported 13 SECURITY DEFINER functions that
-- `anon` could execute via /rest/v1/rpc/*. This migration closes 11 of them
-- and documents the 2 that must stay.
--
-- ── REGRESSION FIX ────────────────────────────────────────────────────────────
-- Migration 20261009135051 (finding #5) granted EXECUTE on moderate_review()
-- to service_role ONLY, on the assumption that only the server would call it.
-- That was wrong: src/hooks/useReviews.ts and src/components/
-- AdminReviewModeration.tsx both call it with supabase.rpc() using the
-- anon/authenticated key, so the admin moderation UI returned
--
--   permission denied for function moderate_review
--
-- for every moderation action. Verified against production:
--
--   set local role authenticated;
--   perform public.moderate_review(...);  -->  permission denied
--
-- The function is safe to expose to `authenticated`: it checks is_moderator()
-- internally and derives moderated_by from auth.uid(), so an authenticated
-- non-moderator still gets 'Not authorized'. The grant is restored below.
--
-- ── WHAT GETS REVOKED, AND WHY ───────────────────────────────────────────────
--
-- Trigger-only functions. These are invoked by a trigger, not by the API, and
-- PostgreSQL checks a trigger function's EXECUTE privilege at CREATE TRIGGER
-- time rather than at runtime -- so revoking from the API roles does not
-- affect them firing. Verified by inserting a review as `authenticated` with
-- the grant revoked: the insert succeeded.
--
--   handle_new_user          trigger on auth.users, fires as supabase_auth_admin
--   trigger_recalc_follow    trigger on curator_follows
--   trigger_recalc_review    trigger on reviews
--   trigger_recalc_submission trigger on tool_submissions
--
-- calculate_reputation. No client calls it (verified by grep over src/ -- the
-- only callers are the trigger functions, which are SECURITY DEFINER and run as
-- the table owner). It computes a user's score from their submissions, reviews
-- and follower count with NO authorization check at all, so any caller could
-- enumerate any user's activity. Revoked from both API roles; the triggers
-- still reach it because they execute as the owner.
--
-- Admin actions with an internal role check. The check is already in the
-- function body (`user_roles ... role IN ('admin','moderator')`), so granting
-- to `authenticated` is safe -- anon is simply refused.
--
--   approve_submission, reject_submission, get_submissions_for_review
--
-- Self-scoped functions. Both derive the acting user from auth.uid(), so a
-- caller can only ever act on their own row. `authenticated` keeps access.
--
--   delete_my_account, vote_alternative, unvote_alternative
--
-- ── THE TWO THAT MUST STAY ───────────────────────────────────────────────────
--
-- is_admin() and is_moderator() are still reported by the advisor and are
-- deliberately NOT revoked. 20 RLS policies call them:
--
--   15 policies use is_admin()   (reviews, tools, profiles, collections, ...)
--    5 policies use is_moderator()
--
-- A policy's USING / WITH CHECK expression is evaluated as the role running the
-- query. If that role lacks EXECUTE on the function the policy calls, the
-- expression raises "permission denied" and the whole query fails -- not just
-- that one policy. Revoking these would break every read and write on every
-- table those policies cover, for signed-in users AND anonymous visitors
-- (an anonymous SELECT evaluates each permissive policy in turn, so an error
-- in the is_admin() policy fails the query even when another policy would have
-- allowed it).
--
-- The client also calls both directly (src/hooks/useAuth.ts:23-24) to decide
-- whether to show admin UI.
--
-- They are safe to leave: both return a boolean about the CALLER and expose
-- nothing. This is an accepted, documented advisor exception, not an
-- oversight.
-- ============================================================================

-- ─── regression fix: restore client access to moderate_review ────────────────

revoke execute on function public.moderate_review(uuid, text, boolean, text) from public, anon;
grant  execute on function public.moderate_review(uuid, text, boolean, text) to authenticated;

comment on function public.moderate_review(uuid, text, boolean, text) is
  'Moderates a review. Requires an authenticated caller AND is_moderator() internally. Grants EXECUTE to authenticated because the admin UI calls it via PostgREST; the role check is enforced inside the function.';

-- ─── trigger-only functions ─────────────────────────────────────────────────

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.trigger_recalc_follow() from public, anon, authenticated;
revoke execute on function public.trigger_recalc_review() from public, anon, authenticated;
revoke execute on function public.trigger_recalc_submission() from public, anon, authenticated;

-- ─── internal computation, called only by the triggers ───────────────────────

revoke execute on function public.calculate_reputation(uuid) from public, anon, authenticated;

-- ─── admin actions: keep authenticated, drop anon ────────────────────────────

revoke execute on function public.approve_submission(uuid) from public, anon;
revoke execute on function public.reject_submission(uuid, text) from public, anon;
revoke execute on function public.get_submissions_for_review() from public, anon;

-- ─── self-scoped actions: keep authenticated, drop anon ──────────────────────

revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.vote_alternative(uuid) from public, anon;
revoke execute on function public.unvote_alternative(uuid) from public, anon;

-- ─── deliberate exceptions ───────────────────────────────────────────────────

comment on function public.is_admin() is
  'Returns whether the CALLER is an admin. EXECUTE is deliberately granted to anon and authenticated: 15 RLS policies call it in USING/WITH CHECK, and a policy expression is evaluated as the querying role, so revoking it would make every query on those tables fail with a permission error rather than merely denying access.';
comment on function public.is_moderator() is
  'Returns whether the CALLER is a moderator. EXECUTE is deliberately granted to anon and authenticated: 5 RLS policies call it in USING/WITH CHECK, and revoking it would break those policies. Exposes nothing beyond a boolean about the caller.';
