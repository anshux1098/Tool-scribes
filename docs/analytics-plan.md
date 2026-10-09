# Analytics Implementation Plan

## 1. Events to Track (No new features — instrument what exists)

### Acquisition
- `page_view` — every route (guest, tool, profile, collection, discover)
- `sign_up` — auth registration
- `sign_in` — auth login

### Activation
- `tool_saved` — vault item added
- `collection_created` — first collection
- `review_written` — first review
- `alternative_suggested` — first alternative

### Engagement
- `tool_view` — tool detail page
- `profile_view` — profile page
- `collection_view` — collection page
- `search_executed` — search query submitted
- `vault_item_removed` — tool unsaved
- `collection_followed` / `collection_unfollowed`
- `profile_followed` / `profile_unfollowed`

### Retention
- `session_*` — daily/weekly active user markers
- `notification_click` — notification panel interaction
- `return_visit` — second+ session within 7 days

### Revenue (future)
- Placeholder for future monetization events

## 2. Implementation

### Option A: PostHog (Recommended for MVP)
- Self-host or PostHog Cloud (free tier: 1M events/mo)
- `posthog-js` snippet in `index.html`
- Automatic page views + click autocapture
- Custom events: `posthog.capture('tool_saved', { tool_id, tool_name })`
- Dashboard: acquisition funnel, DAU/MAU, retention cohort

### Option B: Plausible / Simple Analytics
- Lightweight, privacy-first
- Page views + custom goal events
- No autocapture — `data-analytics-goal` attributes on key buttons

### Option C: Custom Supabase-based
- `analytics_events` table with JSONB payload
- Batch insert via RPC every 30s
- Pros: no third-party, data stays in Supabase
- Cons: no dashboard UI — requires building

## 3. Minimum Viable Instrumentation (Week 1)

```ts
// src/lib/analytics.ts
type Event =
  | { type: 'page_view'; path: string }
  | { type: 'tool_saved'; toolId: string; toolName: string }
  | { type: 'tool_view'; toolId: string; toolName: string }
  | { type: 'review_written'; toolId: string }
  | { type: 'collection_created' }
  | { type: 'search_executed'; query: string }
  | { type: 'sign_up' }
  | { type: 'sign_in' };

function track(event: Event) {
  if (!isSupabaseConfigured) return;
  // Send to analytics backend (PostHog / Supabase / Plausible)
  if (typeof window !== 'undefined' && 'posthog' in window) {
    (window as any).posthog.capture(event.type, event);
  }
}
```

Call from:
- `ToolDetailPage.tsx` — `track({ type: 'tool_view', toolId, toolName })` on mount
- `VaultGridCard.tsx` — `track({ type: 'tool_saved', toolId, toolName })` on save
- `ReviewForm.tsx` — `track({ type: 'review_written', toolId })` on submit
- `useCollections.ts` — `track({ type: 'collection_created' })` on create
- `Navbar.tsx` search — `track({ type: 'search_executed', query })`
- `useAuth.ts` — `track({ type: 'sign_up' })` and `track({ type: 'sign_in' })`

## 4. Key Dashboards to Build

| Dashboard | Purpose |
|---|---|
| **Daily Active Users** | Line chart of unique users/day |
| **Top Saved Tools** | Most frequently vaulted tools |
| **Conversion Funnel** | Sign-up → Save first tool → Write review → Create collection |
| **Retention Cohort** | Users active in week 1 vs week 2 vs week 4 |
| **Search Queries** | What users search for (trending topics) |
| **Notification CTR** | How many notification → click → action |

## 5. Privacy & Compliance
- Add cookie consent banner before any tracking
- Document data collected in `PRIVACY.md`
- Offer opt-out in SettingsPage
- No PII in event payloads (use anonymous IDs)
- Data retention: 90 days rolling for MVP
