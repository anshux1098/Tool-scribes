# Collection Bug Report

## Symptoms

1. Collection appears in Discover page
2. Collection card shows incorrect tool count
3. Clicking collection opens "Collection not found"

---

## Root Cause Analysis

### Bug 1: "Collection not found" — Route mismatch

**File:** `src/pages/DiscoverPage.tsx` (line 235)

**Root cause:** Discover page navigated to `/collections/${col.id}` using the hashId number. The route `/collections/:id` renders `CollectionPage`, which only looks up collections from `useCollections` state — and that state **only contains the current user's own collections**. For any public collection owned by another user, `collections.find(c => c.id === Number(id))` returns `undefined`, triggering the "Collection not found" fallback.

**Route diagram:**

```
DiscoverPage
  → navigate(`/collections/${hashId}`)     ← BROKEN for other users' collections
    → /collections/:id
      → CollectionDetailWrapper
        → CollectionPage
          → collections.find(c => c.id === Number(id))  ← only searches own collections
          → "Collection not found"                       ← fails for public collections
```

**Fix:** Navigate to `/c/${_uuid}` instead, which renders `PublicCollectionPage` — a route that fetches the collection directly from the database by UUID and works for **any** public collection, regardless of ownership.

```typescript
// Before (DiscoverPage.tsx)
onClick={() => navigate(`/collections/${col.id}`)}

// After
onClick={() => navigate(`/c/${col._uuid}`)}
```

### Bug 2: Tool count always 0 — Aggregate response type mismatch

**Files:** `src/pages/DiscoverPage.tsx` (line 56), `src/hooks/useCollections.ts` (line 52), `src/pages/ProfilePage.tsx` (line 79)

**Root cause:** Supabase's `select('*, collection_tools(count)')` resource embedding returns the aggregate as an **array** `[{ count: N }]`, but the code cast it as a single **object** `{ count: number }`. Accessing `.count` on an Array returns `undefined`, so `toolCount` always resolved to 0.

```typescript
// What Supabase returns:
r.collection_tools === [{ count: 3 }]  // Array with one element

// What the code assumed:
const ct = r.collection_tools as { count: number } | undefined;
ct?.count  // undefined! Arrays don't have a `.count` property
```

**Fix:** Check if the value is an array before accessing `.count`:

```typescript
const ctArr = r.collection_tools as Array<{ count: number }> | undefined;
const countVal = Array.isArray(ctArr) ? (ctArr[0]?.count ?? 0) : (ctArr as { count: number })?.count ?? 0;
```

### Bug 3: Missing `_uuid` on public collection objects

**File:** `src/pages/DiscoverPage.tsx` (line 58)

**Root cause:** The `Collection` type (`src/lib/types.ts`) did not expose a `_uuid` field, so the Discover page's collection mapper discarded the UUID. Without the UUID, the route fix for Bug 1 was impossible.

**Fix:** Added optional `_uuid` to the `Collection` type and stored it during mapping:

```typescript
// src/lib/types.ts
export interface Collection {
  id: number;
  _uuid?: string;   // ← added
  // ...
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types.ts` | Added optional `_uuid` to `Collection` interface |
| `src/pages/DiscoverPage.tsx` | Fixed navigation to `/c/${_uuid}`; fixed tool count extraction; stored `_uuid` |
| `src/hooks/useCollections.ts` | Fixed tool count extraction (array vs object) |
| `src/pages/ProfilePage.tsx` | Fixed tool count extraction; fixed navigation to `/c/${_uuid}` |

---

## Verification Steps

### 1. Tool count fix

1. Log in as User A
2. Create a public collection with 3 tools
3. Log out
4. Visit Discover page as anonymous user
5. **Verify:** The collection card shows "3 tools" (not "0 tools")

### 2. Collection navigation fix (not found)

1. Log in as User B (different from User A)
2. Visit Discover page
3. Click User A's public collection card
4. **Verify:** Collection page loads with all tools displayed (not "Collection not found")

### 3. Profile page navigation

1. Log in as User A
2. Visit `/u/userA`
3. Click a public collection card in the Collections section
4. **Verify:** Collection page loads correctly (not "Collection not found")

### 4. Owned collections still work

1. Log in as User A
2. Go to Vault tab
3. Click a collection card
4. **Verify:** Collection page loads with full edit functionality

### 5. TypeScript compilation

```bash
npx tsc --noEmit
# Expected: zero errors
```
