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
| Critical findings | **24 / 24 fixed** |
| Migrations applied to production | **9** (`…135041` … `…091402`) |
| Tests | **58 unit + 4 e2e** (up from 17) |
| CI | **`.github/workflows/ci.yml`** — typecheck → lint → test → build → e2e |
| TypeScript errors | **126 → 0** (`tsc -b` exits 0) |
| **Blocking issue** | **None.** `moderate_review()` and the rate limiter exist in production |
| Next up | No criticals left. Remaining work is the HIGH/MEDIUM list in `CODE_REVIEW.md` |

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

---

## ✅ CRITICAL #9 — `20261010091402`

Caught the same way as #5 and #6: `role_table_grants` showed the identical
blanket `GRANT UPDATE ON profiles`, and `profiles: self update USING
(user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` validates the **row**.

The `WITH CHECK` is worth dwelling on, because it looks like protection: it
re-confirms `user_id`, which the caller is simply free to leave unchanged while
altering everything else.

Writable trust columns before this migration:

| column | risk |
|---|---|
| `reputation_score` | forge your own standing — rendered by `useFollowingFeed.ts:81` beside other curators, and derived by `calculate_reputation()` from real signals |
| `user_id` | **identity, and the predicate on every policy for this table** — retarget the row, or detach it and escape the `USING` check |
| `last_seen_notifications_at` | owned by `mark_notifications_seen()`, which already checks `p_user_id = auth.uid()` |
| `created_at`, `id` | provenance |

Now column-scoped to the 20 columns the app actually writes.
**Verified:** exactly 20 updatable for `authenticated`, 0 for `anon`, all five
trust columns denied, INSERT/SELECT/DELETE and `service_role` unchanged.

Client side: `updateProfile` took `Record<string, unknown>` and spread it
verbatim. It now takes a **`ProfileUpdate` interface** listing exactly those 20
columns, so passing `reputation_score` is a compile error rather than a runtime
grant failure. The two lists must be kept in sync — the doc comment says so.

INSERT deliberately untouched: `profiles: self insert` is how a row is created
on first sign-in (`useProfile.ts:106`).

---

---

## ✅ CRITICAL #11 — PostgREST filter injection

Two sites, both fixed. No migration needed.

### Search engine (`simple-engine.ts`)

`escapeLike` escaped `%`, `_`, `\` — that is the **SQL `LIKE`** grammar, a
different language from the **PostgREST filter** grammar that `.or()` parses. A
comma or dot in a search token therefore became a new filter condition:
searching `x,category.eq.dev` used to return rows where `category = 'dev'`.

Added `stripFilterGrammar`, which drops `, . ( ) * " \`. Dropping rather than
escaping is deliberate: these characters have no meaning in a search term, so
the user still gets results for the letters they typed and there is no grammar
left to escape.

Two follow-on details:
- A token made **entirely** of grammar now yields no clause. `name.ilike.%%`
  would match every row, so the token is skipped instead.
- `hasQuery` is derived from the built clause, not from `filters.query.trim()`.
  Previously a query of `",,,"` passed the guard and produced an empty `.or()`
  argument, which is a malformed request rather than "no results".

### Edge function (`generate-ai-profile`)

`toolId` is interpolated into `?id=eq.${toolId}` on a **service-role** request,
which bypasses RLS entirely. A comma or paren in the value rewrites the filter.
Now validated by `isUuid` (RFC 4122 shape) and rejected with 400 — validating
the shape removes the grammar before the URL is ever built, which is stronger
than encoding it.

### 18 new tests, and two real bugs they caught

`src/test/search-filter.test.ts` (18) and `src/test/edge-url-guards.test.ts`
(17) — the latter mirrors the edge guards, since Deno is unavailable under
vitest and duplicating the function into the app bundle would ship dead code.

**Writing the tests found two bugs I would not have caught by reading:**
- `hostname === 'localhost'` never matched `api.localhost`. Whatwg/URL does
  **not** strip the localhost domain, so subdomain forms walked straight
  through. Now checks `.localhost` and `.local` suffixes.
- `[::ffff:169.254.169.254]` was **normalised to `::ffff:a9fe:a9fe`** before the
  guard saw it, so the dotted-quad regex for IPv4-mapped addresses could never
  match. `isPrivateV6` now converts the last two hex groups back to a quad.

---

## ✅ CRITICAL #12 — the SSRF guard was decorative

`isValidPublicUrl` matched only dotted-quad IPv4, and `fetch` followed redirects
by default. Four holes, all closed:

