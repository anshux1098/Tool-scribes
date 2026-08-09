# Critical Bugs Report

## Bug 1: Vault/Discover nav tabs broken from non-main pages

**File**: `src/components/Navbar.tsx:34`

**Root cause**: `handleTabChange` only navigated to `/` for tool detail pages (`isDetailPage`) and admin pages (`isAdminPage`). Tag pages (`/tag/:slug`), profile pages (`/u/:username`), collection pages, following page, and any other non-main route were not handled — clicking Vault/Discover from those pages appeared to do nothing.

**Fix (two-part)**:
1. Replaced page-specific checks with a reusable `isMainPage = location.pathname === '/'` check. `handleTabChange` now calls `if (!isMainPage) navigate('/')` — works for ALL non-main pages without listing them individually.
2. Tab active state check changed from `!isDetailPage && !isAdminPage` to `isMainPage`.

**Removed**: `isDetailPage` variable (no longer needed).

## Bug 2: Tool submissions not appearing in admin review queue

**File**: `supabase-schema.sql:585`

**Root cause**: `get_submissions_for_review()` was declared with `returns setof record`. In Postgres, `record` is an anonymous type — callers must provide an explicit column definition list (e.g., `select * from fn() AS (col1 type1, ...)`). PostgREST (Supabase's API layer) sends `select * from get_submissions_for_review()` without a column list, causing Postgres to reject the query. The RPC silently fails, `supabase.rpc('get_submissions_for_review')` returns an error, and `fetchSubmissions()` returns empty — so admin sees "No pending submissions" regardless of actual data.

**Fix**: Changed `returns setof record` to `returns table(...)` with all 18 output columns explicitly typed.

## Bug 3: get_submissions_for_review column type mismatch

**File**: `supabase-schema.sql:605`

**Root cause**: After changing to `returns table(...)`, Postgres strictly enforces column type matching. `auth.users.email` is `varchar(255)` but `returns table(... submitter_email text)` expects `text`. Postgres rejected the `RETURN QUERY` with `ERROR: 42804: Returned type character varying(255) does not match expected type text in column 18`.

**Fix**: Cast `u.email::text` in the return query.

## Verification

Current routes verified:
| Route | Tab highlights? | Tab navigates? |
|-------|----------------|----------------|
| `/` (Index) | Yes | N/A (already there) |
| `/tool/:id` | No | Yes → `/` |
| `/tag/:slug` | No | Yes → `/` |
| `/admin/*` | No | Yes → `/` |
| `/u/:username` | No | Yes → `/` |
| `/following` | No | Yes → `/` |
| `/collections/:id` | No | Yes → `/` |
| `/c/:uuid` | No | Yes → `/` |
| `/tags` | No | Yes → `/` |

All routes use a single reusable check: `isMainPage = location.pathname === '/'`.

## Related files
- `src/components/Navbar.tsx` — Bug 1 fix (`isMainPage` reusable detection)
- `supabase-schema.sql` — Bug 2/3 fix
- `src/pages/AdminReviewWrapper.tsx` — calls `fetchSubmissions()`
- `src/components/AdminReviewPage.tsx` — renders the queue
- `src/lib/submission.ts` — `submitTool()`, `fetchSubmissions()`, `approveSubmission()`, `rejectSubmission()`
