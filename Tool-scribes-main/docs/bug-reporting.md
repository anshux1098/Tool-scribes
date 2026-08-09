# Bug Reporting Workflow

## 1. Channels

| Channel | Scope | Max severity |
|---|---|---|
| In-app feedback button | All users | Low |
| GitHub Issues (private beta repo) | Beta testers | Medium |
| Discord `#bug-reports` | Beta testers | High |
| Email (emergency only) | All | Critical |

## 2. Bug Report Template

```markdown
## Bug Report

**Summary**: [1 sentence]

**Severity**: Critical / High / Medium / Low

**Environment**:
- Browser: [Chrome/Firefox/Safari/Edge + version]
- Device: [Desktop/Tablet/Mobile]
- OS: [Windows/macOS/iOS/Android]
- Auth status: [Logged in / Guest]
- User role: [User / Curator / Admin]

**Steps to reproduce**:
1. Go to [...]
2. Click on [...]
3. Scroll to [...]
4. See error

**Expected behavior**: [...]

**Actual behavior**: [...]

**Screenshot / Video**: [link or drag]

**Console errors**: [paste from DevTools Console tab]

**URL**: [full page URL when bug occurred]
```

## 3. Severity Definitions

| Severity | Definition | Response SLA | Fix SLA |
|---|---|---|---|
| **Critical** | App unusable, data loss, auth broken | 2 hours | 24 hours |
| **High** | Major feature broken, no workaround | 8 hours | 48 hours |
| **Medium** | Feature partially broken, workaround exists | 24 hours | 1 week |
| **Low** | Cosmetic, typo, minor UI glitch | 1 week | Next release |

## 4. Triage Process

```
1. User reports bug (any channel)
2. Triage: assign severity + label
   - Critical: notify immediately (phone/SMS)
   - High: ping in team Discord
   - Medium/Low: add to Sprint Backlog
3. Reproduce: confirm bug in production
4. Fix: create branch, fix, verify
5. Deploy: push to production
6. Close: notify reporter + update status
```

## 5. Labels (GitHub Issues)

| Label | Meaning |
|---|---|
| `bug` | Confirmed bug |
| `critical` | Ship-stopping |
| `high` | Major impact |
| `medium` | Moderate impact |
| `low` | Minor issue |
| `needs-repro` | Can't reproduce yet |
| `duplicate` | Already reported |
| `fixed` | Deployed to production |
| `wontfix` | Intentional behavior / out of scope |

## 6. Feedback Button (In-App)

Add a small floating feedback button to all pages:

```
[Feedback] → opens modal with:
  - "What happened?" (text area)
  - "Screenshot" (optional file upload)
  - "Page URL" (auto-filled)
  - "Browser info" (auto-filled via navigator.userAgent)
  → Submits to `feedback` table in Supabase
```

Create the table:

```sql
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  message text not null,
  page_url text,
  browser_info text,
  screenshot_url text,
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

create policy "Anyone can insert feedback"
  on public.feedback for insert
  with check (true);

create policy "Admins can read feedback"
  on public.feedback for select
  using (auth.uid() in (select user_id from public.user_roles where role = 'admin'));
```

## 7. Post-Fix Verification

After deploying a fix:
1. Reproduce the original bug → confirm gone
2. Run `npm run build` → passes
3. Run affected flow manually (the section + adjacent sections)
4. Update issue label to `fixed`
5. Reply to reporter with "Fixed in {version}. Please verify."

## 8. Bug Tracking Dashboard

Supabase query for admin panel:

```sql
select
  severity,
  count(*) as open_count
from public.feedback
where resolved_at is null
group by severity
order by severity desc;
```

Display in existing AdminHealth.tsx or as admin dashboard widget.
