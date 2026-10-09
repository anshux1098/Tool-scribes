# Supabase migration history — applied to production

Project ref: `qglvwvpsegrucrhcpzxd` ("Pass")

This is the complete list of migrations **actually applied** to the production
database, as reported by `supabase migration list --linked` on 2026-09-18.

## Why this file exists

The repository's `supabase/migrations/` folder previously held 7 files whose
version numbers did not appear in this history, and whose content did not match
the live schema. They have been moved to `docs/legacy-sql-archive/` and must not
be applied. See the archive README for the per-file reasons.

Migrations 1–48 were applied through the Supabase dashboard / Management API
and were never present as files in this repository. Migrations 49 onward are
mirrored as files in `supabase/migrations/`.

| # | Version | Name | In repo |
|---:|---|---|:--:|
| 1 | 20260610141249 | add_tool_submissions_and_user_roles | — |
| 2 | 20260610141258 | add_matched_tool_column | — |
| 3 | 20260610141639 | get_submitter_email_function | — |
| 4 | 20260610141645 | get_pending_submissions_for_admin | — |
| 5 | 20260610141706 | fix_get_submissions_for_review | — |
| 6 | 20260610142624 | add_health_tags_reviews_follows_reputation | — |
| 7 | 20260610142631 | add_tool_tags_table | — |
| 8 | 20260610142753 | add_vault_items_with_visit_count | — |
| 9 | 20260611121238 | add_tool_health_system | — |
| 10 | 20260611122400 | create_profiles_and_follows | — |
| 11 | 20260611123715 | create_reviews_simple | — |
| 12 | 20260611123720 | reviews_rls_policies | — |
| 13 | 20260611124228 | reputation_scoring_function | — |
| 14 | 20260611125207 | tag_tables_no_rls | — |
| 15 | 20260611125226 | rebuild_tag_tables | — |
| 16 | 20260611125230 | tag_table_constraints2 | — |
| 17 | 20260611131411 | create_missing_core_tables | — |
| 18 | 20260611131421 | add_missing_functions_and_rls_fixes | — |
| 19 | 20260611133150 | admin_flow_fixes_v2 | — |
| 20 | 20260611134226 | fix_critical_security_issues | — |
| 21 | 20260611143612 | approve_submission_transaction | — |
| 22 | 20260611155409 | fix_get_submissions_for_review_return_type | — |
| 23 | 20260611160623 | fix_get_submissions_for_review_column_type_mismatch | — |
| 24 | 20260611162356 | add_screenshot_url_to_tools_and_submissions | — |
| 25 | 20260611162449 | update_get_submissions_for_review_with_screenshot_url | — |
| 26 | 20260611162550 | update_approve_submission_with_screenshot_url | — |
| 27 | 20260611181939 | fix_calculate_reputation_use_follows | — |
| 28 | 20260611205939 | add_profile_columns | — |
| 29 | 20260611210815 | enable_rls_and_policies_tags | — |
| 30 | 20260611211837 | add_profile_identity_and_shelf | — |
| 31 | 20260612151613 | add_contact_url_to_profiles | — |
| 32 | 20260612154534 | add_review_ratings | — |
| 33 | 20260612160943 | collection_discovery_columns | — |
| 34 | 20260612162157 | notification_center | — |
| 35 | 20260612163255 | add_recommendation_rpcs | — |
| 36 | 20260613060613 | add_tool_alternatives | — |
| 37 | 20260613062006 | fix_launch_security | — |
| 38 | 20260613085404 | create_storage_buckets | — |
| 39 | 20260613085422 | create_delete_my_account_rpc | — |
| 40 | 20260614143653 | add_tool_alternatives_delete_policy | — |
| 41 | 20260614162528 | fix_increment_upvote_ambiguous_column | — |
| 42 | 20260615073008 | add_tool_feature_columns | — |
| 43 | 20260615073248 | add_submission_feature_columns | — |
| 44 | 20260615073446 | fix_approve_submission_rpc_features | — |
| 45 | 20260615095114 | create_screenshots_bucket | — |
| 46 | 20260615110242 | fix_clone_collection_carry_cover | — |
| 47 | 20260616131511 | 20260616000002_add_ai_profile_metadata | — |
| 48 | 20260616210027 | 20260617000001_convert_ai_profile_version_to_integer | — |
| 49 | 20260918071459 | fix_approve_submission_vault_autosave | ✅ |
| 50 | 20260918072914 | harden_notification_rpc_authz | ✅ |
| 51 | 20260918072915 | guard_approve_submission_pending_only | ✅ |
| 52 | 20261009135041 | add_rate_limit_counters | ✅ |
| 53 | 20261009135051 | stop_review_self_moderation | ✅ |
| 54 | 20261009135209 | enforce_reviews_column_revocations | ✅ |
| 55 | 20261009192135 | stop_tool_upvote_tampering | ✅ |
| 56 | 20261009192643 | atomic_upvote_toggle | ✅ |
| 57 | 20261009192844 | resync_tool_upvotes | ✅ |
| 58 | 20261009193102 | fix_toggle_upvote_zero_row | ✅ |

