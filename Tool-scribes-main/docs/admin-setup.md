# ToolScribe — Admin Setup Guide

---

## 1. How are admin users stored?

**`user_roles` table** (`supabase-schema.sql:304-310`)

```sql
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','moderator')),
  unique (user_id, role)
);
```

Not stored in:
- ❌ `profiles` table (has `reputation_score` but no role column)
- ❌ Auth metadata (no `app_metadata` or `user_metadata` role claims)
- ❌ Custom JWT claims (no auth hook injects roles into tokens)

---

## 2. How is moderator stored?

**Same `user_roles` table** with `role = 'moderator'`.

The `unique(user_id, role)` constraint means a user can be both `admin` AND `moderator` (two rows), though in practice admins inherit moderator privileges via `is_moderator()`.

---

## 3. How does the application determine roles?

### Database level (security-definer functions)

**`is_admin()`** (`supabase-schema.sql:320-326`):
```sql
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
```

**`is_moderator()`** (`supabase-schema.sql:542-548`):
```sql
create or replace function is_moderator()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('admin', 'moderator')
  );
$$;
```

Both are `SECURITY DEFINER` — they bypass RLS and run as the database owner. They read from `user_roles` using `auth.uid()` which comes from the JWT token (cannot be spoofed).

### Client level (`src/hooks/useAuth.ts:20-28`)

```typescript
const checkRoles = async () => {
  const [adminRes, modRes] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_moderator'),
  ]);
  setIsAdmin(!!adminRes.data);
  setIsModerator(!!modRes.data);
};
```

The `useAuth()` hook calls both RPCs on mount and whenever the user changes. Exposes `isAdmin`, `isModerator`, `user`, `session`, and `loading`.

### Role determination flow
```
User signs in → onAuthStateChange fires → setUser() → 
useEffect triggers checkRoles() → 
  supabase.rpc('is_admin') → true/false
  supabase.rpc('is_moderator') → true/false
→ isAdmin/isModerator available everywhere via useAuth()
```

---

## 4. Admin routes

| Route | Page Component | Access | Lazy-loaded |
|-------|---------------|--------|:-----------:|
| `/admin` | `AdminIndex.tsx` | Admin + Moderator | ✅ |
| `/admin/review` | `AdminReviewWrapper.tsx` | Admin + Moderator | ✅ |
| `/admin/health` | `AdminHealthWrapper.tsx` | Admin only | ✅ |
| `/admin/reviews` | `AdminReviewModerationWrapper.tsx` | Admin only | ✅ |
| `/admin/tags` | `AdminTagModerationWrapper.tsx` | Admin only | ✅ |

All routes are registered in `src/App.tsx:46-54`.

**Navbar visibility** (`src/components/Navbar.tsx:96-146`):
- **Review** link — shown if `isAdmin || isModerator`
- **Health**, **Reviews**, **Tags** links — shown only if `isAdmin`

---

## 5. How to make my account an admin

### Step 1: Get your auth user UUID

Open the Supabase Dashboard → **Authentication** → **Users**. Find your email and copy the **UUID** (or use the SQL Editor):

```sql
select id, email from auth.users where email = 'your@email.com';
```

### Step 2: Insert admin role

