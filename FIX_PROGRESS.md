# FIX_PROGRESS.md — what is done, what is next

> **Start here if you're a new AI session.** Read this file, then read
> `CODE_REVIEW.md` for the full findings. Do **not** re-audit the codebase.
>
> `CODE_REVIEW.md` is the original audit (complete, with file:line references).
> This file is the running log of what has been fixed since.
>
> **Last updated:** session that applied critical #5 to production and fixed a
> no-op in its own migration.

---

## TL;DR

| | |
|---|---|
| Critical findings | **24 total → 6 fixed** (#1, #2, #3, #4, #5, #16) |
| Migrations applied to production | **3** (`20261009135041`, `20261009135051`, `20261009135209`) |
| TypeScript errors | **126 → 0** (`tsc -b` exits 0) |
| **Blocking issue** | **None.** `moderate_review()` and the rate limiter now exist in production |
| Next up | **#6** tool author can rewrite `upvotes` |

The earlier "BLOCKED — migration not applied" section below is **resolved**;
see the #5 entry. Read that entry before touching `reviews` again: the first
migration's column-level `REVOKE` was a no-op and needed a follow-up fix.

---

## ✅ Completed

### Baseline commits (housekeeping)

| Commit | What |
|---|---|
| `8345f4c` | Archive stale schema files, add generated DB snapshots. Moved the badly-drifted `supabase-schema.sql` + migrations to `docs/legacy-sql-archive/`. |
| `22bb795` | Add `CODE_REVIEW.md` — the full audit. |

### CRITICAL #16 — Build never typechecked ✅ `862ace6`

`package.json:8` was `"build": "vite build"` with no `tsc -b`, so `strict`,
`noUnusedLocals`, `noUnusedParameters` were configured but unenforced and
**126 errors shipped**.

- `build` → `tsc -b && vite build`; added standalone `typecheck` script
- All 126 errors fixed. `tsc -b` exits 0, 17 tests pass, `vite build` succeeds
- Added `*.tsbuildinfo` to `.gitignore`

**Real bugs this surfaced (all live defects, not just unused imports):**

| Bug | Effect |
|---|---|
| `ProfilePage` read `profile.avatar_url`, type declares `avatarUrl` | every profile's OG/social card used the default image |
| `ReviewCard` `.catch` on a non-Promise | tool-fetch error handler never ran |
| `ToolDetailPage` read `review.best_for` | AI chat prompt got `undefined` for every review |
| 3 pages mapped tool rows without 7 required fields | incomplete `Tool` objects |
| `MySubmissionsPage` `if (!user) return` never cleared loading | infinite spinner for logged-out users |
| `DiscoverPage` trending save counts keyed by numeric id, closure over empty `tools` | trending score silently lost its `saves` term |

**Structural changes:**
- New `NewTool` type in `lib/types.ts` — submission payload can no longer carry
  server-derived fields (`upvotes`, `savedToVault`, …). Groundwork for #6/#9.
- `lib/supabase.ts` states `SupabaseClient` explicitly instead of
  `ReturnType<typeof createClient>`, which resolved to generic defaults.
- Dead-but-unrendered UI was **wired up, not deleted**: `onRemoveFromCollection`
  (passed but never rendered), dust-collector remove-from-vault button,
  featured-collection tool icon strip, React keys on the activity timeline.
- `suggestAlternative` now upserts — re-suggesting a pair used to error.

### CRITICAL #1 — Edge functions could not boot ✅ `5ecd8ba`

Both functions imported `"./_shared/rate-limit.ts"`, which resolves to
`functions/<name>/_shared/`. That folder only ever received `ai-provider.ts` —
`rate-limit.ts` only existed at `functions/_shared/`. Both functions threw
module-not-found on every request. AskToolScribe and AI profile generation were
**100% broken**.

- Imports corrected to `../_shared/`
- Deleted 2 byte-identical copies of `ai-provider.ts` (all 3 matched SHA-256);
  one canonical copy now serves both
- Added the missing `generate-ai-profile/deno.json`
- Committed `deno.lock` for both — edge-runtime types were an unpinned target

**Verified:** `deno check index.ts` passes for both functions.

### CRITICAL #2 — Unauthenticated service-role write ✅ `bd7a55b`

`generate-ai-profile` PATCHed `/rest/v1/tools?id=eq.<toolId>` with the service
role key and had **no auth check anywhere in the handler**. Service role bypasses
RLS entirely, so any anonymous caller could overwrite any tool's `ai_summary`,
and `forceRegenerate: true` bypassed the cache — an open, billable write
primitive on the AI provider key.

- **New `functions/_shared/auth.ts`**: validates the caller's JWT against the
  auth server, resolves `is_admin`/`is_moderator`
- Role checks run **as the caller** (their own bearer token) so `auth.uid()`
  resolves correctly. Using the service key there would make everyone
  privileged — the check would be theatre.
- Fails **closed** on an unreachable role check
- `generate-ai-profile`: signed-in caller required; **admin** required to write
  an existing tool's profile. Generation without a `toolId` stays open to any
  signed-in user (submission + moderation flows)
- `ask-toolscribe`: same guard — every request costs an LLM call

**Verified:** `deno check` clean on both.

### CRITICAL #3 — Rate limiting was a no-op ✅ `4023f5f`

Counters lived in an in-process `Map`. Three compounding failures:

- Edge Functions run many horizontally-scaled containers → real ceiling was
  *containers × 10/min*; a cold route issued a fresh bucket
- Keyed on `x-forwarded-for`, a **client-settable** header → rotating it gave
  unlimited throughput
- A `setInterval` existed only to prune the Map, keeping the isolate warm and
  billing CPU for nothing

Now:

- Counters in `rate_limit_counters`, keyed on `caller.userId` (server-derived)
- **Single atomic upsert** — two concurrent requests cannot both read the
  pre-increment count and both be admitted
- Returns a real `Retry-After` header; the old `retryAfter` was computed then
  discarded in both handlers
- **Fails OPEN** if the DB is unreachable — rate limiting is a cost control,
  authentication is the security boundary; a DB blip shouldn't take every user's
  AI features down. Failures log.
- `prune_rate_limit_counters()` bounds the table to active callers
- `check_rate_limit` is `service_role`-only, so an authenticated caller cannot
  probe or poison another user's counter

**Verified:** `deno check` clean on both.

### CRITICAL #4 — JWT verification disabled at the gateway ✅ `fa837c9`

Both deploy scripts passed `--no-verify-jwt`, making both AI functions
anonymous public endpoints reachable cross-origin from any website. No
`supabase/config.toml` existed to catch it either.

- **New `supabase/config.toml`** with `verify_jwt = true` for both functions
- Removed `--no-verify-jwt` from both scripts; hardcoded project ref and
  `sbp_your_token_here` placeholder replaced with env-var lookups
- Both scripts now **push migrations before deploying** and abort on failure —
  the rate limiter calls `check_rate_limit()`, which doesn't exist until applied
- `deploy-ask-toolscribe.sh` previously deployed **only** `ask-toolscribe`;
  `generate-ai-profile` had no deploy path in the repo at all
- **Pre-flight guard** in both scripts refuses to run if `--no-verify-jwt`
  reappears as a command argument. Tested against both a real occurrence and
  the prose in the comments explaining why it's banned (first attempt
  false-positived on those comments — a guard that cries wolf gets deleted)

