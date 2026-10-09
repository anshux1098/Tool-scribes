-- ============================================================================
-- Stop tool authors rewriting trust columns on their own tools (finding #6)
--
-- Root cause: same class of bug as the reviews self-moderation hole, and for
-- the same reason. `tools: owner update USING (added_by = auth.uid())`
-- validates the ROW, never the COLUMNS, and there was a table-level
-- GRANT UPDATE ON tools to anon and authenticated. So the author of a tool --
-- not just an admin -- could PATCH any column on their own row, including:
--
--   upvotes                   the counter increment_upvote() exists to protect.
--                             Forge it to the top of every "trending" sort.
--   added_by                  identity. Rewriting it either transfers the tool
--                             to someone else or detaches it, and it is the
--                             predicate on the owner update/delete policies.
--   id, created_at            provenance.
--
-- Verified before writing this:
--   information_schema.role_table_grants shows a blanket UPDATE to both anon
--   and authenticated.
--
-- The fix is the same shape as 20261009135209 for reviews, and the same
-- Postgres rule is why it must be done in this order: column privileges are
-- ADDITIVE with table privileges, so the table-level REVOKE has to come
-- first or the column-level GRANT below is redundant.
--
-- Columns the application legitimately writes as a client, and nothing else:
--
--   screenshot_url                    useTools.updateScreenshot()
--   ai_summary                        useTools.updateAiProfile(),
--   ai_profile_generated_at             generate-ai-profile.saveAiProfile()
--   ai_profile_version                  (same two call sites)
--
-- Both AI call sites are the admin review flow, which authenticates as
-- `authenticated` and is covered by tools: admin all -- so revoking the
-- table-level grant does not lock admins out of that path.
--
-- INSERT is untouched: tools: auth insert (WITH CHECK added_by = auth.uid())
-- is how addTool() and seedTools() create rows, and anon INSERT is relied on
-- by the submission flow. DELETE is untouched: tools: owner delete.
--
-- Writers of upvotes that remain legitimate, all running as the table owner:
-- increment_upvote() (SECURITY DEFINER) and approve_submission().
-- ============================================================================

-- 1. Drop the blanket table-level UPDATE.
revoke update on public.tools from anon, authenticated;

-- 2. Re-grant UPDATE at column granularity, for content only.
grant update (screenshot_url, ai_summary, ai_profile_generated_at, ai_profile_version)
  on public.tools to authenticated;

-- 3. Record the intent on the columns that are now server-owned, so a later
--    "grant update on tools to authenticated" is at least visible in the
--    schema rather than silently reopening this.
comment on column public.tools.upvotes is
  'Server-owned. Written only by increment_upvote(); never writable by the tool author. See migration 20261009135210.';
comment on column public.tools.added_by is
  'Server-owned. Set on insert to auth.uid(); never writable afterwards, because it is the predicate on tools: owner update/delete.';
