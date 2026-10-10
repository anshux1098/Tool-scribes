-- ============================================================================
-- Stop users self-assigning trust columns on their profile (#9)
--
-- Same class of defect as the reviews (#5) and tools (#6) holes, and found the
-- same way: `information_schema.role_table_grants` showed a blanket GRANT
-- UPDATE ON profiles to both anon and authenticated, and
-- `profiles: self update USING (user_id = auth.uid()) WITH CHECK
-- (user_id = auth.uid())` validates the ROW, never the columns.
--
-- So any user could PATCH on their own profile row:
--
--   reputation_score            forge your own standing. It is read by
--                               useFollowingFeed.ts:81 and rendered next to
--                               other curators, and is derived by
--                               calculate_reputation() from real signals.
--   user_id                     IDENTITY, and the predicate on every policy
--                               for this table. With UPDATE granted table-wide
--                               a user could retarget their row, or detach it
--                               and escape the USING check entirely.
--   last_seen_notifications_at  server-owned; owned by
--                               mark_notifications_seen(), which already
--                               checks p_user_id = auth.uid().
--   created_at, id              provenance.
--
-- The WITH CHECK on the policy does not help: it re-validates user_id, which
-- the caller is free to keep unchanged while altering everything else.
--
-- Column-scoped UPDATE, following 20261009135209 (reviews) and
-- 20261009192135 (tools). As those established, a column-level REVOKE is
-- silently overridden by a surviving table-level GRANT, so the table grant has
-- to go first.
--
-- Columns clients legitimately write, from ProfileSettingsModal.tsx:122 and
-- SettingsPage.tsx:75:
--
--   username, display_name, tagline, bio, location, website,
--   github, twitter, linkedin, public_profile, curator_badge,
--   show_reviews, show_collections, show_followers,
--   avatar_url, banner_url, featured_collection_id, contact_url,
--   signature_quote
--
-- plus featured_collection_id from the two collection-delete cleanup paths
-- (useCollections.ts:125, PublicCollectionPage.tsx:305) and updated_at, which
-- updateProfile always sets.
--
-- INSERT is untouched: `profiles: self insert` is how a user's row is created
-- on first sign-in (useProfile.ts:106). DELETE is untouched -- no policy
-- depends on it today, and the grant is not ours to remove.
-- ============================================================================

revoke update on public.profiles from anon, authenticated;

grant update (
  username, display_name, tagline, bio, location, website,
  github, twitter, linkedin,
  public_profile, curator_badge,
  show_reviews, show_collections, show_followers,
  avatar_url, banner_url, featured_collection_id,
  contact_url, signature_quote,
  updated_at
) on public.profiles to authenticated;

comment on column public.profiles.reputation_score is
  'Server-owned. Derived by calculate_reputation() from real signals; never writable by the profile owner. See migration 20261010045400.';
comment on column public.profiles.user_id is
  'Server-owned. Set once on insert and is the predicate on every policy for this table; never writable afterwards.';
comment on column public.profiles.last_seen_notifications_at is
  'Server-owned. Written only by mark_notifications_seen(), which checks p_user_id = auth.uid().';
