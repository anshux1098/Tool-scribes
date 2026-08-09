# Profile Navigation Fix

## Root Cause

When clicking "My Profile" in the Navbar dropdown, the app navigated to `/profile` → `ProfileRedirect`. `ProfileRedirect` mounted a **new** `useAuth()` instance with fresh state (`loading: true`, `user: null`). The auth effect called `getSession()` and then queried `profiles` for the username. This query **silently failed** (RLS race condition / session timing), triggering the `.catch()` handler which navigated back to `/` with `{ replace: true }` — the user saw the vault page reload.

**Flow (broken):**

```
Avatar Menu → Click "My Profile"
  → navigate('/profile')
  → ProfileRedirect mounts
  → useAuth() creates NEW state: { loading: true, user: null }
  → Effect: loading=true → return (no-op)
  → getSession() resolves → setUser(), setLoading(false)
  → Effect re-runs: loading=false, user set
  → supabase.from('profiles').select('username').eq('user_id', user.id)
  → Promise fails (RLS/timing) → .catch() fires
  → navigate('/', { replace: true })
  → User sees vault page → "nothing happened"
```

## The Real Issue

The Navbar **already fetches `myUsername`** from the profiles table on mount:

```tsx
// Navbar.tsx:29-33
useEffect(() => {
    if (!user) { setMyUsername(null); return; }
    supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setMyUsername(data?.username as string ?? null));
}, [user]);
```

But the "My Profile" menu item used a static `href: '/profile'`, ignoring the already-available username. This forced every profile navigation through the fragile `ProfileRedirect` → `useAuth()` → re-query pipeline.

## Fix

**File:** `src/components/Navbar.tsx:52-54`

Compute the "My Profile" href dynamically from the already-fetched `myUsername`:

```diff
+ const myProfileHref = myUsername ? `/u/${myUsername}` : '/profile';
  const menuItems = [
-   { label: 'My Profile', icon: User, href: '/profile' },
+   { label: 'My Profile', icon: User, href: myProfileHref },
    ...
  ];
```

**Before:** Always navigated to `/profile` → `ProfileRedirect` → broken auth/query → redirect to `/`.

**After:** Navigates directly to `/u/{myUsername}` → `ProfilePage` renders immediately. Falls back to `/profile` (`ProfileRedirect`) only if `myUsername` hasn't loaded yet.

## Files Changed

| File | Change |
|------|--------|
| `src/components/Navbar.tsx` | Line 52-54: compute `myProfileHref` from `myUsername`, use it in menu items |

## Verification

Test from every page where the Navbar is rendered (route `/` with Vault or Discover tab):

| Starting Page | Action | Expected Result |
|---|---|---|
| Vault (`/`) | Avatar → My Profile | Profile page opens at `/u/{username}` |
| Discover (`/`) | Avatar → My Profile | Profile page opens at `/u/{username}` |

The Navbar is only rendered on the Index page (`/`). Other pages (ToolDetail, Following, etc.) render without the Navbar and its dropdown menu.

### Build Verification

```
> npm run build
✓ built in 2.28s
```
No TypeScript or build errors.