### Notes on 52–58

- **20261009135041** adds `rate_limit_counters` plus `check_rate_limit()` and
  `prune_rate_limit_counters()`, both `SECURITY DEFINER` and `service_role`-only.
  Replaces the edge functions' in-process `Map`, which was not a rate limit in
  practice (per-container, keyed on a client-settable `x-forwarded-for`).
- **20261009135051** adds `moderate_review()`, which checks `is_moderator()` and
  derives `moderated_by` from `auth.uid()`. Its **column-level `REVOKE` had no
  effect** — see below.
- **20261009135209** fixes that. Postgres column privileges are *additive* with
  table privileges, so the surviving table-level `GRANT UPDATE ON reviews` to
  `anon` and `authenticated` overrode the column revoke entirely. This migration
  revokes the table-level grant and re-grants UPDATE per column for the five
  content columns only. **Verified with `has_column_privilege` after applying.**
- **20261009192135** applies the same pattern to `tools`. `tools: owner update`
  validated the row, so a tool's **author** could PATCH `upvotes`, `added_by`,
  `id` or `created_at` on their own row. UPDATE is now granted for four
  content columns only: `screenshot_url`, `ai_summary`,
  `ai_profile_generated_at`, `ai_profile_version`.
- **20261009192643** adds `toggle_upvote(p_tool_id)`, replacing
  `increment_upvote(tool_id, delta)`. The old function rejected a missing
  upvote row only for `delta = 1`, so a caller with no row could pass
  `delta = -1` repeatedly and drive any tool's counter negative. It also
  incremented the counter instead of deriving it, so the client's two
  round-trips could leave `tools.upvotes` permanently disagreeing with
  `count(*)`. The new function has no delta parameter and derives the counter.
  `increment_upvote` is revoked from every API role.
- **20261009192844** repairs drift that had already accumulated: 4 tools had
  vote rows with a stored count of 0 (Raycast, NotebookLM, Notion, Google AI
  Studio). All undercounted. No tool was ever negative.
- **20261009193102** fixes a bug in `…192643` introduced during that same
  session. It used `delete … returning 1 into v_deleted`; in plpgsql an `INTO`
  target fed by a zero-row statement becomes **NULL** rather than 0, so
  `if v_deleted = 0` was falsy and the INSERT never ran — upvotes could only be
  removed, never added. Replaced with `get diagnostics … row_count`.
  **Caught by probing the function against real data, not by reading it.**

> Lesson worth keeping: a column-level `REVOKE` is a silent no-op if any
> table-level `GRANT UPDATE` survives. Check
> `information_schema.role_table_grants`, then verify with
> `has_column_privilege`. A migration that runs without error may still do
> nothing.

## Going forward

Every schema change must be:
1. applied as a migration (via the MCP tool or CLI), which records a version above, then
2. saved as `supabase/migrations/<version>_<name>.sql` in this repository, and
3. reflected by regenerating `supabase/schema_structure.sql` and `supabase/functions.sql`.

Never hand-edit the generated files. Never apply SQL to production without a
matching file in `supabase/migrations/`.

`apply_migration` assigns its **own** version timestamps, so the filename must
be renamed to match the version it reports. A file whose name disagrees with
`schema_migrations` is treated as unapplied and replayed by `supabase db push`.