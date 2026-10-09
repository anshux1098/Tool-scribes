# Following System Report

## Current Behavior

There are **two separate follow mechanisms** in the app, but only one feeds into the Following page:

| Mechanism | Table | Writes | Reads | In Following Feed? |
|-----------|-------|--------|-------|-------------------|
| Follow curator | `follows` | ProfilePage (Follow button) | useFollowingFeed, useProfile | ✅ Tools & collections by followed curators |
| Follow collection | `collection_followers` | PublicCollectionPage (inline) | PublicCollectionPage (follower count) | ❌ **Never queried by feed** |

## Intended Behavior

1. **Follow Collection** (button on `/c/:uuid`): Inserts into `collection_followers` — the collection should appear in the Following page
2. **Follow Curator** (button on `/u/:username`): Inserts into `follows` — curator's activity should appear in the Following page
3. **Following page** should show three sections:
   - Followed Collections
   - Followed Curators
   - Recent Activity (tools & collections from followed curators)

## Root Causes

### Bug 1: Followed collections never appear in Following page

**File:** `src/hooks/useFollowingFeed.ts` (pre-fix)

**Root cause:** The `useFollowingFeed` hook only queried the `follows` table to get followed curator IDs. It never queried `collection_followers` to get followed collection IDs. Collections that users followed were silently stored in the database but never surfaced in the UI.

```typescript
// Before: only queried follows table
const { data: followRows } = await supabase
  .from('follows')
  .select('following_id')
  .eq('follower_id', user.id);
// collection_followers was never queried
```

### Bug 2: Duplicate follower tracking via `curator_follows`

**Files:** `supabase-schema.sql:473`, `src/hooks/useProfile.ts:62` (pre-fix)

**Root cause:** The `calculate_reputation` RPC and `useProfile` hook queried `curator_follows` for follower counts, but the actual follow/unfollow actions write to `follows`. Since `curator_follows` is never written to by any UI action, the reputation score always showed 0 followers.

```sql
-- Before (calculate_reputation)
select count(*)::int into follower_count from curator_follows where curator_id = target_user_id;
-- This table is never written to! Always returns 0.
```

This is a documented schema drift issue (see audit-report.md).

### Bug 3: `followCollection` function is dead code

**File:** `src/hooks/useCollections.ts:220-227`

**Root cause:** The `followCollection` function was defined and exported from `useCollections` but was never imported or called by any component. The PublicCollectionPage uses **inline** Supabase calls instead.

## Fix Applied

### Fix 1: Followed collections in feed

**Files changed:**
- `src/hooks/useFollowingFeed.ts` — Full rewrite

**Changes:**
- Added query of `collection_followers` table to fetch followed collection IDs
- Added batch fetch of collection details, tool counts, and curator profile info
- Added `FollowedCollection` and `FollowedCurator` interfaces
- Hook now returns `followedCollections` and `followedCurators` alongside the existing `feed`

### Fix 2: Three-section Following page

**Files changed:**
- `src/pages/FollowingPage.tsx` — Full rewrite

**Changes:**
- **Following Collections** section: Grid of collection cards with name, curator link, tool count, and follow date. Click navigates to `/c/{uuid}`.
- **Following Curators** section: List of curator profiles with avatar (initial), display name, @username, bio, reputation score, and follower count. Click navigates to `/u/{username}`.
- **Recent Activity** section: Chronological feed of tools added and collections published by followed curators. Each item links to curator profile and tool/collection detail.

### Fix 3: `curator_follows` → `follows` migration

**Files changed:**
- `supabase-schema.sql:473` — Updated `calculate_reputation` to query `follows`
- `src/hooks/useProfile.ts:62` — Removed `curator_follows` query, use `follows` count instead
- Migration `fix_calculate_reputation_use_follows` applied to production DB

**Changes:**
- `calculate_reputation` now uses `follows` table
- `useProfile` no longer queries the orphaned `curator_follows` table
- Follower counts now correctly reflect actual follows

## Verification Steps

### 1. Follow a collection → appears in Following

1. Navigate to a public collection at `/c/{uuid}`
2. Click "Follow" button
3. Navigate to `/following`
4. **Verify:** Collection card appears under "Following Collections" section with correct name, curator, and tool count

### 2. Follow a curator → appears in Following

1. Navigate to a curator profile at `/u/{username}`
2. Click "Follow" button
3. Navigate to `/following`
4. **Verify:** Curator appears under "Following Curators" section with avatar, display name, reputation, and follower count

### 3. Curator activity appears in feed

1. Follow a curator who has recently added tools or published collections
2. Navigate to `/following`
3. **Verify:** Recent tools/collections appear under "Recent Activity" section

### 4. Reputation includes followers

1. Navigate to any profile at `/u/{username}`
2. **Verify:** The follower count shown reflects actual follows (not 0)

### 5. TypeScript compilation

```bash
npx tsc --noEmit
# Expected: zero errors
```

## Data Flow Diagram

```
Follow Curator (ProfilePage)
  → INSERT INTO follows (follower_id, following_id)
    → useFollowingFeed queries follows
      → Shows in "Following Curators" section
      → Shows curator's tools/collections in "Recent Activity"
    → useProfile counts follows
      → Shows follower count on profile

Follow Collection (PublicCollectionPage)
  → INSERT INTO collection_followers (user_id, collection_id)
    → useFollowingFeed queries collection_followers
      → Shows in "Following Collections" section

calculate_reputation
  → SELECT count FROM follows WHERE following_id = target_user_id
    → Reputation score includes actual follower count
```
