# FIX_PROGRESS.md — what is done, what is next

> **Start here if you're a new AI session.** Read this file, then read
> `CODE_REVIEW.md` for the full findings. Do **not** re-audit the codebase.
>
> `CODE_REVIEW.md` is the original audit (complete, with file:line references).
> This file is the running log of what has been fixed since.
>
> **Last updated:** end of session covering critical #1, #2, #3, #4, #16.

---

## TL;DR

| | |
|---|---|
| Critical findings | **24 total → 5 fixed** (#1, #2, #3, #4, #16) |
| Commits ahead of `origin/main` | **7** (not yet pushed at time of writing) |
| TypeScript errors | **126 → 0** (`tsc -b` exits 0) |
| **Blocking issue** | **Migration `20261008120000` is NOT applied to production** |
| Next up | **#5** `reviews.moderation_status` self-moderation |

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

---

## ⚠️ BLOCKED — read this before deploying

### Migration `20261008120000` is NOT applied

**File:** `supabase/migrations/20261008120000_add_rate_limit_counters.sql`

The Supabase MCP connection in `opencode.json` is configured `read_only=true`,
so the production database cannot be written from this environment.

**Consequence:** there is currently **no rate limiting in production**. The
functions call `check_rate_limit()`, which doesn't exist, fail open, and log.

**To apply:**
```bash
supabase db push
```
or paste the migration file into the Supabase SQL editor.

The deploy scripts now do this automatically and abort if the push fails.

**This blocks #5, #6/#7, #8, #9, #10 — every remaining critical finding needs a
migration.** Removing `read_only` from `opencode.json` would unblock the rest of
the security work.

### Commits not pushed

7 commits sit ahead of `origin/main`. Scanned for API keys, tokens and JWTs —
clean, no new secrets introduced. Note `supabase/.temp/` is still tracked
(finding #17, pre-existing, see below).

---

## 📋 Next up — CRITICAL #5

### #5 — Any user can un-hide their own moderated review

**File:** `src/hooks/useReviews.ts:113-128`
**DB:** `supabase/schema_structure.sql:615, :618`

`moderateReview` PATCHes `reviews.moderation_status` straight from the browser.
The RLS policy is:

```sql
reviews: self update ... USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
```

`WITH CHECK` validates **only** `user_id`, not `moderation_status`. Reads allow
`moderation_status = 'active'`. So a user whose review was `rejected` writes
`moderation_status='active'` and it becomes publicly readable again. **Self-
moderation bypass.**

**Fix (preferred — do this):**
```sql
REVOKE UPDATE (moderation_status, moderated_by, moderated_at) ON reviews FROM authenticated;
```
then move `moderateReview` into a `SECURITY DEFINER` RPC that checks
`is_moderator()` and sets `moderated_by = auth.uid()` server-side. This also
fixes finding #12 (`moderateTag` returns inverted success, `moderated_by` is
caller-asserted).

**Also note:** `moderateReview` currently has **zero call sites** — it's the only
writer of `moderated_by`/`moderated_at`, so `AdminReviewModeration.tsx` reads a
column nothing populates through this path. And `notifyNewReview` is imported in
`useReviews.ts:5` but never called, so **review notifications never fire**.

**Invariant to apply throughout the DB work:** *a client may only ever write
columns that describe content — never columns that describe trust* (counters,
status, identity).

### Then, in order

| # | Finding | Needs migration | Notes |
|---|---|:--:|---|
| 6 | Tool author can rewrite `upvotes` | ✅ | `useTools.ts:307-324`; `tools: owner update USING (added_by = auth.uid())` has no column restriction |
| 7 | `increment_upvote` allows decrementing | ✅ | `functions.sql:534-550` guards only `delta = 1`; `useTools.ts:224` deletes the row *before* calling with `-1`. Needs an atomic `toggle_upvote(tool_id)` deriving the count from `count(*)` |
| 8 | `clone_public_collection` writes into arbitrary accounts | ✅ | `functions.sql:114-141`; drop the `target_user_id` param, hardcode `auth.uid()` |
| 9 | `reputation_score` self-assignable | ✅ | `useProfile.ts:157-167` types update as `Record<string, unknown>`; narrow to a `ProfileUpdate` type + revoke the column |
| 10 | Email enumeration | ✅ | `get_creator_email` / `get_submitter_email` (`functions.sql:284, :390`) — `SECURITY DEFINER`, no authz, no `REVOKE FROM anon` |

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

*Commits referenced are on `main`, local only. Review the log above before
continuing — do not assume this file is up to date if more work has happened.*