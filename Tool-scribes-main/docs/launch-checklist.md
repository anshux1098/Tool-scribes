# Launch Checklist

## Pre-Launch (T-7 days)

### Infrastructure
- [ ] `npm run build` passes (2525 modules, 0 errors)
- [ ] Storage buckets exist in production: `avatars`, `banners`, `collection-covers`
- [ ] `delete_my_account` RPC deployed to production
- [ ] All 12+ RPCs present in production DB
- [ ] Supabase project on paid plan (free tier request limits will throttle)
- [ ] Database connection pooling configured (Supabase pooler)
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid
- [ ] CDN caching enabled (static assets)
- [ ] Rate limiting configured on auth endpoints

### Content
- [ ] 30+ tools seeded
- [ ] 15+ reviews seeded
- [ ] 6+ collections seeded
- [ ] 5+ alternative pairs seeded
- [ ] 3 seed curator accounts active
- [ ] Follower relationships created
- [ ] No empty states visible on any page (logged out)
- [ ] No empty states visible on any page (fresh user)

### Monitoring
- [ ] Error tracking configured (Sentry or equivalent)
- [ ] Uptime monitoring configured (pingdom, betteruptime, or equivalent)
- [ ] Supabase log retention enabled
- [ ] Backup schedule configured (point-in-time recovery)

### Legal
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Cookie notice implemented (if analytics tracking)
- [ ] DMCA / copyright contact published

## Launch Day (T-0)

### Pre-launch checks (1 hour before)
- [ ] Run `npm run build` — green
- [ ] Deploy latest build to production
- [ ] Smoke test all 5 flows (Guest → User → Curator → Submitter → Admin)
- [ ] Check Supabase logs for errors in last 10 min
- [ ] Verify storage uploads work (avatar, banner, cover)
- [ ] Verify auth (sign up, sign in, sign out, delete account)
- [ ] Verify notification delivery (bell icon, dropdown, click)
- [ ] Verify collections hub loads (search, filter, sort)
- [ ] Verify recommendations render on tool pages
- [ ] Verify alternatives section renders with vote ability
- [ ] Verify admin routes accessible (moderation, health)

### Launch
- [ ] Announce on personal social media (Twitter/X, LinkedIn)
- [ ] Post to relevant dev communities (Hacker News, r/webdev, r/programming, dev.to)
- [ ] Email beta tester list with "we're live!"
- [ ] Enable analytics tracking

### Post-launch monitoring (first 4 hours)
- [ ] Check error tracking every 30 min
- [ ] Monitor Supabase CPU / connections
- [ ] Watch sign-up rate
- [ ] Watch page load performance (Lighthouse / Web Vitals)
- [ ] Respond to any critical bugs within SLA

## Post-Launch (T+24 hours)

### First-day review
- [ ] Review analytics: page views, sign-ups, saves, reviews
- [ ] Check all bug reports, triage by severity
- [ ] Fix any Critical/High bugs found
- [ ] Deploy hotfix if needed

### First-week goals
| Metric | Target |
|---|---|
| Sign-ups | 50+ |
| Tools saved | 100+ |
| Reviews written | 20+ |
| Collections created | 10+ |
| DAU on day 7 | 20+ |

### First-month roadmap
1. Fix top 10 bugs from user feedback
2. Improve search relevance (full-text search on tools)
3. Add email notifications (tool approved, new follower)
4. Performance optimization (lazy load images, pagination)
5. Gather NPS from first 100 users
