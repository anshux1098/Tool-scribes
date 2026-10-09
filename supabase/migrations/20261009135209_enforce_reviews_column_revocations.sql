-- ============================================================================
-- Actually enforce the reviews column revokes (corrects 20261009135051)
--
-- 20261009135051 did:
--
--   revoke update (moderation_status, moderated_by, moderated_at,
--                  is_flagged, flagged_reason) on public.reviews
--     from anon, authenticated;
--
-- and it had no effect. Postgres column privileges are ADDITIVE with table
-- privileges: a role holding table-level GRANT UPDATE is considered to hold
-- UPDATE on every column, and a column-level REVOKE cannot subtract from it.
-- There was a table-level GRANT UPDATE ON reviews to both anon and
-- authenticated, so every column still reported UPDATE = true for both.
--
-- Verified immediately after applying the first migration:
--
--   has_column_privilege('authenticated','reviews','moderation_status','UPDATE')
--   => true      (expected false)
--
-- So the self-moderation hole finding #5 describes was still fully open --
-- an author could PATCH moderation_status back to 'active' on their own
-- hidden or removed review.
--
-- The fix has to revoke the TABLE-level grant first, then re-grant UPDATE at
-- column granularity for exactly the columns that describe content.
-- ============================================================================

-- 1. Drop the blanket table-level UPDATE. Nothing else relies on it.
revoke update on public.reviews from anon, authenticated;

-- 2. Re-grant UPDATE per column, for content only.
--
--    These are precisely the five columns MyReviewsPage.tsx:100-108 writes
--    when an author edits their own review. Everything else on the table is
--    server-owned:
--
--      user_id, tool_id, created_at  -- identity and provenance
--      moderation_status             -- trust
--      moderated_by, moderated_at    -- audit trail
--      is_flagged, flagged_reason    -- trust
--      id                            -- surrogate key
--
--    updated_at is granted because the client sets it on edit; the trigger
--    would otherwise overwrite it, so it has to be writable.
grant update (best_for, gotcha, free_tier, rating, updated_at)
  on public.reviews to authenticated;

-- 3. anon gets no UPDATE at all. It previously held it via the table-level
--    grant, but the only UPDATE policies are "reviews: self update"
--    (user_id = auth.uid()) and "reviews: admin update" (is_admin()), both of
--    which are unsatisfiable for an anonymous caller since auth.uid() is NULL.
--    So this removes a privilege nothing could use.
--
--    INSERT/DELETE are untouched -- anon INSERT is relied on by the
--    submission flow, and DELETE is gated by "reviews: self delete".

-- 4. Re-assert the intent, now that it is actually in force.
comment on column public.reviews.moderation_status is
  'Server-owned. Set only via moderate_review(); never writable by the review author. Table-level UPDATE revoked in this migration -- a column-level revoke alone was overridden by it.';
comment on column public.reviews.moderated_by is
  'Server-owned. Derived from auth.uid() inside moderate_review(); was previously client-asserted.';
comment on column public.reviews.is_flagged is
  'Server-owned. Set only via moderate_review().';
comment on column public.reviews.flagged_reason is
  'Server-owned. Set only via moderate_review().';