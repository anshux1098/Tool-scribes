# ToolScribe — Launch Readiness Report

**Date:** 2026-06-11
**Method:** Static code analysis of all 133 source files, database schema, config, and infrastructure

---

## Scores

| Category | Score (1-10) | Summary |
|----------|:-----------:|---------|
| **Security** | **5** | 3 critical vulnerabilities fixed this session (unbounded `increment_upvote`, weak RLS insert policies, missing FK constraints). Still: CORS proxy leaks URLs, no role management UI, client-side-only admin checks are the norm. |
| **Reliability** | **4** | No ErrorBoundary (fixed — wrapped routes). No transactions for multi-step ops (approve submission can orphan tools). 20+ silent catch blocks. 0% test coverage. Missing FK references (fixed — migration applied). Supabase client uses `undefined as unknown` cast. |
| **Performance** | **5** | Lazy loading added this session for 5 admin routes. Main bundle dropped 845KB → 318KB. Still: no pagination on tools query (unbounded). `.select('*')` in 15+ queries. 30+ images missing `loading="lazy"`. No service worker or caching. |
| **UX** | **5** | Well-designed editorial UI with coherent visual language. Good empty states, loading skeletons, error pages. Weaknesses: no toast usage (toaster imported but unused), no confirmation on destructive actions, no breadcrumbs, silent form validation failures, no error feedback beyond inline state. |
| **Mobile** | **3** | Touch targets all < 44px (20+ elements). No hamburger/drawer navigation — all 7+ nav items inline. Admin tables use fixed-column grids that overflow horizontally. Body text at 13px (below 16px recommendation). |
| **Accessibility** | **2** | All 8+ modals lacked `role="dialog"` / `aria-modal` (fixed AuthModal). 9+ icon-only buttons had no `aria-label` (fixed Navbar). 10+ inputs had no labels (fixed AuthModal + SearchEverywhere). Low contrast on secondary/muted text (fails WCAG AA). No skip-to-content. No focus trap on any modal. Keyboard navigation broken in 7+ components (divs with onClick, no key handlers). No `role="alert"` on errors (fixed AuthModal). |
| **Maintainability** | **3** | `hashId()` duplicated in 10 files (added to utils.ts). 300-400 line page components. Heavy `any`/`Record<string, unknown>` usage. 0% test coverage. `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`. Dead components never imported (SearchBar, EmptyState, VaultCard, DiscoverCard). No pre-commit hooks. |

**Overall: 3.9 / 10**

---

## Top 10 Issues Preventing Production Launch

