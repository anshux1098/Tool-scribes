# Legacy SQL archive — DO NOT APPLY

These files were previously the repository's only record of the database schema.
They are **not** a faithful description of the live database and **must not be
applied** to any Supabase project.

They were moved here (from `supabase/migrations/` and the repo root) because each
one is either redundant, stale, or actively destructive if replayed.

## Why they are dangerous

| File | Problem if applied |
| --- | --- |
| `migrations/20260613132456_add_missing_rpc_stubs.sql` | Replaces **working** recommendation / vote / delete-account / notification RPCs with **empty no-op stubs**. Would silently break the alternatives, recommendations, notifications and account-deletion features. |
| `migrations/20260630000000_add_vault_item_on_approval.sql` | Begins with `DROP FUNCTION IF EXISTS approve_submission(uuid)`, which would **strip the `EXECUTE` grants** (`authenticated`, `service_role`) from the admin RPC. Its intended fix has since been applied properly (see `20260918071459`). |
| `migrations/20260613131816_add_soft_delete.sql` | Adds `deleted_at` columns that production does not have, and that no application code references. Soft delete was never implemented. |
| `migrations/20260616000001_add_ai_profile_columns.sql` | Superseded — the live schema already has these columns, plus more (`best_for`, `strengths`, `limitations`, `pricing_notes`, `learning_curve`, `beginner_friendly`). |
| `migrations/20260616000002_add_ai_profile_metadata.sql` | Superseded by later remote migrations. |
| `migrations/20260617000001_convert_ai_profile_version_to_integer.sql` | Superseded by later remote migrations. |
| `migrations/20260613131354_create_storage_buckets.sql` | Same intent as the remote `20260613085404_create_storage_buckets`, but under a **different version**, so it would run a second time. |
| `supabase-schema.sql` | A hand-written, badly out-of-date schema (9 of 25 `profiles` columns, 4 tables missing entirely, pre-hardening `increment_upvote`). Replaced by the generated `supabase/schema.sql`. |

## Why the version numbers matter

None of these version numbers exist in the remote migration history
(`supabase migration list --linked`) — see `supabase/MIGRATION_HISTORY.md`.
Because they collide with nothing, `supabase db push` would treat every one of
them as unapplied and replay all of them into production.

**Never run `supabase db push` while these files sit in `supabase/migrations/`.**
They have been removed from that directory for exactly this reason.

## Where the truth lives now

- **Live database is canonical.**
- `supabase/schema.sql` — generated snapshot, read-only reference.
- `supabase/migrations/` — only migrations that are genuinely applied.
- `supabase/MIGRATION_HISTORY.md` — the complete applied history.

Retained for historical reference only.