# Tool-scribes — Full Code Review

> **Purpose of this file:** context handoff. If you are a new AI session, read this
> file first — it contains a complete audit of the codebase. Do **not** re-run a
> full file-by-file review; go straight to fixing or extending it.
>
> ⚠️ **Read `FIX_PROGRESS.md` first.** It records what has already been fixed
> (critical #1, #2, #3, #4, #16 are done) and what to do next. The findings
> below are the **original** audit — some are now stale. Cross-check against
> FIX_PROGRESS.md before acting on anything here.
>
> **Status at time of writing:** 126 TypeScript errors existed and `vite build`
> never checked them. Both are now fixed (commit `862ace6`) — see FIX_PROGRESS.md.
> `npx vitest run` → 17 tests passing, but near-tautological.
> **Stack:** React 18 + Vite 8 + TypeScript + Supabase (Postgres/Auth/Storage/Edge Functions).
> **Product:** curator tool-discovery platform — collections, reviews, vault, follows.

---

## Table of Contents

- [How to resume work from this file](#how-to-resume-work-from-this-file)
- [Executive summary](#executive-summary)
- [CRITICAL findings](#critical-findings)
- [HIGH findings](#high-findings)
- [MEDIUM findings](#medium-findings)
- [LOW findings](#low-findings)
- [Recommended new features](#recommended-new-features)
- [Suggested fix order](#suggested-fix-order)

---

## How to resume work from this file

This section is the handoff contract for the next session.

**Do not:** re-audit `src/` from scratch. The findings below were produced by reading
all ~200 source files (`src/`, `supabase/functions/`, config, tests, docs) and are
accurate as written, including line numbers.

**Do:** verify a finding still exists before fixing it, since code may have moved.
Prefer to fix in the order given by [Suggested fix order](#suggested-fix-order).

**Ground rules that keep this repo coherent:**
- `AGENTS.md` (repo root) holds project context and DB conventions — read it too.
- The live Supabase DB (`supabase/schema_structure.sql`, `supabase/functions.sql`) is
  the schema source of truth. Those two files are **generated snapshots — never hand-edit.**
- `supabase/migrations/` contains only migrations genuinely applied to production.
  Adding a file there without applying it makes `supabase db push` replay it.
- `supabase/README.md` lists known open schema/security issues (several overlap this review).

**One command that should have been run all along:**

```bash
npx tsc -b        # 152 errors — these ship silently today
```

`package.json:8` is `"build": "vite build"` with **no** `tsc -b`, so type regressions
merge to main invisibly. Adding `tsc -b` to the build script is the single highest-
leverage change and would have caught ~10 of the critical findings.

---

## Executive summary

| Area | State |
|---|---|
| Build / CI | **No typecheck in build. No CI at all. Playwright config unrunnable.** |
| AI edge functions | **Both are broken — wrong import path. Deployed without JWT verification.** |
| Auth / authz | **Multiple privilege-escalation paths via client-writable columns.** |
| Data layer | RLS is the only line of defence; several columns should never have been client-writable. |
| Search | Substring matching, no ranking, no server-side search, injectable filters. |
| Tests | 17 assertions, one of which tests the wrong `hashId`. No e2e. No coverage. |
| Accessibility | ~40 issues; no Escape handling anywhere; duplicate `useAuth()` instances. |
| Design system | Token drift — hardcoded hex breaks dark mode on ~20 files. |

**The three things to fix first:**

1. Both edge functions import `"./_shared/rate-limit.ts"`, which does not exist →
   **AskToolScribe and AI profile generation are 100% dead.** One-character-class fix.
2. Edge functions deployed with `--no-verify-jwt` + no auth check →
   **anyone can overwrite any tool's AI summary and burn your AI budget.**
3. `reviews.moderation_status`, `tools.upvotes`, and `profiles.reputation_score` are all
   **client-writable** → users can self-moderate, forge upvotes, and self-assign reputation.

---

## CRITICAL findings

### Broken AI backend — these features are dead

**1. Both edge functions cannot boot.**
`supabase/functions/ask-toolscribe/index.ts:2` and
`supabase/functions/generate-ai-profile/index.ts:2` both import:

```ts
import { checkRateLimit } from "./_shared/rate-limit.ts";
```

That file only exists at `supabase/functions/_shared/rate-limit.ts`. Confirmed by
directory listing — neither function directory contains `_shared/rate-limit.ts`
(only `ai-provider.ts` is duplicated per-function).
**Fix:** change to `"../_shared/rate-limit.ts"`.

**2. Unauthenticated arbitrary write to `tools`.**
`supabase/functions/generate-ai-profile/index.ts:194-227` builds a service-role
`PATCH /rest/v1/tools?id=eq.${toolId}` for `ai_summary`,
`ai_profile_generated_at`, and `ai_profile_version`, with **no auth check anywhere in
the handler**. Combined with #4, anyone can overwrite the AI summary of any tool.
`forceRegenerate: true` (`:79`) additionally bypasses the cache → unlimited paid
OpenRouter/Gemini calls on your key.

**3. Rate limiting is functionally a no-op.**
`supabase/functions/_shared/rate-limit.ts:4` stores counters in an in-process `Map`.
Edge Functions run many horizontally-scaled containers, so the effective limit is
`containers × 10/min`. Worse, `ask-toolscribe/index.ts:56` and
`generate-ai-profile/index.ts:54` key on `x-forwarded-for` — a plain client-settable
header — so rotating it per request yields unlimited throughput.
Secondary: the computed `retryAfter` is discarded at `ask-toolscribe/index.ts:59` and
`generate-ai-profile/index.ts:57`, so no `Retry-After` header reaches the client.
Also, `setInterval` at `rate-limit.ts:24` keeps the isolate warm (billed CPU).

**4. Deployed with JWT verification disabled, and no `config.toml` to catch it.**
`scripts/deploy-ask-toolscribe.ps1:8` and `scripts/deploy-ask-toolscribe.sh:10` pass
`--no-verify-jwt`. `supabase/config.toml` does not exist.
Combined with `Access-Control-Allow-Origin: "*"` (`ask-toolscribe/index.ts:40-44`),
these are anonymous public endpoints reachable cross-origin.

### Privilege escalation / data tampering

**5. Any user can un-hide their own moderated review.**
`src/hooks/useReviews.ts:113-128` — `moderateReview` issues a raw
`supabase.from('reviews').update({ moderation_status: status, moderated_by, moderated_at })`.
The only gate is the RLS policy `reviews: self update ... USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())` (`supabase/schema_structure.sql:618`) — the
`WITH CHECK` validates **only** `user_id`, not `moderation_status`. A user who owns a
`rejected`/`hidden` review can PATCH `moderation_status='active'`, and it becomes
publicly readable under `reviews: public read active` (`schema_structure.sql:615`).
There is no `SECURITY DEFINER` RPC and no column-level grant for moderation writes.

**6. Tool author can rewrite `upvotes`.**
`src/hooks/useTools.ts:307-312` (`updateScreenshot`) and `:314-324` (`updateAiProfile`)
call `.from('tools').update(...)` straight from the browser. Combined with
`tools: owner update USING (added_by = auth.uid())` (`schema_structure.sql:646`),
the **tool author** — not just an admin — can PATCH any column on their own tool row
including `upvotes`, `price_model`, and `added_by`. The upvote counter that
`increment_upvote` (`functions.sql:534`) is supposed to protect is directly settable.
Neither function checks the response `error`, so an anonymous call silently no-ops.

**7. `increment_upvote` lets anyone decrement any counter.**
`supabase/functions.sql:534-550` — the ownership guard only raises for `delta = 1`.
A caller with **no** `upvotes` row can pass `delta = -1` in a loop and drive any tool's
`upvotes` negative. `src/hooks/useTools.ts:224` deletes the upvote row *before* calling
with `-1`, which is exactly the state that bypasses the guard.
The repo's own comment (`functions.sql:529-532`) flags this as unfixed.

**8. `clone_public_collection` writes into arbitrary user accounts.**
`supabase/functions.sql:114-141` is `SECURITY DEFINER` and accepts `target_user_id`
as a parameter with **no `= auth.uid()` comparison** — any authenticated user can
create collections owned by someone else.
Acknowledged unfixed at `functions.sql:109-112` and `supabase/README.md:48-50`.

**9. Any authenticated user can set `reputation_score`.**
`src/hooks/useProfile.ts:157-167` — `updateProfile({ ...updates, updated_at })` takes
`Record<string, unknown>` and spreads it verbatim into the UPDATE.
`profiles: self update USING (user_id = auth.uid())` (`schema_structure.sql:605`) has no
column restriction, so `reputation_score` and `last_seen_notifications_at` are
self-assignable. Today `ProfileSettingsModal` only builds whitelisted fields, so this
is **latent** — but the hook offers no allowlist and the type system cannot catch a bad key.

**10. Email enumeration via `SECURITY DEFINER` functions.**
`get_creator_email` (`functions.sql:284`) and `get_submitter_email`
(`functions.sql:390`) are `SECURITY DEFINER`, read `auth.users.email`, have no
authorization check, and no `REVOKE ... FROM anon`. Anonymous users can enumerate every
user's email by iterating collection/submission UUIDs.

### Injection / SSRF / XSS

**11. PostgREST filter injection ×2.**
- `generate-ai-profile/index.ts:84, 199, 212` interpolates `toolId` straight into
  `?id=eq.${toolId}` with no UUID validation and no `encodeURIComponent`. A crafted
  `toolId` containing `,` `(` `)` rewrites the filter. (Contrast the catalog path at
  `ask-toolscribe/index.ts:108`, which does not interpolate.)
- `src/lib/search/simple-engine.ts:18-19` interpolates each search token into
  `name.ilike.%${safe}%` and joins with `,`. `escapeLike` (`:7-9`) escapes `%`, `_`, `\` —
  the SQL `LIKE` pattern — but **not** the PostgREST filter grammar. So `q,category.eq.dev`
  injects an equality condition. Passed to `.or()` at `:49, :70, :95`.

**12. The SSRF guard is decorative.**
`generate-ai-profile/index.ts:26-48` only matches a dotted-quad IPv4 regex. It passes:
`[::1]`, `http://2130706433/`, `http://0177.0.0.1/`, `http://metadata.google.internal/`,
and any DNS name resolving to `169.254.169.254`. It also doesn't set `redirect: 'manual'`
(`fetch` follows redirects by default, `:121`), so an allowed host can 302 to the
link-local metadata service. The check reads as protection but provides almost none.

**13. Prompt injection via client-supplied `toolContext`.**
`ask-toolscribe/index.ts:91-99` interpolates `ctx.name`, `ctx.description`, `ctx.tags`,
`ctx.features`, `ctx.reviewsSummary` — all attacker-controlled — into the **user**
message, and the catalog is never fetched to verify the tool exists (contrast the
non-ctx branch at `:106-113`). Trivial instruction override for any public API caller.

**14. Stored XSS via `contact_url`.**
`src/pages/ProfilePage.tsx:625` and `:705` call
`window.open(contactUrl, '_blank', 'noopener,noreferrer')` on the **raw DB value**,
while the same field is normalized/validated on save
(`ProfileSettingsModal.tsx:112-120`) and again for display (`ProfilePage.tsx:86` `parseContactUrl`).
Any row whose `contact_url` is not `https://…` (legacy data, direct DB write, future code
path) turns another user's "Message" button into script execution.

**15. No input size limit on either function.**
`ask-toolscribe/index.ts:69` only checks `query` is non-empty; `toolContext.tags`,
`features`, and `reviewsSummary` (`:78-98`) are unbounded arrays/strings from the client,
forwarded to paid endpoints with 4096 output tokens each. Direct cost/DoS vector.

### Build / deploy integrity

**16. `vite build` never typechecks — 152 errors ship silently.**
`package.json:8` is `"build": "vite build"` (no `tsc -b`) while `tsconfig.app.json` sets
`strict: true, noUnusedLocals: true, noUnusedParameters: true`.
Real bugs hiding in the 152, not just unused imports:

| Location | Error | Consequence |
|---|---|---|
| `ProfilePage.tsx:478` | reads `profile?.avatar_url`, but `Profile` (`lib/types.ts:137-163`) only has `avatarUrl` | OG image always `undefined`; every profile falls back to default |
| `components/ReputationBadge.tsx:2` | `Module '"@/lib/types"' has no exported member 'REPUTATION_TIERS'` | component cannot compile |
| `components/ReviewCard.tsx:30` | `Property 'catch' does not exist on type 'PromiseLike<void>'` | the error handler never fires |
| `hooks/useTools.ts:122` | `Type 'string \| null' is not assignable to type 'string \| undefined'` | null-leak into `Tool` |
| `lib/supabase.ts:22` | `Type '"public"' is not assignable to type 'never'` | client type is broken |
| `components/Navbar.tsx:353` | `Property 'userAgentData' does not exist on type 'Navigator'` | — |
| `pages/AdminTagModerationWrapper.tsx:7` | `Type '{}' is missing: activeTab, onTabChange, onAddTool, onAuthClick` | admin nav broken |
| `pages/MyProfilePage.tsx:96, 156` | `Tool[]` / `Review` missing `priceModel`, `rating`, … | type mismatch across the whole review pipeline |
| `lib/search/simple-engine.ts:75` | invalid `as` cast on a nested relation | hides a real shape bug |

~110 of the 152 are `TS6133` unused-symbol errors, which also means a lot of **dead code**
(see the dead-code list in LOW).

**17. `supabase/.temp/*` is git-tracked.**
Confirmed via `git ls-files`. Leaks project ref `qglvwvpsegrucrhcpzxd`, project name
"Pass", org slug, and the AWS pooler hostname — exactly what `supabase/README.md:43-44`
says must not be committed.
Meanwhile `.gitignore:28` ignores `.env.example`, so the onboarding template is never
committed (yet `src/main.tsx:38` tells users to look for it).

**18. CSP silently kills all JSON-LD structured data.**
`index.html:24` sets `script-src 'self'` with no `'unsafe-inline'` and no nonce.
`src/components/SEO.tsx:66-70` emits `<script type="application/ld+json">` through Helmet
(an inline script) → blocked. Zero rich results despite structured data being authored
for tool/collection/profile pages.

**19. Clickjacking protection is inert.**
`index.html:24` sets `frame-ancestors 'none'` inside a `<meta http-equiv="Content-Security-Policy">`
— `frame-ancestors` and `sandbox` are **ignored** when CSP is delivered via meta.
`index.html:25`'s `<meta http-equiv="X-Frame-Options" content="DENY">` is also ignored by
every browser (only HTTP headers count). The file *looks* protected and provides zero
defense. The `FocusTrap`-based dialogs (`AskToolScribeModal.tsx:52`) are the targets.

**20. Production error reporting is stripped from the bundle.**
`vite.config.ts:24-27` sets terser `drop_console: true`, which removes `console.error`
as well as `console.log`. `src/components/ErrorBoundary.tsx:20` is the app's only global
error sink, plus ~15 other `console.error` sites (`ProfileSettingsModal.tsx:151` even
tells the user to "check console for details"). Production crashes are unobservable.

**21. Playwright e2e is unrunnable, and there is no CI.**
`playwright.config.ts:1` and `playwright-fixture.ts:3` import
`lovable-agent-playwright-config`, which is in **neither** `package.json` **nor**
`package-lock.json`. Verified: `npx playwright test --list` →
`Cannot find package 'lovable-agent-playwright-config' imported from playwright.config.ts`.
There is also no `.github/workflows` in the project root, so nothing runs `npm test`
or a build on push.

### Broken UX on primary routes

**22. `ToolDetailPage` flashes "Tool not found" on every load.**
`src/pages/ToolDetailPage.tsx:149` (`if (!tool)`), with no `loading` prop from
`ToolDetailWrapper.tsx` (which owns `useTools`). `tools` is `[]` until the query resolves.
Every shared `/tool/:id` link, back-navigation and refresh shows a false error screen
before the real content.

**23. `/collections/:id` flashes "Collection not found" and is owner-only.**
`src/pages/CollectionPage.tsx:25` resolves the id against `useCollections()` (current
user's rows only) and `:52` bails with no loading state. Anonymous/deep-linked visits
always show the error; other users' collections are unreachable on this route
(the public route is `/c/:uuid`).

**24. All tool mutations silently no-op off the first page.**
`src/hooks/useTools.ts:152-154` — `getUuid(numId)` resolves the numeric hash → UUID by
scanning only `toolsRef.current` (the paginated array, `PAGE_SIZE = 100` at `:51`).
Every mutation early-returns `if (!uuid)`:
`toggleUpvote` (`:214`), `saveToVault` (`:239`), `toggleFavorite` (`:204`),
`updateNotes` (`:247`), `recordVisit` (`:276`).
Deep-linking to `/tool/<hash>` for any tool outside the loaded page gives a detail page
where upvote/save/notes silently do nothing.

---

## HIGH findings

### Security / integrity

- **`cloneCollection` reimplements the RPC client-side.**
  `src/hooks/useCollections.ts:191-234` does 4 sequential round-trips (read collection →
  read `collection_tools` → insert collection → insert N tools) with no transaction, and
  **never increments `clone_count`** (which only `functions.sql:137` does). Combined with
  `usePublicCollections.ts:143` reading `clone_count`, the `'clones'` sort at
  `usePublicCollections.ts:215-217` is permanently a no-op ordering. A partial failure
  leaves an empty orphaned collection with no rollback (`catch` at `:230-233` only logs).
- **`get_vault_recommendations(p_user_id, ...)` has no `auth.uid()` check.**
  `functions.sql:460` is `STABLE SECURITY INVOKER` — any caller can request another user's
  vault-derived recommendations by passing their id. Low-sensitivity leak, but it's the
  only RPC not hardened by migration `20260918072914`.
- **`followCollection` performs no visibility check.**
  `src/hooks/useCollections.ts:247-254` inserts into `collection_followers` for an arbitrary
  `collectionUuid`. The RLS policy is `cf: owner insert WITH CHECK (user_id = auth.uid())`
  (`schema_structure.sql:559`) with **no** requirement that the collection be public.
  A user can follow (and thereby enumerate) private collection UUIDs, and
  `useFollowingFeed.ts:128-132` then silently hides them.
- **Storage upload path traversal.**
  `src/hooks/useStorageUpload.ts:18-19` — `const ext = file.name.split('.').pop();
  const filePath = path || ...` with `upsert: true` on a **public** bucket
  (`schema_structure.sql:678-681`). A caller-supplied `path` containing `../` can overwrite
  another user's avatar; no path-prefix validation against `session.user.id`.
  Buckets `avatars`/`banners`/`collection-covers` have `size_limit: null, mime_types: null`.
  Also `:35-45` `remove(path)` trusts the caller's path with no prefix verification.
- **Upstream provider error text is returned to the client.**
  `generate-ai-profile/index.ts:186-188` interpolates `errMsg` — originating from
  `ai-provider.ts:81` (`Gemini API error: ${errText}`) — into the JSON response body.
  Leaks upstream account/quota/rate-limit details and internal model names to anonymous callers.
- **No timeout on either AI provider fetch.**
  `_shared/ai-provider.ts:46` (OpenRouter) and `:70` (Gemini) call `fetch` with no `signal`.
  Contrast the page fetch, which correctly uses `AbortSignal.timeout(8000)` at
  `generate-ai-profile/index.ts:122`. A hung upstream holds an edge container until the
  platform wall-clock limit; combined with #3 there is no back-pressure.
- **Edge functions log full prompts and raw upstream bodies.**
  `_shared/ai-provider.ts:34-40` logs the first 200 chars of the prompt (user query +
  tool descriptions); `:52-57` dumps every OpenRouter response header; `:60-61` dumps the
  raw response body. `generate-ai-profile/index.ts:68, 106, 120, 125` additionally logs
  tool names, URLs, and DB error bodies.
- **User-submitted URLs forwarded to a third-party CORS proxy.**
  `src/lib/fetchMetadata.ts:13` routes every submit-tool URL through
  `https://corsproxy.io/?…`. Discloses user-submitted URLs to an uncontrolled third party.
  No `AbortSignal`, no `response.ok` check before parsing (`:14-15`), and the inner `catch`
  at `:38` shadows the outer `e` and re-parses a `new URL` that already threw.
- **Third-party proxy outage marks every tool unhealthy.**
  `src/lib/health.ts:61` routes all health checks through `corsproxy.io`.
  `:50-89` records proxy failures as `'warning'` health status, and `runHealthCheck`
  (`:113-156`) persists that to `tool_health` and appends to `health_check_log`.
  A proxy outage marks the entire database unhealthy.

### Data correctness

- **Duplicate-submission detection only inspects 50 arbitrary tools.**
  `src/lib/submission.ts:49-52` does `.select('id, name, url').limit(50)` with
  **no `.order()`**, then loops client-side (`:56-61`). Past 50 tools the guard misses most
  real duplicates, and which 50 you get is non-deterministic.
- **Pagination is client-side over an unbounded RPC result.**
  `src/lib/submission.ts:166-188` — `get_submissions_for_review()` returns the *entire*
  table (`functions.sql:380`), then filters/sorts/slices in JS. `cursor` is applied *after*
  the `status` filter (`:175-183`), so paging within a filtered set skips rows. `error` at
  `:171-172` is collapsed into `{ data: [], nextCursor: null }`, making a 403
  indistinguishable from "no submissions".
- **Keyset pagination on a non-unique column drops rows permanently.**
  `src/hooks/useTools.ts:71-79` + `:128-129` — cursor is `created_at` with
  `.lt('created_at', cursor)`. `src/lib/seedTools.ts:150-153` bulk-inserts many tools in
  one statement, so they share an identical `created_at`; when a page boundary lands
  inside such a batch, every remaining tool with that timestamp is skipped forever.
- **Trending "save count" metric is permanently zero.**
  `src/pages/DiscoverPage.tsx:65-130` closes with `}, [])` but reads `tools` at `:124`
  inside the closure; at mount `tools` is `[]`, so `byNumId` is always `{}`.
  The trending score (`:139`) silently drops the `saves * 2` term.
- **"0 Followers" on your own profile, forever.**
  `src/pages/MyProfilePage.tsx:421` shows `profile.followerCount`, which
  `src/hooks/useProfile.ts:137, 149` hardcodes to `0` for the current user.
- **View counter inflated and owner-only.**
  `src/pages/PublicCollectionPage.tsx:85-92` — client-side read-modify-write of
  `view_count` inside an effect keyed on `[uuid, user?.id, authLoading]` (`:200`) → every
  auth-state change adds another view. `collections: owner all` means a non-owner's
  increment is rejected by RLS and the error is discarded, so `view_count` only ever
  increments for owners. Lost-update race as well.
- **Featured collection has two sources of truth.**
  `src/pages/MyCollectionsPage.tsx:19, 48-54` writes `localStorage['featuredCollection']`,
  but the profile renders `profile.featuredCollectionId` from the DB
  (`ProfilePage.tsx:289, 320-325`, set via `ProfileSettingsModal.tsx:139`).
  Starring a collection in "My Collections" appears to do nothing on the public profile.
- **Deleting a collection leaves other users' profiles dangling.**
  `src/hooks/useCollections.ts:123-131` — the cleanup
  `UPDATE profiles SET featured_collection_id = NULL WHERE featured_collection_id = uuid`
  is scoped by `profiles: self update` to the caller's own row, so it **cannot** clear
  another user's pointer, and its `error` is never destructured. The DELETE proceeds anyway.
- **`moderateTag` returns inverted success.**
  `src/lib/tags.ts:161-167` — `return !error;` conflates "denied" with "failed", and
  `moderatorId` is taken from client input rather than resolved server-side.
- **`suggestAlternative` attributes suggestions to arbitrary users.**
  `src/lib/alternatives.ts:111-126` — `created_by: userId` is client-asserted (RLS
  `alternatives: auth insert` only checks `auth.uid() IS NOT NULL`,
  `schema_structure.sql:628`), and the `reason` parameter is accepted but never sent.

### UX bugs

- **The "flagged" moderation tab can never match anything.**
  `src/components/AdminReviewModeration.tsx:95` filters `r.review.moderation_status === filter`,
  but flagged rows keep `moderation_status: 'active'` + `is_flagged: true`
  (the tab is offered at `:132` and counted at `:97`).
  The header says "N flagged" while the body always renders "No reviews match this filter".
- **Optimistic rename rollback is a no-op.**
  `src/hooks/useCollections.ts:114` —
  `setCollections(prev => prev.map(c => c.id === numId ? { ...c, name: c.name } : c))`
  re-applies the **new** name (`c` is already the post-optimistic value), so a failed rename
  is never reverted. `:120-121, :135` also restore a stale snapshot captured from the render closure.
- **`useTools.ts:186-189` throws the wrong error variable.**
  `const { error: vErr } = await ...vault_items.insert(...)` then `if (vErr) throw tErr;`
  — `tErr` is `null` at that point. The catch logs `addTool error null`, the real message is
  discarded, and the tool row is already committed → user gets a vault-less tool.
- **Floating promise chain, no `.catch`, invisible notification failures.**
  `src/hooks/useCollections.ts:88-98` — `supabase.from('profiles')...maybeSingle()
  .then(({ data: me }) => notifyNewCollection(...))` is neither awaited nor error-handled.
  `src/lib/notifications.ts:16-27` discards the RPC result entirely.
- **Notifications beyond 50 are unreachable.**
  `src/hooks/useNotifications.ts:44` hard-pages at `p_limit: 50, p_offset: 0`.
  `get_notifications` supports `p_offset` (`functions.sql:312`) but the hook never advances it.
- **Reviews beyond 100 are unreachable.**
  `src/hooks/useReviews.ts:8, 43-49` — hard `PAGE_SIZE = 100` with no next-cursor and no
  "load more" path at all.
- **Search race condition.**
  `src/hooks/useSearch.ts:33-39` — `runSearch` is `useCallback([filters])` and the debounce
  effect depends on `[query, runSearch]`, so `setFilters` re-arms the 250 ms timer against the
  *stale* `query`. No request sequencing, so a slow response for query A can land after query B.
  `const DEBOUNCE_MS` is declared but the literal `250` is hardcoded at `:37`.
  `user` (`:8`) is destructured and never used.
  Same pattern: `components/SuggestAlternativeModal.tsx:42-45` (plus an unhandled rejection).
- **Full-table scans on every tool-list page.**
  `src/hooks/useTools.ts:86-89` and `:92-96` — `.select('*')` with no `.limit()`/`.range()`
  on `vault_items` and `upvotes`, run on *every* `fetchAll` page load (including every
  `fetchMore`), just to decorate 100 tools. Grows linearly with the user's vault.
- **Cross-user admin count leak via react-query cache key.**
  `src/hooks/useModerationCounts.ts:40` — `queryKey: ['moderation-counts']` is global, and
  there is no `queryClient.removeQueries`/reset on `onAuthStateChange` anywhere
  (`src/App.tsx:39-46` creates the client with no session handling). With `staleTime: 25_000`
  (`:43`), an admin who signs out and a second user signs in within that window sees the first
  admin's pending counts. This is the only react-query query in the app, so it's also the only
  cache-leak vector.
- **N+1 on the tool detail page.**
  `src/components/ReviewCard.tsx:24-31` — one tool query **per review card**.
- **Dropdown fetches the entire tools table.**
  `src/components/ProfileSettingsModal.tsx:83` — `select('id, name')` on all of `tools`
  just to fill one dropdown.
- **Form edits are wiped by profile identity changes.**
  `src/components/ProfileSettingsModal.tsx:52-74` and `src/pages/SettingsPage.tsx:51-58`
  reset every field whenever the `profile` object identity changes — i.e. after `updateProfile`.
- **8 sequential round-trips in one effect.**
  `src/pages/ProfilePage.tsx:129-318` — several awaited in series.
- **`VaultPage` refetches all tool health on every tools identity change.**
  `src/pages/VaultPage.tsx:43-51` — i.e. every upvote/save/note edit.

### Accessibility

- **Nested `<button>` inside `<button>`** — `AdminHealthPage.tsx:136` row button contains
  action buttons at `:153, :162, :171`; `CollectionCard.tsx:43` card button contains the
  curator button at `:87`. Invalid HTML → `validateDOMNesting` warnings, unpredictable click
  targets, inner controls invisible to screen readers.
- **Mobile drawer is a permanent `aria-modal` dialog in the tab order.**
  `src/components/Navbar.tsx:490-497` — the panel is always rendered, only translated
  off-screen when closed, and still carries `role="dialog" aria-modal="true"` with focusable
  children. Screen readers announce a modal that isn't open; off-screen buttons stay tabbable.
- **No Escape handling anywhere.**
  `src/components/FocusTrap.tsx:26-45` traps only `Tab`. So `AuthModal`, `AddToolModal`,
  `SubmitToolModal`, `ProfileSettingsModal`, `MyReviewsPage.tsx:262` cannot be dismissed with Esc,
  and the delete confirms at `CollectionPage.tsx:225-247` and `PublicCollectionPage.tsx:594-616`
  have no `role="dialog"`, no `aria-modal`, no focus trap, no Esc — keyboard users can get
  stuck in destructive confirmations.
- **`useAuth()` is not a provider — 31 component/hook instances on the page.**
  `src/hooks/useAuth.ts:13` is a plain hook; each instance = `getSession()` + its own
  `onAuthStateChange` subscription + 2 role RPCs at `:22-27`. Call sites include
  `Navbar.tsx:27`, `useTools.ts:54`, `useCollections.ts:26`, `useReviews.ts:30`,
  `useNotifications.ts:29`, `useSearch.ts:8`, `useProfile.ts:39, 92, 191`, plus every page/wrapper.
  On `/tool/:id` there are ~7 instances → ~7 `getSession` calls, 7 auth listeners and
  ~14 `is_admin`/`is_moderator` RPCs per navigation.
- **Password-visibility toggle removed from the tab order.**
  `src/pages/ResetPasswordPage.tsx:97-103` uses `tabIndex={-1}` with no `aria-label`/`aria-pressed`.
  Keyboard-only and screen-reader users cannot reveal the password they typed (WCAG 2.1.1).
- **`role="switch"` buttons with no accessible name** —
  `SettingsPage.tsx:200-206, 236-242`, `ProfileSettingsModal.tsx:426, 440, 454, 468`.
- **Labels not programmatically associated** (no `htmlFor`/`id`) —
  `SettingsPage.tsx:162, 169, 177, 319`, `ReviewForm.tsx:83, 104, 116, 128`,
  `MyReviewsPage.tsx:285, 298, 303, 308`, `AddToolModal.tsx:99, 138, 144, 156`,
  `SubmitToolModal.tsx:247, 253, 265, 321`, `ProfileSettingsModal.tsx:194-422` (entire form).
- **Star-rating buttons with no name/state** —
  `ReviewForm.tsx:86-94`, `MyReviewsPage.tsx:288-291` (no `aria-label`, no `aria-pressed`,
  no radiogroup semantics).
- **Icon-only buttons with no accessible name** (`title` at best, often nothing) —
  `VaultPage.tsx:210`, `ToolDetailPage.tsx:274, 345, 393`, `VaultGridCard.tsx:96, 145, 151`,
  `CollectionPage.tsx:101, 107, 113, 116`, `PublicCollectionPage.tsx:375, 382, 385, 536`,
  `MyCollectionsPage.tsx:217-260` (6 buttons), `MyProfilePage.tsx:322, 327, 332` (no `title` at all),
  `ProfilePage.tsx:574, 579, 584`, `AdminTagModeration.tsx:83-96`, `AdminHealthPage.tsx:152-178`,
  `TagsPage.tsx:27`, `SubmitToolModal.tsx:174`, `SuggestAlternativeModal.tsx:73, 107`.
  Also **hover-only reveal** (`opacity-0 group-hover:opacity-100`) on `VaultGridCard.tsx:144`,
  `AdminHealthPage.tsx:152`, `TagPage.tsx:158` hides these from keyboard/screen-reader users entirely.
- **Clickable non-interactive elements** (no `role`/`tabIndex`/key handler, unlike the
  correct `VaultGridCard.tsx:70-72` and `TagPage.tsx:138-140`) —
  `ProfilePage.tsx:759, 814, 875, 942`, `DiscoverPage.tsx:650` (`FeaturedCard` `motion.div onClick`),
  `DiscoverPage.tsx:723` (`AllToolsCard`), `MyProfilePage.tsx:456`, `VaultDustSection.tsx:51, 63`,
  `AskToolScribeModal.tsx:124-127`, `AlternativeCard.tsx:23`, `Navbar.tsx:171-178` (logo).
  These cards are the **primary navigation affordance** on profile/discover.
- **Modal semantics inconsistent** —
  `SuggestAlternativeModal.tsx:65` has no `role="dialog"`, no `aria-modal`, no `FocusTrap`
  (unlike every other modal); `SearchEverywhere.tsx:121-199` has no dialog semantics, no focus
  trap, no focus restoration; `AddToCollectionModal.tsx:42`, `CreateCollectionModal.tsx:31`,
  `TagSuggestModal.tsx:32` use `z-50` while other overlays use `z-100/110/120/200`.

### Dead / broken links and dead code

- **Dead deep-link.** `MyReviewsPage.tsx:131` navigates to `/tool/${id}?review=${uuid}`,
  but nothing in the codebase reads `searchParams` (verified by grep) → clicking a review row
  just lands on the tool page with no scroll/highlight.
- **Dead controls.**
  `MyProfilePage.tsx:347-352`: "Follow" and "Message" buttons have **no `onClick`** on your own profile.
  `CollectionDetailWrapper.tsx:64`: `AddToolModal … onAdd={() => {}}` → "Add tool" silently does nothing.
  `ReviewCard.tsx:47-52`: author button is a no-op when `authorUsername` is null.
  `VaultGridCard.tsx:119-121`: "Add To Collection" just navigates to the tool page.
  `ReviewCard.tsx:63-65`, `NavNotificationPanel.tsx:25-44`: `getNotificationAction` returns an
  `onClick` that is never used.
- **`/tool/0` links.** `MyProfilePage.tsx:153` and `MyReviewsPage.tsx:75` fall back to
  `toolId: 0` when the tool lookup misses → "Tool not found".
- **Advertised but unimplemented shortcuts.**
  `SearchEverywhere.tsx:196-197` shows `↑↓ Navigate / ↵ Open` — not implemented anywhere.
- **Review notifications never fire.** `useReviews.ts:5` — `notifyNewReview` is imported but
  never called. Already documented in `supabase/README.md:55-56`.
- **`moderateReview` has zero call sites** (`useReviews.ts:113-128`) — and it is the *only*
  writer of `moderated_by`/`moderated_at`, so `AdminReviewModeration.tsx` reads a column nothing
  populates through this path.
- **5 dead exports in `useCollections.ts`** — `cloneCollection` (`:191`), `getCollectionsForTool`
  (`:236`), `followCollection` (`:247`), `unfollowCollection` (`:256`), `getIsFollowing` (`:267`).
  `PublicCollectionPage.tsx:240` calls `notifyCollectionFollowed` directly instead, duplicating
  the follow logic that `followCollection` already implements.
- **Dead tags code** — `useTagSubscriptions` (`tags.ts:108`) and `fetchTaggedTools` (`tags.ts:145`)
  have no call sites.
- **Dead components (0 references)** — `VaultDustSection.tsx`, `TrendingTags.tsx`,
  `ReputationBadge.tsx`, `TagBadge.tsx`, `BannerUpload.tsx`. Also `lib/search/engine.ts`
  (only `simple-engine.ts` is wired, at `App.tsx:47`).
- **Duplicate `use-toast`.** Both `src/components/ui/use-toast.ts` (shadcn) and
  `src/hooks/use-toast.ts` exist; nothing imports the shadcn one. `Toaster` is dead weight
  alongside `sonner`.
- **`AlternativeCard.tsx:51` can throw.**
  `'☆'.repeat(5 - Math.round(rating))` throws `RangeError` if `altAvgRating` is ever `>5`.
  That value is hardcoded `null`/`'util'` in `alternatives.ts:202-205`, so the rating display
  is already partly fake.

---

## MEDIUM findings

### Data layer

- **Entire vote history fetched on every render of the alternatives section.**
  `src/lib/alternatives.ts:75-77` — `.from('alternative_votes').select('alternative_id')` has
  **no `.eq('user_id', ...)` and no `.limit()`**. A user with 5,000 votes downloads 5,000 rows
  every time `fetchAlternatives` runs, just to answer "which of these N rows did I vote on".
- **Top-3-per-tool truncation done client-side.**
  `alternatives.ts:237-253` selects **all** approved `tool_alternatives` rows and then truncates
  to 3 per tool in JS. Should be a window function or a capped RPC.
- **Three serial N+1 notification fan-outs.**
  `src/lib/notifications.ts:59-73, 80-94, 101-115` — `for (const f of followers) await createNotification(...)`
  issues one RPC round-trip per follower, unbounded, sequentially. A curator with 2,000 followers
  blocks the UI for ~2,000 sequential requests. Should be one `INSERT ... SELECT` inside a
  `SECURITY DEFINER` function.
- **Unbounded follows fetch + O(n²) JS counting.**
  `useFollowingFeed.ts:87-95` — `.select('following_id', { count: 'exact' }).in('following_id', followingIds)`
  downloads every follow row for every followed curator, then `countRows.filter(...)` runs once per
  id inside a loop. Follow-heavy curators make this quadratic. `{ count: 'exact' }` was requested
  and ignored.
- **`getIsFollowing` is an N+1 by construction.**
  `useCollections.ts:267-277` — one query per collection UUID, invoked from list renders.
- **`getCollectionsForTool` fetches site-wide membership rows.**
  `useCollections.ts:236-245` — no `.eq('user_id', user.id)`; the `user` guard at `:237` is dead
  because the function then intersects against the local `collections` list.
- **5 mutations with zero error handling.**
  `useTools.ts:250-251, 260-261, 270-271, 283-284, 286` — `updateNotes`, `addTag`, `removeTag`,
  `recordVisit`, and the `dust_items` delete all discard `{ error }`. A rejected upsert leaves the
  optimistic UI state permanently wrong with no user-visible signal.
- **`recordVisit` is a read-modify-write race.**
  `useTools.ts:274-284` — `visit_count` is computed client-side from `toolsRef.current` and written
  via upsert. Two rapid clicks or two tabs lose increments.
- **Non-atomic `uptime_pct`.**
  `health.ts:126-136` — `.select('status, uptime_pct')` → JS weighted average → `upsert`.
  Concurrent health checks overwrite each other's decay.
- **`toolId` hardcoded to `0` in every `ToolHealth`.**
  `health.ts:101, 159, 183` — three separate construction sites all set `toolId: 0`, so any consumer
  keying a map by `toolId` (as the type `toolId: number` invites) collides on a single entry.
- **`sslValid` disagrees with itself.**
  `health.ts:146` (persisted) accepts `200/301/302`; `health.ts:166` (returned to caller) accepts
  only `200` → a correctly-redirecting tool is stored as SSL-valid but rendered invalid.
- **Recommendation RPC errors all discarded.**
  `recommendations.ts:36-43, 45-55, 57-67` — `getToolRecommendations`, `getVaultRecommendations`,
  `getSimilarCurators` destructure only `data`. A permission error silently renders as
  "no recommendations" and triggers the cold-start trending fallback.
- **Unbounded batch fetches that will exceed PostgREST URL limits.**
  `usePublicCollections.ts:49-53, 66-69, 81-84, 92-95, 107-110` — every public collection, every
  follower row, every `collection_tools` row, and every referenced tool are pulled into the browser.
  Also `userIds` is **not de-duplicated** at `:62-63` before `.in()`, producing a URL with one
  repeated UUID per collection by the same curator.
- **`Date.now()` called inside a sort comparator.**
  `usePublicCollections.ts:219-223` — the default `'trending'` comparator recomputes the decay term
  on every comparison, making ordering non-deterministic under React's memoization guarantees and
  inconsistent with the precomputed `_trendingScore` at `:178-189`.
- **Query `error` never destructured → failures render as empty.**
  `useReviews.ts:43-49` (`const { data: rows } = await ...` — a failed query yields `rows === null`,
  hits the early return at `:51`, and the UI renders "no reviews"). Same pattern at
  `useFollowingFeed.ts:60-63, 69-72, 79-82, 87-90, 128-132, 135-138, 147-150, 177-191` and
  `useNotifications.ts:37, 44`.
- **Uncatchable fetch failures leave permanent spinners** (no error state, `loading` never cleared):
  `PublicCollectionPage.tsx:117` (inner `.then` has no `.catch` → "Loading collection…" forever),
  `TagPage.tsx:24-51`, `SubmitToolModal.tsx:62-77` (stuck on "Fetching metadata…"),
  `AddToolModal.tsx:46-56` (`fetchMetadata` throw ⇒ `setFetching(false)` never runs),
  `AuthCallbackPage.tsx:14`, and `MySubmissionsPage.tsx:18` — `if (!user) return` never clears
  `loading`, so **logged-out users get an infinite spinner on a protected route**.
- **No error checks on health upserts.** `health.ts:138-156, 198-207`. `setToolHealthStatus` is
  admin-only by RLS (`schema_structure.sql:631`), so for anyone else it's a silent no-op the UI
  reports as success.
- **`useModerationCounts` fires four queries by default.**
  `useModerationCounts.ts:17-22, 38` — `enabled = true` by default, all four `error`s ignored,
  and `retry: 2` amplifies wasted requests that RLS will reject anyway.
- **Double submit on Enter.**
  `SubmitToolModal.tsx:248` — `onKeyDown Enter → handleSubmit` **inside** a `<form>` whose
  `onSubmit` also calls `handleSubmit`.
- **`notifyCollectionUpdated` sends empty actor identity.**
  `notifications.ts:97-116` — `actorUsername: ''` and `actorAvatarUrl: ''` are hardcoded at
  `:108-109`, so every "collection updated" notification renders blank.
- **`submitted_by` silently null for anonymous users.**
  `submission.ts:134-135, 150` — `getSession()` failure and "not signed in" are indistinguishable;
  `submitted_by: null` then violates `submissions: auth insert WITH CHECK (submitted_by = auth.uid())`
  (`schema_structure.sql:637`), producing a confusing RLS error instead of "please sign in".
- **Unclosed timers → state updates after unmount** (12 sites):
  `ToolDetailPage.tsx:172-179`, `CollectionPage.tsx:86`, `PublicCollectionPage.tsx:205`,
  `VaultGridCard.tsx:41`, `AddToolModal.tsx:35`, `SubmitToolModal.tsx:44`,
  `SearchEverywhere.tsx:29`, `SuggestAlternativeModal.tsx:35`, `TagSuggestModal.tsx:26`,
  `ProfileSettingsModal.tsx:148`, `AuthCallbackPage.tsx:20`, `ResetPasswordPage.tsx:28`.
  (Intervals/subscriptions *are* correctly cleaned: `useNotifications.ts:74-78`,
  `Navbar.tsx:48-59, 142-150`, `useAuth.ts:48` — no leaks there.)

### Search

- **No fuzzy matching, no ranking.** `simple-engine.ts:18-19` is bidirectional substring `ilike`
  only — `figm` misses `Figma`, `react query` misses `React Query`. No `.order()`, so `.limit(12)`
  (`:98`) returns 12 arbitrary rows; relevance is never computed. **There is no server-side search
  function/RPC at all** — the ranking logic simply doesn't exist.
- **Three declared filters are silently ignored.** `SearchFilters` declares `priceModel`,
  `isOpenSource`, `requiresLogin` (`src/lib/search/types.ts:8-10`); `SimpleSearchEngine.search`
  only ever reads `query` and `category`. Passing them is a no-op with no warning.
- **Category-only search always returns nothing.** `simple-engine.ts:35` lets `category`-only
  through the guard, but every result branch is wrapped in `if (hasQuery)` (`:44, :63`), so
  `total` stays 0. `useSearch.ts:19` has the same guard.

### Design / consistency

- **Token drift breaks dark mode on ~20 files.** `tailwind.config.ts:4` enables
  `darkMode: ["class"]` and `index.css:54-93` defines `.dark` overrides, but these pages hardcode
  light hex: `ProfilePage.tsx:388, 481, 493, 644, 737` (entire page:
  `backgroundColor:'#F0EDE6'`, `color:'#1a1a1a'`), `MyProfilePage.tsx:474, 322, 327, 332`,
  `CategoryFilter.tsx:31-32` and `SearchEverywhere.tsx:160-161` (`background:'#1C1917'` +
  `color:'#fff'` → dark-on-dark active chip), `ReviewForm.tsx:91, 96`,
  `MyReviewsPage.tsx:207, 209, 290, 292`, `ReviewCard.tsx:63, 65`,
  `ToolDetailPage.tsx:259, 261`, `DiscoverPage.tsx:332, 371, 410, 524`,
  `AlternativeCard.tsx:51`, `NotificationPanel.tsx:15-23`, `AddToolModal.tsx:167`,
  `SubmitToolModal.tsx:276`, `ImageCropDialog.tsx:98, 127`, `AvatarUpload.tsx:57`.
  The theme toggle produces unreadable/clipped UI on those screens, and the palette now lives in two places.
- **`@tailwindcss/typography` installed but not registered.** `package.json:72` vs
  `tailwind.config.ts:109` (only `tailwindcss-animate`). `components/Markdown.tsx:29` renders
  `prose prose-sm max-w-none`, so AI chat answers (`ToolDetailPage.tsx:382`) render with raw
  browser defaults — no spacing, oversized headings, default bullets on a dark surface.
- **Duplicate implementations:**
  - Two profiles: `pages/MyProfilePage.tsx` (tokens) vs `pages/ProfilePage.tsx` (hardcoded hex)
  - Two collection pages: `CollectionPage.tsx` (`/collections/:id`, private) vs
    `PublicCollectionPage.tsx` (`/c/:uuid`)
  - `collectionCoverGradient` copy-pasted 3× (`ProfilePage.tsx:68`, `MyProfilePage.tsx:29`,
    `CollectionCard.tsx:13`)
  - `toolColor`/`TOOL_COLORS` 2× (`ProfilePage.tsx:57-66`, `ReviewCard.tsx:11-17`)
  - `hexToRgba` 2× (`TagPage.tsx:172`, `TagsPage.tsx:97`)
  - `CATEGORY_EMOJIS` 2× (`SubmitToolModal.tsx:397` vs `lib/types.ts:165`)
  - Dust UI twice (`VaultPage.tsx:202-215` inline vs the unused `VaultDustSection.tsx`)
  - Clone/follow twice (`PublicCollectionPage.tsx:208-254` vs unused `useCollections` exports)
  - The same batch-join-then-`Map` pattern 4× (`usePublicCollections.ts:71-121`,
    `useFollowingFeed.ts:140-155`, `useCollections.ts:47-51`, `useTools.ts:99-115`) —
    four copies, four chances to be wrong
- **`AskToolScribeModal.tsx:16-20` never resets state on reopen** (unlike
  `AddToolModal.tsx:29-37`), so stale AI results reappear.

### SEO

- **`SEO.tsx:45-46` double-suffixes the title.** `titleTemplate="%s | Tool Scribe"` plus a
  `<title>` that already appends `| Tool Scribe` → "Figma | Tool Scribe | Tool Scribe"
  on 11 pages. (Verified against `react-helmet-async/lib/index.esm.js:735-741`.)
- **`<SEO>` missing entirely from the highest-value public routes:** `ToolDetailPage` /
  `ToolDetailWrapper`, `CollectionPage` / `CollectionDetailWrapper`, `TagPage`,
  `CollectionsHubPage`, `FollowingPage`, and all six `/admin/*` pages → these render the
  placeholder title from `index.html:7` with no canonical/OG/JSON-LD.
  `SEO` is imported but unused in `TagPage.tsx:2`, `FollowingPage.tsx:2`, `ToolDetailWrapper.tsx:20`.
- **Private pages are indexable.** `SettingsPage.tsx:341`, `MyCollectionsPage.tsx:66`,
  `MyReviewsPage.tsx:144`, `MySubmissionsPage.tsx:64`, `MyProfilePage.tsx:264` all emit real
  `<title>`/description/canonical and never pass `noindex` (only `NotFound.tsx:14` does).
- **`robots.txt` group ordering defeats every `Disallow`.** `public/robots.txt:4-15` declares four
  named groups (`Googlebot`, `Bingbot`, `Twitterbot`, `facebookexternalhit`) each with
  `Allow: /` and **no** disallows. Per RFC 9309 the most-specific matching group wins, so `/admin`,
  `/settings`, `/profile`, `/auth/` (`:18-25`) remain crawlable by exactly the bots that matter.
- **`robots.txt:26` is not valid robots.txt.** `Disallow: /*?*  # basic query-string crawl-bloat guard`
  — robots.txt has no comment syntax, so the trailing `#` and text become part of the path pattern
  and it never matches anything.
- **`sitemap.xml` has no `<lastmod>` and omits every indexable entity.**
  `public/sitemap.xml:1-26` contains only 4 static URLs; `:23-25` explicitly defers
  tools/collections/users to a generator that does not exist in this repo (no sitemap script in
  `package.json`, no sitemap route). Every tool/profile/collection deep link is undiscoverable.

### Config

- **`vercel.json` ships no security headers.** A single rewrite (`:2`) — no `headers` block, so no
  `Strict-Transport-Security`, `Permissions-Policy`, or `Cross-Origin-Opener-Policy`. Given the app
  embeds Supabase publishable keys and OAuth callbacks, HSTS is the notable omission.
  Also the catch-all rewrites missing asset requests to HTML with **200**, masking broken deploys.
- **`tsconfig.node.json:21` covers only `vite.config.ts`.** `vitest.config.ts`,
  `playwright.config.ts`, and `tailwind.config.ts` belong to **no** tsconfig project, so they get
  zero type-checking. `vitest.config.ts:6, 14` already duplicates `plugins:[react()]` and
  `resolve.alias` from `vite.config.ts:13, 14-18` — and the drift has already materialized
  (the missing `manualChunks`).
- **`tsconfig.json:3-13` sets `noImplicitAny: false` and `strictNullChecks: false`** with
  `"files": []`, directly contradicting `tsconfig.app.json:16, 25`. Dead config that misleads
  readers about the project's strictness.
- **3 byte-identical copies of `ai-provider.ts`** (verified identical SHA-256):
  `_shared/ai-provider.ts`, `ask-toolscribe/_shared/ai-provider.ts`,
  `generate-ai-profile/_shared/ai-provider.ts`. Any model or prompt fix must be applied three
  times with nothing enforcing it. `deno.json` exists only under `ask-toolscribe/`;
  there is **no `deno.lock` anywhere**, so `jsr:@supabase/functions-js/edge-runtime.d.ts`
  (`index.ts:1`, unpinned) resolves to a moving target → edge builds are not reproducible.
- **Edge function JSON is trusted without validation.**
  `ask-toolscribe/index.ts:155-159` — `parsed.recommendations ?? (Array.isArray(parsed) ? parsed : [])`
  accepts a non-array `recommendations` (crashes `AskToolScribeModal.tsx:35, 115` on
  `.length`/`.map`), performs no UUID check on `toolId` (so `hashId(garbage)` → `/tool/NaN`),
  no cap on the count, and the `catch` at `:158-159` returns the raw model text to the client.
  Also `:115` `t.description.slice(0, 120)` throws if any `description` is `null`, and there's
  no try/catch around `dbRes.json()`.
- **No CI, no coverage config or thresholds.** `package.json:12` has no `--coverage`, no
  `@vitest/coverage-v8`.

---

## LOW findings

- **A second, incompatible `hashId` exists — and it's the one that has tests.**
  `src/lib/utils.ts:8-11` exports `hashId()` → `` `ts_${n}_${Date.now()}` `` (zero-arg, string).
  `src/test/utils.test.ts:18-31` tests *that* version. All 20+ production call sites correctly
  import the numeric one from `@/lib/hashId` (verified by grep), so **the URL-critical numeric hash
  has zero tests**, and a future `@/lib/utils` import would produce `/tool/ts_1_17…`.
- **`hashId` collisions route users to the wrong tool.**
  `src/lib/hashId.ts:2-6` — `Math.imul(31, h) + charCodeAt | 0` then `Math.abs`. ~2³² output space;
  collisions become likely around 10⁵ tools. `Math.abs(-2147483648)` returns `-2147483648`.
  This hash *is* the public `/tool/:id` URL, so a collision silently routes users to the wrong tool.
- **Optimistic `addTool` temp id can collide with `hashId` space.**
  `useTools.ts:165, 198` — uses `Date.now()` as the temp id; `getUuid` (`:152-154`) resolves by
  first match in list order. No rollback if the component unmounts mid-flight.
- **`getSession()` rejection leaves `loading` permanently `true`.**
  `useAuth.ts:36-40` — the `.catch` logs but never calls `setLoading(false)`; the app hangs on a
  spinner if the auth call fails.
- **Role check races the session.** `useAuth.ts:20-28, 51-53` — `checkRoles` resolves against
  whatever the RPC sees at that moment; a role granted mid-session is never re-checked, and it can
  resolve out of order with `onAuthStateChange` at `:42-46`, leaving `isAdmin` true for a
  signed-out user for one render.
- **Notification poll wastes requests and lies on failure.**
  `useNotifications.ts:74-78` — a 30s `setInterval` armed for the whole session including
  signed-out and hidden tabs, regardless of `document.visibilityState` or auth state.
  `:64-68` — `markAsSeen` optimistically zeroes the badge even when the
  `mark_notifications_seen` RPC fails; the next 30s poll snaps it back with no explanation.
- **`useDustCollector` dismissal state is write-only dead code.**
  `useDustCollector.ts:40-41, 63` — `const dismissed = new Set<number>()` is created and immediately
  overwritten by `setDismissedIds(dismissed)`; nothing ever populates it. The real state lives in the
  separate `dismissedUuids` local. Also `:79-83, 91` — optimistic dismiss/remove with no error check
  and no rollback; the catch only logs, so the item stays hidden locally until reload.
- **Uncontrolled optimistic update in `vault_items`.**
  `useTools.ts:209, 242, 251, 261, 271, 284` — six separate upsert call sites, each independently
  managing its own `onConflict` clause.
- **`AlternativeCard`/`alternatives.ts` shape mismatches.**
  `alternatives.ts:209` — `as Alternative & { sourceName: string }` widens an object literal with a
  field the interface doesn't declare, hiding the mismatch from the compiler.
  `alternatives.ts:81-85` — dead `uidMap` plus a byte-for-byte duplicated counting loop (`:63-66`
  and `:56`), both of which run, inflating every save count.
  `alternatives.ts:2` — `hashId` imported and never used.
  `alternatives.ts:45-59` — three sequential awaits with no pagination; `:50-53` pulls all
  `vault_items` rows for the alt tools and `:55-59` all their active reviews, purely to average
  ratings client-side.
- **Alternatives inserts are not idempotent or atomic.**
  `alternatives.ts:118-123` — the two bidirectional rows go in as one insert, but there's no
  `ON CONFLICT DO NOTHING`, so re-suggesting a pair errors; and a mid-flight failure leaves one
  direction persisted → asymmetric alternatives graph.
- **`tags.ts` return-value and query issues.**
  `tags.ts:153-159` — `suggestTag` returns `!error`, conflating "already exists" with
  "permission denied", and no error message is surfaced to `TagSuggestModal`.
  `tags.ts:24-28, 171-194` — `useTags` and `fetchPendingTags` both `select('*')` with no `.limit()`
  and no error destructuring. `tags.ts:146-150` (`fetchTaggedTools`) has no error handling.
- **`health.ts` error handling.** `:138-156, 198-207` — both discard `{ error }`.
- **`visual.ts` banner seed derives from `row.bio`** (`visuals.ts:16`, called from
  `useProfile.ts:22`) → editing a bio silently changes a user's banner image.
- **Image crop dialog is mouse-only and can throw.**
  `ImageCropDialog.tsx:99-102` has only mouse handlers (no `onTouchStart` → unusable on mobile);
  `:73` `imageRef.current!` non-null assertion throws if the image hasn't loaded;
  `:82` `console.log` in the render body; `:25` `scale`/`setScale` dead state.
- **`App.tsx:64` — skip link doesn't move focus.** `role="main"` sits on a non-focusable div, so
  `#main-content` (`App.tsx:56-61`) doesn't move focus.
- **`scrollbar-none` is not defined in `index.css`** — used at `DiscoverPage.tsx:262, 307, 347, 386`
  and `CollectionsHubPage.tsx:146` → no-op.
- **Object URL leak.** `AvatarUpload.tsx:24` revokes only in `handleCrop` (`:38`), not in the
  cancel path (`:93`).
- **`NotificationPanel` has no `aria-live`; the bell has no `aria-expanded`.**
- **`SettingsPage.tsx:41-65`** notification prefs are `localStorage`-only while `:245` claims
  "Notification emails are sent to {email}" — the setting doesn't work cross-device and the copy
  is misleading.
- **`SettingsPage.tsx:158-337`** builds every section's JSX on every render (only one is shown).
- **`ToolDetailPage.tsx:139`** builds `new Date()` inside a `useMemo` for collection activities →
  unstable timestamps, re-sorting churn. `:84-89` records a visit (`onRecordVisit`) on every
  mount/tool change with deps `[tool?.id]` while reading `tool.notes`.
- **`SuggestAlternativeModal.tsx:137`** — "No tools found" renders immediately while the 200 ms
  debounce is still pending → false empty state.
- **`AdminAlternativeModeration.tsx:86`** — no error state for a failed action.
- **Auth guard flashes.** `MyCollectionsPage.tsx:56`, `MyProfilePage.tsx:228`, `MyReviewsPage.tsx:134`,
  `SettingsPage.tsx:146` — `if (!user)` guards with no `authLoading` branch → brief "Sign in…" flash
  for signed-in users.
- **Admin effect deps.** `AdminReviewModeration.tsx:84` — `useEffect(..., [user])` omits
  `isAdmin`/`loadReviews`. `AdminTagModeration.tsx:15-18` and
  `AdminAlternativeModeration.tsx:34-37` fire fetches keyed on role flags.
- **`MyCollectionsPage.tsx:187-192`** — clickable `<h3>` for navigation, not a link/button.
- **Missing auth checks on tool updates.**
  `useTools.ts:307-312` / `:314-324` have **no auth check** (client-side guard is `canUpload`/
  `isAdmin` in `ToolDetailPage.tsx:287, 311`) — relies entirely on RLS for the `tools` UPDATE.

### Build config (low)

- `vite.config.ts:31` — destructures `{ getModuleInfo }` from `manualChunks`' second argument but
  never uses it. Dead parameter that reads as intentional.
- `vite.config.ts:72-77` — `chunkFileNames` has an `if/else` whose two branches are the identical
  string `"[name]-[hash].js"`; the `prefix` variable is pointless.
- `vite.config.ts:67-69` — the catch-all `if (id.includes("node_modules/")) return "vendor"`
  collapses `embla-carousel`, `cmdk`, `vaul`, `sonner`, `react-day-picker`, `input-otp`,
  `react-hook-form` into one eagerly-parsed block.
- `vite.config.ts:53-55` — the `recharts` rule never fires; `src/components/ui/chart.tsx` is
  imported by nothing, so recharts is tree-shaken entirely and the rule is dead config.
- `vite.config.ts:20` — `build.target: "esnext"` with no `.browserslistrc` (confirmed absent) and
  no `legacy` targets → ships untranspiled syntax with no declared browser floor.
- `tailwind.config.ts:109` — uses `require("tailwindcss-animate")` in a `"type": "module"` ESM
  TypeScript file; it only resolves because Tailwind v3 loads `.ts` configs through jiti. Any other
  consumer (vitest, `tsx`, native ESM) throws `require is not defined`.
- `tailwind.config.ts:5` — lists `./pages`, `./components`, `./app` globs that don't exist;
  coverage depends entirely on the `./src/**` entry.
- `vitest.config.ts:9` — `globals: true` while all four test files explicitly
  `import { describe, it, expect } from 'vitest'`. Redundant. And `tsconfig.app.json:27-29` pulls
  `"types": ["vitest/globals"]` into the **app** type env, polluting non-test code with test globals.
- **Test environment is stale and slow.** `jsdom 20.0.3` (2022) against
  `@testing-library/react` 16 and vitest 4. Measured run: **~25s wall for 17 trivial assertions**
  (setup alone 15.7s cumulative).
- **`src/test/health.test.ts` is a tautology** — it asserts on a locally-declared array literal
  (`:5-14`) and **never imports `src/lib/health.ts`**, so the health module has **0% real coverage**.
- **`src/test/example.test.ts:4-6`** asserts `true === true`.
- **`docs/legacy-sql-archive/supabase-schema.sql:3`** instructs the reader to "Run this entire file
  in: Supabase Dashboard > SQL Editor" — an executable-looking bootstrap for a schema the archive's
  own README calls badly out of date. Should carry a `RAISE EXCEPTION` guard or a non-`.sql`
  extension so it can't be pasted by accident.
- **`supabase/README.md:37`** references `supabase/schema.sql`, which does not exist — the
  generated files are `schema_structure.sql` and `functions.sql`.

### Schema-level defects (present in the live snapshot too)

- **`reviews.tool_id`, `tool_health.tool_id`, `health_check_log.tool_id`, `tool_tags.tool_id` all
  lack `REFERENCES tools(id)`** (unlike `vault_items.tool_id`, which has it) → orphan rows on tool
  deletion.
- **`reputation_scores` has `WITH CHECK (true)`** → any caller can insert arbitrary rows.
- **`health_check_log` is publicly readable**, leaking internal error messages and check timings.
- **A policy exists on `curator_follows`**, a table the archive schema never creates and which
  `supabase/README.md:57` lists as unused.
- **`profiles.username` is `UNIQUE` on the column *and* has a redundant partial unique index.**

### Schema cross-check: `docs/legacy-sql-archive/supabase-schema.sql` vs TS row types

The archive is stale in ways that matter, and `src/lib/supabase.ts` types are the ones that
aren't tracking reality:

| Conflict | Archive | Type declaration |
|---|---|---|
| `reviews.rating` | absent | `ReviewRow.rating: number`, **required** — `supabase.ts:141` |
| `collections.cover_image_url`, `featured`, `clone_count`, `view_count` | absent | all four **required, non-optional** — `supabase.ts:78-81` |
| `profiles` — 15 of 21 columns (`tagline`, `location`, `website`, `github`, `twitter`, `linkedin`, `avatar_url`, `banner_url`, `featured_collection_id`, `curator_badge`, `show_*`, `signature_quote`, `contact_url`) | absent | all typed required `string`/`boolean` — `supabase.ts:104-122` |
| `tool_submissions.ai_summary` / `ai_profile_generated_at` / `ai_profile_version` | absent | written by `src/lib/generate-ai-profile.ts:57-64` |

The live DB **does** have these (`schema_structure.sql:194`, `functions.sql:126`), so the TS types
are correct *today* — but nothing in the repo detects drift, and `AGENTS.md:44` still lists the
`profiles` columns as "pending schema", i.e. the types claim they exist.
Note also that `AGENTS.md:63` claims the source of truth is `supabase/schema.sql`, which doesn't exist.

### Cross-cutting observations

- **`vault_items` is the most-abused table.** Scanned in full by `useTools.ts:86-89`,
  `alternatives.ts:50-53`, `DiscoverPage.tsx:114-117`, and `SettingsPage.tsx:97`; mutated by six
  separate upsert call sites each independently managing `onConflict`.
- **No react-query anywhere except `useModerationCounts`.** Every other data hook hand-rolls
  `useState` + `useEffect` + `useCallback`. That's why cache-key hygiene is inconsistent, why
  `refetch` has to be threaded manually into pages (`DiscoverPage.tsx:56-63` re-runs
  `buildVaultRecs` manually), and why there's no cross-hook dedup — `useTools()` is instantiated
  independently in `ToolDetailWrapper.tsx:35`, `Index.tsx:36`, `CollectionDetailWrapper.tsx:22`,
  and even in admin wrappers (`AdminHealthWrapper.tsx:19`, `AdminReviewModerationWrapper.tsx:19`)
  purely to reach `addTool`, triggering a 100-row tools fetch + two full-table scans on pages
  that display no tools at all.
- **`Promise.all` destructuring hides errors:** `useProfile.ts:69-73, 144-147` destructure
  `{ count }` from three head-count queries without checking `error`; `useModerationCounts.ts:17-22`
  likewise. All five degrade to `0` rather than surfacing a failure.
- **`src/components/ui/dialog.tsx`** is the only customized shadcn file (additive
  `overlayClassName` at `:32-35`, non-breaking) — but it changes overlay stacking (`z-50` default)
  relative to the hand-rolled modals using `z-100`–`z-200`. Worth unifying.

---

## Recommended new features

Ranked by impact-to-effort. The first four pay for themselves.

### High impact

**1. Full-text search with ranking (Postgres `tsvector` + GIN index + an RPC)**
The current engine is bidirectional substring matching with no ordering — `figm` misses Figma, and
`.limit(12)` returns 12 arbitrary rows. One generated column + `to_tsquery` ranking RPC replaces
`simple-engine.ts` entirely, fixes the filter-injection issue (#11) by moving filtering
server-side, enables the three declared-but-ignored filters, and makes tag/category search
actually work. **Biggest single quality win in the app.**

**2. Real-time collaboration signals (Supabase Realtime)**
Realtime is the right tool and currently unused. Add live review/collection follower counts,
"someone is editing this collection" presence, and instant comment threads. Turns a static catalog
into something that feels alive with almost no new UI work.

**3. Comparison view (`/compare?a=1&b=2&c=3`)**
The obvious product gap. The data is already there — `price_model`, `is_open_source`, `platforms`,
`is_free`, `requires_login`, ratings — plus `alternatives.ts` already models tool-vs-tool
relationships. A side-by-side table with checkmarks is ~300 lines, highly linkable, and exactly
what people arrive on an aggregator to do. Strong internal-linking surface for SEO.

**4. Keyboard-first command palette (`⌘K`)**
`cmdk` and `SearchEverywhere.tsx` already exist but the advertised arrow-key navigation isn't
implemented. Make it real and add actions: navigate, save to vault, create collection, switch
theme, admin moderation jump-to. Power-user feature on an app with 20+ routes and no sidebar nav.

**5. Review threads / comments on tools**
Reviews are currently flat and single-round. Threaded replies turn passive reading into a
community — the retention lever for a curator platform.

### Medium impact

**6. Browser extension + "Submit from any page"**
The submission flow exists but has no acquisition surface. A lightweight extension that reads the
current tab and pre-fills tool metadata turns browsing into contributing.

**7. RSS/Atom feed + dynamic OG images**
`sitemap.xml` covers 4 URLs and has no `<lastmod>`. Per-tool/per-profile OG images (via
`@vercel/og`) make every share link look intentional — the highest-leverage social-growth item for
a link-heavy product.

**8. Personalized "For You" feed (proper ranking)**
`recommendations.ts` exists but silently returns nothing on error and cold-starts to trending.
Build it on the search index: tag affinity from vault + reviews + follows, with editorial boost.
Turns three disconnected recommendation surfaces into one coherent product loop.

**9. Tool changelog / update tracking**
`ai_profile_version` and `ai_profile_generated_at` (`supabase.ts:43-45`) already model "this tool
was re-analyzed on date X." Surface that as a "Recently updated" badge and a per-tool update log.
Cheap differentiation — competitors don't do it.

**10. Collections-as-templates with attribution**
`clone_count` exists and `clone_public_collection` is currently broken (#HIGH + #CRITICAL-8).
Fix it, then add proper attribution: "based on a collection by @curator", a clone tree, and clone
lineage. That's the collaborative loop a curation product needs.

### Lower effort, still valuable

**11. First-party analytics.** Privacy-first event logging into your own Postgres (no
third-party scripts). You already have `docs/analytics-plan.md`.

**12. Offline / PWA.** `public/manifest.json` exists but there's no service worker. A proper
`vite-plugin-pwa` setup with cached tool detail pages and an offline vault view.

**13. Data export (user-owned JSON).** GDPR-aligned and a genuine trust signal on a platform that
stores profiles, banners, and social links. Every curation platform should have this.

**14. Moderation dashboard improvements.** The flagged-review tab is broken (HIGH) and moderation
columns are never populated. Add a real queue with SLA timers, bulk actions, and a moderator
audit log.

**15. Automated test coverage + CI.** Currently 17 near-tautological assertions, no e2e, no CI.
Not a feature, but it's the gate that stops the next six critical findings from recurring.

---

## Suggested fix order

1. **CRITICAL 1–4** — the edge functions are fully broken (wrong import path, no JWT, no auth check).
2. **CRITICAL 5–10** — privilege escalation: moderation status, upvotes, reputation, email enumeration.
3. **Add `tsc -b` to the build script + CI.** This immediately surfaces the 152 errors, including
   ~10 real bugs, and is the cheapest fix on this list.
4. **CRITICAL 16–21** — build/deploy integrity: untrack `.temp`, fix `.gitignore`, real CSP,
   security headers, `drop_console`.
5. **CRITICAL 22–24 + the HIGH UX bugs** — flash-of-error on detail pages, broken "flagged" tab,
   off-page mutations, optimistic rollback no-ops, double submit.
6. **HIGH a11y sweep** — Escape handling, `useAuth` → provider, accessible names, nested buttons.
7. **Design-token consolidation** — kill hardcoded hex, register `@tailwindcss/typography`,
   remove duplicate implementations.
8. **Search rework** — tsvector + RPC (also closes the filter-injection hole).
9. **Test coverage + e2e** so the next review is smaller than this one.

---

*Review date: this session. No files were modified during the audit.*
*To update this document, append new findings under the relevant severity heading and note the date.*