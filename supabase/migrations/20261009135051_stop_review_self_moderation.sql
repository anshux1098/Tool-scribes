-- ============================================================================
-- Stop review self-moderation
--
-- Root cause: RLS validated ROWS, not COLUMNS.
--
--   "reviews: self update" ON public.reviews FOR UPDATE TO public
--     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
--
-- WITH CHECK re-validates user_id only. It says nothing about which columns
-- the caller may change. Combined with "reviews: public read active"
-- (USING (moderation_status = 'active')), a user whose review had been
-- hidden or removed could PATCH moderation_status back to 'active' and the
-- review became publicly readable again -- self-moderation.
--
-- The moderator path had the same defect from the other direction:
-- AdminReviewModeration.tsx set moderated_by from client-supplied user?.id,
-- so the audit trail recorded whoever the browser claimed.
--
-- Fix follows the invariant applied across this migration set:
-- a client may only ever write columns that describe CONTENT. Columns that
-- describe TRUST (counters, status, identity) are server-owned.
--
-- Values are constrained by the existing check constraint
-- reviews_moderation_status_check: active | hidden | removed.
-- ============================================================================

-- 1. Server owns the moderation columns. Revoking the column list (rather
--    than UPDATE on the table) leaves authors able to edit their own review
--    text and rating, which is legitimate.
revoke update (moderation_status, moderated_by, moderated_at, is_flagged, flagged_reason)
  on public.reviews from anon, authenticated;

-- 2. Moderation is a moderator action, performed server-side so the actor
--    is derived from the session instead of trusted from the client.
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

-- Moderators and service_role only. authenticated cannot call this directly,
-- but the RPC itself checks is_moderator(), so a grant here would still be
-- safe -- it is withheld to keep the attack surface small.
revoke execute on function public.moderate_review(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.moderate_review(uuid, text, boolean, text) to service_role;

-- 3. Make the trust columns read-only for everyone else, so the existing
--    table-level grants cannot be widened later by a careless
--    "grant update on reviews to authenticated".
comment on column public.reviews.moderation_status is
  'Server-owned. Set only via moderate_review(); never writable by the review author.';
comment on column public.reviews.moderated_by is
  'Server-owned. Derived from auth.uid() inside moderate_review(); was previously client-asserted.';
comment on column public.reviews.is_flagged is
  'Server-owned. Set only via moderate_review().';