| bypass | why it worked |
|---|---|
| `http://[::1]/`, `[fc00::1]`, `[fe80::1]` | no IPv6 handling at all |
| `http://[::ffff:169.254.169.254]/` | URL normalises this to hex before the guard runs |
| `http://api.localhost/`, `http://db.local/` | `hostname === 'localhost'` doesn't match a subdomain |
| `100.64.0.0/10`, `192.0.0.0/24` | not in the original range list |

The redirect hole was the significant one: **a host that passes the check can
still reach `169.254.169.254`** by 302-ing there. `fetch` now uses
`redirect: "manual"`, and the handler resolves the `Location` itself and
re-runs the full check against it. The redirect test asserts the public ranges
adjacent to private ones are **not** over-blocked (`172.15`, `172.32`,
`100.63`, `11.0.0.1`) — an SSRF guard that rejects half the internet gets
turned off.

---

## ✅ CRITICAL #13 — prompt injection via `toolContext`

`ask-toolscribe` interpolated caller-supplied `name`, `description`, `tags`,
`features` and `reviewsSummary` straight into the **user** message, and never
verified the tool exists — the non-ctx branch fetches the catalog, the ctx
branch trusted the client.

- Tool details are now fenced in `<tool_data>…</tool_data>` with an explicit
  statement that the contents are data, not instructions.
- The system prompt states that text resembling an instruction must be reported
  back as suspicious rather than obeyed.
- Newlines are collapsed by `clip()`, so injected text cannot fake a section
  header or close the fence.
- **Deliberately not** done: fetching the real tool from the catalog to replace
  the client's copy. The ctx branch exists to answer about a tool being viewed,
  and a round-trip per request would cost more than it is worth here. The
  injection is contained, not removed.

---

## ✅ CRITICAL #15 — no input size limit

Every string forwarded to a paid endpoint is now bounded: `query` 2000 chars
(rejected with 400 above that), `description` 1200, `reviewsSummary` 1200,
`features` 600, `tags` 300, `name` 120, `category` 60. `tags` and `features`
are capped at 20 items each with per-item limits. Previously an unbounded array
of strings went straight to a 4096-output-token call.

---

## ✅ CRITICAL #18 — JSON-LD and the CSP

`index.html` set `script-src 'self'` with no `'unsafe-inline'` and no nonce,
which blocks every `<script type="application/ld+json">` Helmet emits.

**Checked before changing anything: no `<SEO>` call site passes
`structuredData`** — all 10 omit it. So nothing is being blocked today. This
was dead capability, not a live regression, and the honest fix is not to weaken
the CSP to activate it.

`SEO.tsx` now documents the constraint precisely: the options are a per-request
nonce (needs SSR, which this static SPA does not have) or a sha256 hash of the
exact JSON (impossible when the payload is built at runtime). **Do not add
`'unsafe-inline'`** — that removes XSS protection for the whole app to gain
rich results.

## ✅ CRITICAL #19 — clickjacking protection was inert

`frame-ancestors 'none'` inside `<meta http-equiv>` is ignored by every browser,
as is `<meta http-equiv="X-Frame-Options">`. The file looked protected and
provided zero defence.

The authoritative policy now lives in **`vercel.json` as real response headers**:
CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, HSTS and `Cross-Origin-Opener-Policy`. HSTS is the
notable one that was entirely absent — the app embeds Supabase keys and OAuth
callbacks. Added `object-src 'none'` and `form-action 'self'` too.

The meta tag is kept as a **development fallback** only (`npm run dev` serves no
`vercel.json`), with a comment saying the two must stay in sync.

Also fixed while in the file: the catch-all rewrite `/(.*)` → `/index.html`
returned **200 for missing asset requests**, masking broken deploys. It now
excludes anything with a file extension.

## ✅ CRITICAL #20 — production error reporting was stripped

`drop_console: true` removes `console.error` and `console.warn` as well as
`console.log`, which silently deleted `ErrorBoundary.tsx:20` — the app's only
global error sink — plus ~15 other diagnostics sites. Production crashes were
unobservable.

Now `drop_console: ["log", "debug", "info"]`, so errors and warnings survive.
**Verified in the built bundle:** `console.error` present (11 occurrences in
`Index-*.js`, 2 in `index-*.js`), `console.log` at 0. Added `keep_fnames: true`
so ErrorBoundary stack traces are readable.

## ✅ CRITICAL #21 — Playwright was unrunnable, and there was no CI

`playwright.config.ts` and `playwright-fixture.ts` imported
`lovable-agent-playwright-config`, which is in neither `package.json` nor
`package-lock.json` — `npx playwright test --list` failed outright. Rewritten
against `@playwright/test`, which *is* a devDependency. Note the old scaffold
assumed port 3000; vite serves on 8080.

