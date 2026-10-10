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
| Critical findings | **24 total → 11 fixed** (#1–#8, #10, #14, #16) |
| Migrations applied to production | **8** (`…135041` … `…045241`) |
| TypeScript errors | **126 → 0** (`tsc -b` exits 0) |
| **Blocking issue** | **None.** `moderate_review()` and the rate limiter now exist in production |
| Next up | **#9** `reputation_score` + `user_id` self-assignable |

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
| `20261009192135` | `stop_tool_upvote_tampering` | same pattern for `tools` — finding #6 |
| `20261009192643` | `atomic_upvote_toggle` | `toggle_upvote()` replaces `increment_upvote()`; retires the old RPC — finding #7 |
| `20261009192844` | `resync_tool_upvotes` | one-off data repair for counter drift the old design allowed |
| `20261009193102` | `fix_toggle_upvote_zero_row` | fixes a bug in `…192643` that made upvotes impossible to add |

Migration filenames were renamed to their **actual remote versions** —
`apply_migration` assigns its own timestamps, and a filename that disagrees with
`schema_migrations` makes `supabase db push` replay it.

**Verified:** `list_migrations` shows all four; `has_function_privilege`
confirms all three rate-limit/moderation functions are `SECURITY DEFINER` and
executable by `service_role` only (absent from both the anon and authenticated
advisor lists); the rate limiter admits calls 1–2 and denies 3–4 with
`retry_after=60` at `limit=2`.

### Commits

All work through the repo flatten is pushed to `origin/main`.

---

## ✅ CRITICAL #6 — Tool author can rewrite `upvotes` — `20261009192135`

Exactly the same defect as #5, and caught the same way: checked
`information_schema.role_table_grants` **before** writing the migration rather
than after. `tools` had the identical blanket `GRANT UPDATE` to `anon` and
`authenticated`, and `tools: owner update USING (added_by = auth.uid())`
validates the row, never the columns. So the **author** of a tool — not just an
admin — could PATCH:

- `upvotes` — the counter `increment_upvote()` exists to protect. Forge it to
  the top of every trending sort.
- `added_by` — identity, and the *predicate* on the owner update/delete
  policies. Rewriting it transfers the tool or detaches it.
- `id`, `created_at` — provenance.

Migration revokes the table-level grant first, then re-grants UPDATE for the
only four columns the client actually writes — `screenshot_url`, `ai_summary`,
`ai_profile_generated_at`, `ai_profile_version` (from `useTools.updateScreenshot`,
`useTools.updateAiProfile`, `generate-ai-profile.saveAiProfile`).

**Verified in production:**

| Check | Result |
|---|---|
| updatable columns for `authenticated` | exactly 4 |
| `upvotes`, `added_by`, `id`, `created_at` | denied |
| `anon` UPDATE | denied |
| INSERT / DELETE / SELECT (`authenticated` + `anon`), `service_role` UPDATE | unchanged |

Legit `upvotes` writers that remain: `increment_upvote()` and
`approve_submission()`, both `SECURITY DEFINER` running as the table owner.

---

## ✅ CRITICAL #7 — `increment_upvote` could be used to forge any counter

`increment_upvote(tool_id, delta)` checked that the caller held an upvote row
**only to reject `delta = 1`**. A caller with no upvote row could pass
`delta = -1` in a loop and drive any tool's counter negative. The client made
it trivial: `toggleUpvote` deleted the row *first* and only then called the RPC
with `-1`, so it always saw the exact state its guard was meant to reject.

There was a second, quieter defect: the counter was **incremented**, and the
row write and the RPC were two independent round-trips. Any failure between
them left the stored total permanently disagreeing with `count(*)`, with no
reconciliation anywhere.

`toggle_upvote(tool_id)` replaces it. There is no `delta` parameter, so there
is nothing to forge; the counter is **derived** from `count(*)` rather than
adjusted, so it cannot go negative, cannot drift, and self-heals on the next
tap. `increment_upvote` is revoked from every API role but left in place for
readability.

**The bug I introduced and caught.** The first version used
`delete … returning 1 into v_deleted`. In plpgsql an `INTO` target fed by a
zero-row statement is set to **NULL** — the `:= 0` initialiser is overwritten,
not preserved. So `v_deleted = 0` was NULL (falsy), the `INSERT` was skipped,
and **upvotes could never be added at all**. Found by probing the function
before shipping, not by reading it. Fixed in `20261009193102` using
`get diagnostics … row_count`, which is 0 for a zero-row delete.

**Verified** — four consecutive taps against a real tool:

| tap | `upvoted` | returned | stored |
|---|---|---|---|
| 1 | true | 1 | 1 |
| 2 | false | 0 | 0 |
| 3 | true | 1 | 1 |
| 4 | false | 0 | 0 |

Counter returns to its original value; probe left no residue. Also confirmed
`increment_upvote` is no longer executable by any API role, and no tool has a
negative counter.

**Data repair (`20261009192844`).** The old design had already produced real
drift — 4 tools had vote rows with a stored count of 0:

| tool | stored | actual |
|---|:--:|:--:|
| Raycast | 0 | 2 |
| NotebookLM | 0 | 2 |
| Notion | 0 | 1 |
| Google AI Studio | 0 | 1 |

All undercounted, all consistent with "row written, RPC rejected". Resynced;
drift now 0. No tool was ever negative, so #7 was exploitable but unused.

---

## ✅ CRITICAL #8 + #10 — `20261010045241`

One migration, because both are `SECURITY DEFINER` functions that trusted an
identity from the caller. The Supabase advisor listed all three as callable by
`anon`; verified live before writing anything.

### #8 — cross-account collection cloning

`clone_public_collection(source_collection_id, target_user_id)` took the owner
as a **parameter** and validated only that the source collection was public, so
any caller could create collections owned by anyone.

New canonical signature `clone_public_collection(p_source_collection_id)`
derives the owner from `auth.uid()`. The old two-argument form is kept as a
**wrapper that ignores `target_user_id`** — dropping it outright would make an
un-migrated client fail with a confusing "function does not exist" (PostgREST
matches on argument list). Overriding means a stale caller gets its own
collection instead of writing into someone else's account.

Probed the actual attack against production, passing a different user's id:

| check | result |
|---|---|
| attacker id passed in | `52f69993-…` |
| actual clone owner | `44354e37-…` (= the caller) |
| owned by attacker? | **no — safe** |

`PublicCollectionPage.tsx` migrated to the one-argument form. Probe rows cleaned
up afterwards; `clone_count` restored.

### #10 — email enumeration

`get_creator_email` and `get_submitter_email` read `auth.users.email` with no
authorization check and no `REVOKE FROM anon`. `get_creator_email` was fetched
on **every** public collection page load (`PublicCollectionPage.tsx:65`).

`REVOKE` alone would not have been enough — they are `SECURITY DEFINER`, so any
*authenticated* caller would still reach them. Each now requires a session **and**
restricts the read to the owner or a moderator/admin.

Probed:

| caller | outcome |
|---|---|
| anonymous | blocked — `Not authenticated` |
| signed in, not the owner | blocked — `Not authorized` |

`PublicCollectionPage.tsx` no longer calls `get_creator_email` at all: the value
was assigned to `col.creatorEmail` and **never rendered**, so dropping the
per-page-load fetch loses nothing and removes the enumeration attempt entirely.

---

## ✅ CRITICAL #14 — stored XSS via `contact_url`

`ProfilePage.tsx` called `window.open(contactUrl, …)` on the **raw DB value** at
two sites, while the same field was normalized for display only by
`parseContactUrl`. Any row holding a `javascript:` URL — legacy data, a direct DB
write, a future code path — turned another user's "Message" button into script
execution.

Added `normalizeContactUrl()`, which parses the value, defaults a bare host to
`https://`, and **returns null for any non-`http(s)` scheme**. Both
`window.open` sites and the button styling now use the normalized value; the
raw string is no longer reachable from any click handler.

---

## 📋 Next up — CRITICAL #9

### #9 — `reputation_score` and `user_id` self-assignable

Same class as #5/#6, and the same trap: `profiles: self update USING
(user_id = auth.uid())` validates the row, and **all 24 columns** are UPDATE-
writable by `authenticated` — including `reputation_score` (forge your own
standing) and `user_id` (the RLS predicate itself).

`useProfile.ts:157` types the update as `Record<string, unknown>` and spreads it
verbatim, so the type system cannot catch a bad key.

Fix, following the pattern now proven four times: revoke the table-level grant,
re-grant only the columns `ProfileSettingsModal` actually writes, and make
`reputation_score` + `user_id` server-owned. Narrow the hook's parameter type
to a `ProfileUpdate` interface at the same time so this cannot regress
silently.

**Check `information_schema.role_table_grants` first** — that check has caught a
no-op every single time.
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
- **Probe new SQL against real data before calling it done.** `toggle_upvote`
  applied cleanly, passed review, and was completely broken — a plpgsql
  `INTO` target fed by a zero-row statement is set to **NULL**, not to the
  variable's initialiser, so `if v_deleted = 0` was falsy and the INSERT never
  ran. Use `get diagnostics … row_count` when you need "how many matched".
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