**Verified:** `bash -n` clean, PowerShell parser clean, guard tested both ways,
`npm run typecheck` exits 0.

### CRITICAL #5 — Review self-moderation ✅ `9dbf3ac` + `20261009135209`

RLS validated **rows, not columns**. `reviews: self update` re-checks
`user_id` only, so an author could PATCH `moderation_status` back to `'active'`
on their own hidden/removed review and it became publicly readable again.

Migration `20261009135051` added `moderate_review()` — `SECURITY DEFINER`,
checks `is_moderator()`, derives `moderated_by` from `auth.uid()` — and both
client write sites now call it.

**But the column revokes in that migration did nothing.** Postgres column
privileges are *additive* with table privileges: a role holding table-level
`GRANT UPDATE` is treated as having UPDATE on every column, and a column-level
`REVOKE` cannot subtract from it. `reviews` had a table-level `GRANT UPDATE` to
both `anon` and `authenticated`, so immediately after applying it:

```sql
has_column_privilege('authenticated','reviews','moderation_status','UPDATE')
=> true      -- expected false
```

The hole was still fully open. Migration `20261009135209` revokes the
**table-level** grant first, then re-grants UPDATE per column for exactly the
five content columns `MyReviewsPage.tsx:100-108` writes:
`best_for, gotcha, free_tier, rating, updated_at`.