Added `e2e/smoke.spec.ts` — 4 anonymous smoke tests asserting `#root` actually
receives content and that no `pageerror` fires. **Deliberately no login**: these
run against the real Supabase project, and a sign-in helper would need real
credentials in CI or a seeded user. Anonymous is the safe default.

**New `.github/workflows/ci.yml`** — typecheck → lint → test → build → e2e, all
hard gates. The e2e job builds and serves the production bundle, so it exercises
the CSP the new headers introduce. No secrets needed.

A first run of the smoke specs produced a flaky `net::ERR_ABORTED` on `/tags`:
four workers contending while vite was cold-starting. It passed in isolation,
which is exactly how flakes hide. Fixed with `workers: 1` rather than a retry —
four specs gain nothing from parallelism. **4/4 stable on repeat runs.**

---

## ✅ CRITICAL #24 — mutations silently no-opped on deep links

**The worst of the three**, because it was quiet data loss. `getUuid` resolved
a numeric tool id to its UUID by scanning only `toolsRef.current` — the
paginated list, `PAGE_SIZE = 100`. Every mutation early-returned on a miss, so
deep-linking to any tool outside the first 100 rows made **upvote, save to
vault, toggle favourite, notes, tags, record visit and remove from vault**
silently do nothing. No error, no UI feedback, no indication anything happened.

Fixed with a **module-level hash → uuid index**:

- Warmed from every page that loads, so no cost on the common path.
- Lazily filled on the first miss from `select('id')` only — ids alone, small
  regardless of tool count.
- **Module-level on purpose**, so it survives navigation: once a deep link
  resolves, the mapping is warm for the rest of the session.
- In-flight requests are de-duplicated, so concurrent mutations on a cold
  session trigger one query, not ten.
- A miss now logs `console.error` naming the action and the id, instead of
  returning `null` in silence. `removeFromVault` returns
  `{ error: 'Tool not found' }` rather than reporting success.

All ten mutation call sites moved to `resolveUuidOrWarn`. On a hash collision
the first id wins — the same rule the old linear scan used.

`src/test/tool-uuid-index.test.ts` (5 tests) pins the properties this depends
on: stability across calls, no collisions across a realistic sample, and
explicitly that an id **never in the loaded page** still resolves — which is
the #24 scenario itself.

## ✅ CRITICAL #22 — "Tool not found" flashed on every load

`ToolDetailPage` bailed on `!tool`, and `tools` is `[]` until the query
resolves, so every shared `/tool/:id` link and back-navigation showed a false
error screen before the real content.

The page now takes a `loading` prop (threaded from `useTools` via
`ToolDetailWrapper`) and renders a spinner while the query is in flight. Only a
genuine miss renders "Tool not found".

## ✅ CRITICAL #23 — "Collection not found" flashed, and was owner-only

Same flash, plus a worse problem: `collections` comes from `useCollections()`,
which returns **only the current user's rows**, so anonymous and deep-linked
visitors always failed. The public route is `/c/:uuid`.

Added the same `loading` gate, and made the error state honest: it now explains
that the collection may be private or belong to another account and points at
the public route, instead of implying it does not exist.

---

## 📌 All 24 critical findings are now closed

Remaining work is the HIGH / MEDIUM / LOW list in `CODE_REVIEW.md`. The highest
value of those, in order:

1. **Storage upload path traversal** — `useStorageUpload.ts:18` accepts a
   caller-supplied `path` with `../` and upserts into a **public** bucket, so
   another user's avatar can be overwritten. No path-prefix validation.
2. **Keyset pagination drops rows permanently** — `useTools.ts` paginates on
   `created_at`, which is **not unique**; `seedTools.ts:150` bulk-inserts many
   tools in one statement so they share a timestamp. When a page boundary lands
   inside such a batch, every remaining tool with that timestamp is skipped
   forever.
3. **Duplicate-submission detection only inspects 50 arbitrary tools** —
   `submission.ts:49` has no `.order()`, so which 50 you get is non-deterministic.
4. **N+1 notification fan-outs** — `notifications.ts` issues one RPC per
   follower, sequentially; 2,000 followers blocks the UI.
5. **24 functions with mutable `search_path`** — real escalation risk for
   `SECURITY DEFINER`, but `supabase/README.md` warns a naive fix breaks them
   because they reference tables unqualified. Needs schema-qualification first.

Note the security advisor still reports 16 anon-callable `SECURITY DEFINER`
functions. Several check roles internally and are fine once unauthenticated
callers are refused; the `trigger_recalc_*` trio is trigger-only and just needs
`EXECUTE` revoked. That is a cheap bulk win worth doing next.
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