| Rank | Severity | Issue | Category | Status |
|:----:|:--------:|-------|:--------:|:------:|
| 1 | **CRITICAL** | **No Error Boundary** — any React render crash white-screens the entire app | Reliability/UX | **FIXED** — ErrorBoundary added and wrapped around all routes |
| 2 | **CRITICAL** | **`increment_upvote` is SECURITY DEFINER with unbounded delta** — any authenticated user can arbitrarily inflate any tool's upvote count by calling the RPC directly with `delta: 10000`. No verification that the user holds an actual upvote | Security | **FIXED** — migration validates `delta in (-1, 1)` and checks `upvotes` table |
| 3 | **CRITICAL** | **`tools: auth insert` RLS doesn't enforce `added_by = auth.uid()`** — any authenticated user can insert a tool claiming to be added by any other user. Same issue on `tool_submissions: auth insert` | Security | **FIXED** — migration updates both policies |
| 4 | **CRITICAL** | **No pagination on tools query** — `fetchAll` in `useTools.ts:67` selects ALL tools with no `.limit()`. As dataset grows beyond a few hundred tools, the app will load unbounded data into memory, causing OOM crashes on mobile | Performance | **OPEN** — needs `.limit(100)` + cursor-based pagination |
| 5 | **HIGH** | **All modals inaccessible** — 8+ modals (Auth, AddTool, SubmitTool, Settings, Onboarding, TagSuggest, AddToCollection, CreateCollection) lack `role="dialog"`, `aria-modal`, focus trapping, focus restoration, and `aria-labelledby`. Screen reader users cannot operate them | Accessibility | **PARTIAL** — AuthModal fixed. 7 remaining need the same treatment |
| 6 | **HIGH** | **No transactions for `approveSubmission`** — the 3-step flow (insert tool, update submission, send notification) has no DB transaction. If step 2 fails after step 1 succeeds, an orphaned tool remains with no link to the submission | Reliability | **OPEN** — needs Supabase Edge Function with proper transaction |
| 7 | **HIGH** | **Missing FK references on 4 tables** — `reviews.tool_id`, `tool_health.tool_id`, `health_check_log.tool_id`, `tool_tags.tool_id` have no `REFERENCES tools(id)`. Deleting a tool orphans all associated records | Reliability | **FIXED** — migration adds all 4 FK constraints |
| 8 | **HIGH** | **Touch targets < 44px throughout** — 20+ icon buttons (close, clear, profile, signout, favorite toggle, external link) use `p-1` or `p-1.5` resulting in ~22-26px touch targets. WCAG 2.5.5 failure. Impossible to use reliably on mobile | Mobile/Accessibility | **PARTIAL** — Navbar profile/signout fixed to `p-2.5`. 18+ locations remain |
| 9 | **HIGH** | **No role management UI + no audit trail** — admin and moderator roles can only be assigned via raw SQL. There is no interface to view, assign, or revoke roles. Once bootstrapped, there's zero auditability of who has admin access | Security | **OPEN** — needs admin role management page |
| 10 | **MEDIUM** | **Silent error swallowing in 20+ locations** — empty `catch { /* ignore */ }` and `catch { return false; }` patterns throughout `useReviews`, `useProfile`, `useFollowingFeed`, `useDustCollector`, and lib functions. Production bugs will be invisible to both users and developers | Reliability/Maintainability | **OPEN** — needs systematic `console.error` in all catch blocks |

---

## Issues Fixed This Session

### Security (3 critical, 2 high)
- `increment_upvote` RPC: delta validation + upvote ownership check via migration
- `tools: auth insert` RLS: now enforces `added_by = auth.uid()`
- `tool_submissions: auth insert` RLS: now enforces `submitted_by = auth.uid()`
- `get_creator_email` / `get_submitter_email`: added authorization checks
- `calculate_reputation`: fixed broken reference to non-existent `curator_follows` table → now uses `follows`

### Reliability (1 critical)
- ErrorBoundary component created and wrapped around all routes in `App.tsx`
- FK constraints added on `reviews`, `tool_health`, `health_check_log`, `tool_tags`

### Performance (1 critical)
- Lazy loading added for 5 admin routes (`React.lazy` + `Suspense`)
- Main bundle reduced 845KB → 318KB (62% reduction)

### Accessibility (3 high)
- Navbar: `aria-label` on profile/signout buttons; touch target increased `p-1.5` → `p-2.5`
- AuthModal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-label` on email/password inputs, `role="alert"` on errors, `aria-label="Close dialog"` on close button
- SearchEverywhere: `aria-label` on search input and clear button

### Maintainability
- `hashId()` moved to `src/lib/utils.ts` (was duplicated in 10 files)

---

## Blocking Issues by Severity

| Blocking? | Count | Details |
|:---------:|:-----:|---------|
| **YES** | 2 | No pagination on tools query (will break at scale), all 7+ remaining modals inaccessible |
| **YES (conditional)** | 3 | No role management (first admin requires raw SQL), no sound for transaction (approve can orphan), remaining touch targets |
| **SHOULD FIX** | 5 | Silent error swallowing, no test coverage, low contrast colors, no skip-to-content, keyboard navigation gaps |

## Minimum Viable Fixes Before Launch

1. ~~Add ErrorBoundary~~ ✅
2. ~~Add lazy loading for admin routes~~ ✅
3. ~~Fix increment_upvote delta validation~~ ✅
4. ~~Fix tools insert RLS policy~~ ✅
5. **Add pagination to useTools fetch** (`.limit(100)` + offset/cursor)
6. **Fix remaining 7 modals** with dialog accessibility attributes
7. **Add toast notifications** for destructive actions (delete review, reject submission, etc.)
8. **Fix remaining touch targets** to minimum 44×44px
9. **Add console.error to all empty catch blocks** for debug visibility
10. **Set up CI/CD pipeline** (GitHub Actions build + lint)
