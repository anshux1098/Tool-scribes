# Supabase — how schema changes work in this repo

**The live Supabase database is the single source of truth for the schema.**
This directory contains generated references to it plus the migrations that are
actually applied. Nothing here is hand-written schema.

## Files

| Path | What it is | Hand-edit? |
|---|---|:--:|
| `migrations/` | Migrations **applied to production**, named with their exact remote version | Add only |
| `schema_structure.sql` | **Generated** snapshot: types, 26 tables, constraints, 39 indexes, RLS enable, 81 policies, triggers, buckets | **Never** |
| `functions.sql` | **Generated** snapshot: all 24 routines, verbatim from `pg_get_functiondef()` | **Never** |
| `MIGRATION_HISTORY.md` | The complete applied migration history | Append |
| `functions/` | Deno edge functions (`ask-toolscribe`, `generate-ai-profile`) | Yes |

## Making a schema change

1. Apply the migration (records a version remotely):
   ```
   supabase migration new <name>        # or apply via the MCP tool
   ```
2. Save the identical SQL as `supabase/migrations/<version>_<name>.sql`.
3. Regenerate the two generated files and commit all three together.

**Never** run `supabase db push` while unaccounted files sit in `migrations/` —
it replays anything whose version is missing from remote history. The previous
7 phantom files were removed for exactly that reason; see
`docs/legacy-sql-archive/README.md`.

## Regenerating the generated files

They are produced by read-only catalog queries (documented in the header of
`schema_structure.sql`). Regenerate them after any schema change so they stay
honest. If you have CLI access and `supabase/config.toml`, `supabase db dump`
is a simpler alternative.

## Environment notes

- Project ref: `qglvwvpsegrucrhcpzxd` (project "Pass").
- `supabase/config.toml` **is** present (added alongside the JWT-verification
  fix). CLI `db`/`link` commands work; the project is linked via `.temp/`.
- `.temp/` contains local CLI link state and should be git-ignored; do not
  commit it (it exposes the project ref and pooler URL).

## Applying migrations from an AI session

The Supabase MCP server must authenticate with a **scoped personal access
token**, not OAuth — its OAuth grant is read-only and its token carries no
scopes, so `execute_sql` fails with 403 "after trying upscoping".

- `opencode.json` (repo root, git-ignored): `oauth: false` plus an
  `Authorization: Bearer {file:~/.secrets/supabase-pat}` header.
- The token needs **Database: read-write** and **Migrations: read-write**,
  scoped to this project only.
- `apply_migration` assigns its own version timestamps — rename the file in
  `migrations/` to match what it reports, or `supabase db push` replays it.

## Known open items (do not treat this schema as final)

- `increment_upvote()` is **retired** and no longer executable by any API role.
  It rejected a missing upvote row only for `delta = 1`, so a caller with no row
  could pass `delta = -1` repeatedly. `toggle_upvote(tool_id)` replaces it:
  no delta parameter, and `tools.upvotes` is derived from `count(*)` rather
  than incremented, so it cannot go negative or drift. Client migrated.
  Counter drift that had already accumulated was resynced by
  `20261009192844` (4 tools were undercounted).
- 24 routines have a mutable `search_path` (advisor `function_search_path_mutable`).
  Fixing requires schema-qualifying all table references first.
- `calculate_reputation(target_user_id)`, `delete_my_account()`,
  `approve_submission()`, `reject_submission()`, `handle_new_user()`,
  `vote_alternative()`, `unvote_alternative()`, `get_submissions_for_review()`
  are all `SECURITY DEFINER` and executable by `anon` per the advisor. Each needs
  an individual decision: some check roles internally, some are trigger-only and
  should simply have `EXECUTE` revoked.
- `notifyNewReview()` in `src/lib/notifications.ts` is imported by
  `useReviews.ts` but never called — review notifications do not fire.
- Legacy tables `users`, `vaults`, `device_requests`, `curator_follows`,
  `reputation_scores` are unused by application code.
- Leaked-password protection is disabled in Supabase Auth (advisor
  `auth_leaked_password_protection`).

## Fixed since this file was written

- Review self-moderation — `reviews` moderation columns are now revoked from
  `authenticated` and set only through the `moderate_review()` RPC, which
  derives `moderated_by` from the session. Previously the `reviews: self
  update` policy validated `user_id` rather than the columns written, so a
  review author could PATCH their own `moderation_status` back to `active`.
  Migrations `20261009135051` + `20261009135209` — the second was required
  because the first's column-level `REVOKE` was overridden by a table-level
  `GRANT UPDATE`.
- `reviews` UPDATE is now granted at column granularity: authors can write only
  `best_for, gotcha, free_tier, rating, updated_at`. `anon` has no UPDATE at
  all (its only UPDATE policies are unsatisfiable without a session anyway).
  `INSERT`/`DELETE` are unchanged.
- `clone_public_collection()` no longer takes an owner. The one-argument form
  derives it from `auth.uid()`; the two-argument form is a deprecated wrapper
  that **ignores** `target_user_id`, so an un-migrated caller gets its own
  collection instead of someone else's (`20261010045241`).
- `get_creator_email()` / `get_submitter_email()` now require a session **and**
  restrict the read to the owner or a moderator/admin (`20261010045241`).
  `REVOKE FROM anon` alone would not have been enough — as `SECURITY DEFINER`
  they were reachable by any authenticated caller too.
- `tools` UPDATE is likewise column-scoped (`20261009192135`): clients may write
  only `screenshot_url, ai_summary, ai_profile_generated_at, ai_profile_version`.
  The tool **author** could previously PATCH `upvotes`, `added_by`, `id` and
  `created_at` on their own row, because `tools: owner update` validates the row
  and a table-level `GRANT UPDATE` overrode any column revoke. `upvotes` is now
  written only by `increment_upvote()` / `approve_submission()`, and `added_by`
  is set on insert and never afterwards.
- AI edge-function rate limiting moved from an in-process `Map` to
  `rate_limit_counters` with an atomic upsert keyed on the authenticated user
  id. Migration `20261009135041`.
- Allowed `moderation_status` values are `active | hidden | removed`
  (`reviews_moderation_status_check`), not `rejected`.
- `reviews.tool_id` **does** have `REFERENCES tools(id) ON DELETE CASCADE` —
  the original audit's claim that it lacked a FK was wrong.