In Supabase Dashboard → **SQL Editor**, run:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR_USER_UUID', 'admin');
```

### Step 3: Verify

Wait ~1 second, then refresh the app. The Navbar should show admin links (Review, Health, Reviews, Tags). Navigate to `/admin` to confirm.

### Step 4: (Optional) Verify via SQL

```sql
select * from public.user_roles where user_id = 'YOUR_USER_UUID';
```

Expected output:
```
id (uuid) | created_at (timestamptz) | user_id (uuid) | role (text)
----------+-------------------------+----------------+-----------
...       | 2026-06-11T...          | YOUR_UUID      | admin
```

---

## 6. Bootstrap admin flow

**No automatic bootstrap exists.**

The first admin must be created via **manual SQL**. There is:
- ❌ No "first user becomes admin" trigger
- ❌ No `handle_new_user()` trigger for roles (profiles are auto-created, but not roles)
- ❌ No invite flow
- ❌ No admin signup secret code

This is intentional — documented in `supabase-schema.sql:298-303`:

```sql
-- There is NO automatic bootstrap — the first admin must be created manually.
-- Once the first admin exists, they can assign additional admins/moderators.
```

### Why no auto-bootstrap?
- Prevents accidental privilege escalation
- Forces deliberate admin creation via Supabase Dashboard (requires Dashboard access)
- Avoids race conditions where the first signup might not be the intended admin

---

## 7. Admin protection layers

The admin system is protected by **three layers**:

### Layer 1: RLS (Row-Level Security) — Database level

| Policy | Effect |
|--------|--------|
| `user_roles: owner read` | Users can only READ their own roles |
| `user_roles: admin all` | Only `is_admin()` users can INSERT/UPDATE/DELETE roles |
| `tools: admin all` | Admins can manage any tool |
| `tool_health: admin all` | Only admins can update health status |
| `reviews: admin select all` / `admin update` | Only admins can moderate reviews |
| `tags: admin update` | Only admins can approve/reject tags |
| `tool_tags: admin insert` / `admin delete` | Only admins can manage tool-tag mappings |
| `profiles: admin select all` | Admins can view any profile |

### Layer 2: SECURITY DEFINER RPCs — Server level

Key functions that check roles server-side:
- `is_admin()` / `is_moderator()` — definitive role check (bypass RLS, uses `auth.uid()`)
- `get_submissions_for_review()` — raises `exception 'Not authorized'` if not admin/moderator
- `approve_submission(uuid)` — raises `exception 'Not authorized'` if not admin/moderator
- `reject_submission(uuid, text)` — same auth check
- `get_creator_email(uuid)` — checks collection ownership or admin
- `get_submitter_email(uuid)` — checks submission ownership or moderator

### Layer 3: Client-side route guards — UI level

| Page | Guard |
|------|-------|
| `/admin` | `if (!isAdmin && !isModerator) → "Access denied."` |
| `/admin/review` | `if (!isAdmin && !isModerator) → "Access denied."` |
| `/admin/health` | `if (!isAdmin) → "Access denied."` (component level, `AdminHealthPage.tsx:17` uses `useAuth().isAdmin`) |
| `/admin/reviews` | `if (!isAdmin) → "Access denied."` (component level, `AdminReviewModeration.tsx:17` uses `useAuth().isAdmin`) |
| `/admin/tags` | `if (!admin) → early return` (component level, `AdminTagModeration.tsx:9` uses `useAuth().isAdmin`) |

**Important note:** Client-side guards are convenience only. All sensitive operations are protected by RLS and RPC auth checks. A non-admin who bypasses the UI and calls Supabase directly will be blocked at layers 1 and 2.

---

## 8. Privilege escalation verification

**A normal user CANNOT escalate to admin or moderator.** Here's the verified chain:

### Attack vector: User tries to insert their own role
```
User calls: supabase.from('user_roles').insert({ user_id: 'my-id', role: 'admin' })
```
**Blocked by RLS:** `user_roles: admin all` policy requires `is_admin()` to return `true`. The `is_admin()` function checks `user_roles` table — which they have no admin row in. Circular dependency means the chicken-egg problem works in favor of security.

### Attack vector: User tries to call a protected RPC
```
User calls: supabase.rpc('approve_submission', { submission_id: '...' })
```
**Blocked by RPC:** `approve_submission()` checks `user_roles where user_id = auth.uid() and role in ('admin', 'moderator')`. Non-admin user gets `raised exception 'Not authorized'`.

### Attack vector: User modifies JWT claims
```
User tries: forge auth.uid() in JWT
```
**Blocked by Supabase:** JWT tokens are signed by Supabase Auth. `auth.uid()` is extracted from the validated token signature. Client cannot forge it.

### Attack vector: User calls RPC bypassing RLS
```
User calls: supabase.rpc('is_admin')
```
This is harmless — `is_admin()` is a read-only `STABLE` function. It returns `false` for non-admins. The `SECURITY DEFINER` privilege allows it to read `user_roles` but the user can't change the result.

### Verdict: **Safe.** No escalation path exists.

---

## 9. Admin bootstrap process

Since no automatic bootstrap exists, here is the safe, documented bootstrap process:

### Bootstrap steps

**Prerequisites:** Access to Supabase Dashboard (SQL Editor).

**Step 1:** Deploy the app and register your account via the Sign In / Sign Up flow.

**Step 2:** Get your auth UUID from Supabase Dashboard → Authentication → Users, or run:
```sql
select id, email from auth.users where email = 'your@email.com';
```

**Step 3:** Insert the admin role:
```sql
insert into public.user_roles (user_id, role)
values ('YOUR_USER_UUID', 'admin');
```

**Step 4:** Refresh the app. You now have full admin access.

### Creating additional admins

```sql
insert into public.user_roles (user_id, role)
values ('OTHER_USER_UUID', 'admin');
```

### Creating moderators

```sql
insert into public.user_roles (user_id, role)
values ('MODERATOR_USER_UUID', 'moderator');
```

### Revoking admin/moderator

```sql
delete from public.user_roles
where user_id = 'USER_UUID' and role = 'admin';
-- or
delete from public.user_roles
where user_id = 'USER_UUID' and role = 'moderator';
```

### Listing all admins and moderators

```sql
select u.email, r.role, r.created_at
from public.user_roles r
join auth.users u on u.id = r.user_id
order by r.role, r.created_at;
```

---

## Permission Matrix

| Area | Anonymous | Authenticated | Moderator | Admin |
|------|:---------:|:-------------:|:---------:|:-----:|
| **Browse tools** | ✅ Read | ✅ Read | ✅ Read | ✅ Read + Write all |
| **Submit tool** | ❌ | ✅ Submit | ✅ Submit + Review | ✅ Submit + Review |
| **Review submissions** | ❌ | ❌ | ✅ Approve/Reject | ✅ Approve/Reject |
| **Write reviews** | ❌ | ✅ Own | ✅ Own | ✅ Own + Moderate all |
| **Moderate reviews** | ❌ | ❌ | ❌ | ✅ Hide/Remove/Approve |
| **Manage tags** | ❌ | ✅ Suggest | ✅ Suggest | ✅ Approve/Reject |
| **Approve tags** | ❌ | ❌ | ❌ | ✅ |
| **Health checks** | ❌ | ❌ | ❌ | ✅ Run checks + Set status |
| **Admin dashboard** | ❌ | ❌ | ✅ `/admin`, `/admin/review` | ✅ All `/admin/*` |
| **Manage user roles** | ❌ | ❌ | ❌ | ✅ (via SQL only) |
| **View any profile** | ❌ | ❌ | ❌ | ✅ (via RLS policy) |
| **Create collections** | ❌ | ✅ Own | ✅ Own | ✅ Own |
| **Follow users** | ❌ | ✅ | ✅ | ✅ |
| **Tag tools** | ❌ | ❌ | ❌ | ✅ |

---

## Summary

| Question | Answer |
|----------|--------|
| Where are admin roles stored? | `user_roles` table with `role = 'admin'` |
| Where are moderator roles stored? | `user_roles` table with `role = 'moderator'` |
| How are roles checked? | `is_admin()` / `is_moderator()` SECURITY DEFINER RPCs |
| Admin dashboard route? | `/admin` (and 4 sub-routes) |
| How to become admin? | Manual SQL insert into `user_roles` |
| Bootstrap flow? | None — manual SQL required |
| Protected by? | RLS + SECURITY DEFINER RPCs + client-side guards |
| Can normal user escalate? | **No** — verified no escalation path exists |
