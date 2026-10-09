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
- `supabase/config.toml` is **not** present in this repo — CLI `db`/`link`
  commands require running `supabase init` / `supabase link` first.
- `.temp/` contains local CLI link state and should be git-ignored; do not
  commit it (it exposes the project ref and pooler URL).

## Known open items (do not treat this schema as final)

- `clone_public_collection()` accepts `target_user_id` as a parameter and does
  not verify it equals `auth.uid()` — a user can create collections owned by
  someone else. **Unfixed.**
- `increment_upvote()` only guards `delta = 1`; a caller with no upvote row can
  decrement repeatedly. Needs an atomic upvote-toggle RPC plus a client change.
- 24 routines have a mutable `search_path` (advisor `function_search_path_mutable`).
  Fixing requires schema-qualifying all table references first.
- `notifyNewReview()` in `src/lib/notifications.ts` is imported by
  `useReviews.ts` but never called — review notifications do not fire.
- Legacy tables `users`, `vaults`, `device_requests`, `curator_follows`,
  `reputation_scores` are unused by application code.

## Fixed since this file was written

- Review self-moderation — `reviews` moderation columns are now revoked from
  `authenticated` and set only through the `moderate_review()` RPC, which
  derives `moderated_by` from the session. Previously the `reviews: self
  update` policy validated `user_id` rather than the columns written, so a
  review author could PATCH their own `moderation_status` back to `active`.
  Migration `20261008130000`.
- Allowed `moderation_status` values are `active | hidden | removed`
  (`reviews_moderation_status_check`), not `rejected`.
- `reviews.tool_id` **does** have `REFERENCES tools(id) ON DELETE CASCADE` —
  the original audit's claim that it lacked a FK was wrong.