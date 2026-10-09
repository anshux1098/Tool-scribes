# Beta Tester Onboarding Checklist

## 1. Recruitment (First 20 Testers)

### Who to invite
- 5 developers from personal network
- 5 from dev Discord/communities (r/webdev, r/programming)
- 5 tool-makers (OSS maintainers, indie devs)
- 5 power users (technical PMs, engineering leads)

### Invite template

```
Subject: Beta access: Tool Scribes

Hey {name},

I'm launching Tool Scribes — a discovery platform for developer tools.
I'd love your feedback before the public launch.

What it is:
- Discover & save dev tools
- Curated collections by topic
- Tool comparisons & alternatives

What I need from you:
1. Create an account (60s)
2. Save 3 tools you use
3. Write 1 review
4. Report anything broken

Your feedback shapes the product.

Link: {invite_link}

Thanks,
{your_name}
```

## 2. Access Setup

- [ ] Create beta tester role via `user_roles` table (`role = 'beta_tester'`)
- [ ] Optional: gate sign-up behind invite code (no code change — just share link)
- [ ] Provide each tester a unique tracking ID for feedback attribution

## 3. Tester Tasks (in order)

### Day 1: Kickoff
- [ ] Create account
- [ ] Complete profile (avatar, bio)
- [ ] Browse Discover page
- [ ] Search for 3 tools
- [ ] Save 3 tools to vault
- [ ] Write 1 review

### Day 2-3: Deeper
- [ ] Create 1 collection
- [ ] Suggest 1 alternative
- [ ] Follow 1 curator
- [ ] Follow 1 collection
- [ ] View notification panel

### Day 4-5: Power user
- [ ] Use mobile (check responsiveness)
- [ ] Test dark/light mode if available
- [ ] Submit 1 new tool (tool submission flow)
- [ ] Share a collection link externally

## 4. Feedback Collection

### Per-tester feedback form (Google Forms / Tally)

```
1. What was the first thing you did on the platform? [text]
2. Did you encounter any errors? [text]
3. Rate the discover page: 1-5 [scale]
4. Rate the tool detail page: 1-5 [scale]
5. Rate the vault/save feature: 1-5 [scale]
6. What's missing? [text]
7. Would you recommend this to a colleague? [Y/N]
8. Any other feedback? [text]
```

### Weekly 15min sync
- Review bug reports
- Review analytics (DAU, top saved tools)
- Prioritize fixes for next week

## 5. Tester Communication

| Frequency | Channel | Content |
|---|---|---|
| Day 1 | Email | Welcome + tasks + link to feedback form |
| Day 3 | Email | Reminder + "what we fixed" |
| Day 7 | Email | "Thank you" + results + public launch ETA |
| Weekly | Discord (opt-in) | Changelog, open discussion |

## 6. Success Criteria (Beta Phase)

| Metric | Target |
|---|---|
| Testers completed onboarding | 15/20 |
| Testers saved 3+ tools | 12/20 |
| Testers wrote 1+ review | 10/20 |
| Critical bugs found | 0 (all fixed before launch) |
| NPS from testers | 30+ |