**Verified in production after the fix:**

| Column | `authenticated` | `anon` |
|---|:--:|:--:|
| `best_for`, `gotcha`, `free_tier`, `rating`, `updated_at` | ✅ | ❌ |
| `moderation_status`, `moderated_by`, `moderated_at`, `is_flagged`, `flagged_reason` | ❌ | ❌ |
| `id`, `user_id`, `tool_id`, `created_at` | ❌ | ❌ |

> **Carry this forward:** a column-level `REVOKE` is a no-op if any table-level
> `GRANT UPDATE` survives. Always check `information_schema.role_table_grants`
> first, and verify with `has_column_privilege` rather than trusting the DDL.

---

## ✅ RESOLVED — was blocking

### Migrations applied to production

The Supabase MCP connection is now authenticated with a **scoped personal
access token** (Database + Migrations read-write) rather than OAuth. The OAuth
grant issued by the MCP server is read-only and cannot be widened — its stored
token had no scopes at all, which is why `execute_sql` returned 403 "after
trying upscoping".

Config lives in `opencode.json` (git-ignored), reading the token from
`~/.secrets/supabase-pat` via opencode's `{file:...}` substitution.

| Version | Name | What |
|---|---|---|
| `20261009135041` | `add_rate_limit_counters` | rate-limit counters table + `check_rate_limit()` + `prune_rate_limit_counters()`, all `service_role`-only |
| `20261009135051` | `stop_review_self_moderation` | `moderate_review()` RPC + column comments (column revokes inert — see #5) |
| `20261009135209` | `enforce_reviews_column_revocations` | revokes the table-level `GRANT UPDATE` that defeated #5 |

Migration filenames were renamed to their **actual remote versions** —
`apply_migration` assigns its own timestamps, and a filename that disagrees with
`schema_migrations` makes `supabase db push` replay it.

**Verified:** `list_migrations` shows all three; `has_function_privilege`
confirms all three functions are `SECURITY DEFINER` and executable by
`service_role` only (absent from both the anon and authenticated advisor
lists); the rate limiter admits calls 1–2 and denies 3–4 with `retry_after=60`
at `limit=2`.

### Commits not pushed

2 commits sit ahead of `origin/main`. Scanned for API keys, tokens and JWTs —
clean. `supabase/.temp/` is still tracked (finding #17).

---

## 📋 Next up — CRITICAL #6

### #6 — Tool author can rewrite `upvotes`

`useTools.ts:307-324` (`updateScreenshot`, `updateAiProfile`) calls
`.from('tools').update(...)` straight from the browser, and
`tools: owner update USING (added_by = auth.uid())` has no column restriction.
The **tool author** — not just an admin — can PATCH any column on their own row
including `upvotes`, `price_model`, and `added_by`, defeating the counter
`increment_upvote` protects. Neither function checks the response `error`.

**Apply the #5 lesson here:** check for a table-level `GRANT UPDATE` on `tools`
before attempting a column revoke, and verify with `has_column_privilege`.

### Then, in order

| # | Finding | Needs migration | Notes |
|---|---|:--:|---|
| 7 | `increment_upvote` allows decrementing | ✅ | `functions.sql:534-550` guards only `delta = 1`; `useTools.ts:224` deletes the row *before* calling with `-1`. Needs an atomic `toggle_upvote(tool_id)` deriving the count from `count(*)` |
| 8 | `clone_public_collection` writes into arbitrary accounts | ✅ | `functions.sql:114-141`; drop the `target_user_id` param, hardcode `auth.uid()` |
| 9 | `reputation_score` self-assignable | ✅ | `useProfile.ts:157-167` types update as `Record<string, unknown>`; narrow to a `ProfileUpdate` type + revoke the column |
| 10 | Email enumeration | ✅ | `get_creator_email` / `get_submitter_email` (`functions.sql:284, :390`) — `SECURITY DEFINER`, no authz, no `REVOKE FROM anon` |

Findings #8/#9/#10 are all confirmed still open by the Supabase security
advisor: `clone_public_collection`, `get_creator_email`, and
`get_submitter_email` all still appear as callable by `anon`.

**Invariant to apply throughout the DB work:** *a client may only ever write
columns that describe content — never columns that describe trust* (counters,
status, identity).

### Cheap wins still open (no migration needed)

- **#17** `supabase/.temp/` is git-tracked — leaks project ref, org slug, pooler
  hostname. `git rm -r --cached` + `.gitignore`. Also `.gitignore:28` ignores
  `.env.example`, so the onboarding template is never committed.
- **#22/23/24** Flash-of-error on `/tool/:id` and `/collections/:id`; all tool
  mutations silently no-op outside the first 100-row page (`getUuid` scans
  `toolsRef.current`)
- **#6 (part 2)** "flagged" moderation tab can never match — filters on
  `moderation_status === 'flagged'` but flagged rows keep `'active'` +
  `is_flagged: true`
- **#19** `drop_console: true` strips `ErrorBoundary.tsx:20`, the app's only
  global error sink
- **#18** CSP `script-src 'self'` blocks all JSON-LD
- **#21** Playwright imports an uninstalled package; no CI exists. Adding CI
  (`typecheck` → `lint` → `test` → `build`) is what stops this list regrowing.
- **#7 (part 2)** `cloneCollection` reimplements the RPC client-side and never
  increments `clone_count`, so the `'clones'` sort is permanently a no-op

`npm run lint` reports **18 pre-existing errors** (empty blocks, `any`, a
`require()` in `tailwind.config.ts`, a tautological test). Untouched so far.

---

## Ground rules for the next session

- **Do not** re-audit `src/`. `CODE_REVIEW.md` is complete and accurate.
- **Verify** a finding still exists before fixing it — code has moved.
- **Verify a migration actually did something.** `has_column_privilege` /
  `has_function_privilege`, not "the DDL ran without error". Migration
  `20261009135051` applied cleanly and changed nothing; a column-level `REVOKE`
  is silently overridden by any surviving table-level `GRANT UPDATE`.
- `apply_migration` assigns its **own** version timestamps. Rename the file to
  match, or `supabase db push` will replay it.
- `AGENTS.md` holds project conventions — read it too.
- `supabase/schema_structure.sql` and `supabase/functions.sql` are **generated**.
  Never hand-edit. Regenerate after any schema change.
- `supabase/migrations/` contains only migrations **applied to production**,
  named with their exact remote version. Adding a file without applying it makes
  `supabase db push` replay it.
- `supabase/README.md` lists known open schema/security issues — several overlap
  this review and should be updated as they get fixed.
- Verification commands: `npm run typecheck`, `npm test`, `npm run build`,
  `deno check index.ts` (from each `supabase/functions/<name>/` dir).

---

## 🔐 Access setup (for a new session)

The Supabase MCP connection authenticates with a **scoped personal access
token**, not OAuth. This is deliberate: the MCP server's own OAuth flow issues
a read-only grant whose token carries no scopes, so `execute_sql` fails 403
"after trying upscoping" no matter what `read_only` is set to in the URL.

- `opencode.json` (repo root, git-ignored) sets `oauth: false` and an
  `Authorization: Bearer {file:~/.secrets/supabase-pat}` header.
- The token needs **Database: read-write** and **Migrations: read-write**,
  scoped to this one project. Create one at
  [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
- Verify before applying anything: `select current_user` must not return
  `supabase_read_only_user`.

> Supabase's own guidance is not to connect MCP to production, and this project
> is production. A project-scoped token with only Database + Migrations is the
> mitigation — not full account access.

---

*Commits referenced are on `main`, local only. Review the log above before
continuing — do not assume this file is up to date if more work has happened.*