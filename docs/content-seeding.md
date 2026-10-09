# Content Seeding Checklist

Goal: Make the platform look alive on day 1 — no empty states, no "be the first" messages.

## 1. Seed Tools (Minimum 30)

| Priority | Tool | Category | Action |
|---|---|---|---|
| P0 | eslint | Developer Tools | Add + review + save to collection |
| P0 | prettier | Developer Tools | Add + review |
| P0 | vite | Developer Tools | Add + review |
| P0 | react | Frameworks | Add + review + save to collection |
| P0 | typescript | Languages | Add + review |
| P0 | docker | DevOps | Add + alternative suggest |
| P0 | git | Version Control | Add + review |
| P0 | postgresql | Databases | Add |
| P0 | redis | Databases | Add + alternative |
| P0 | nginx | DevOps | Add |
| P1 | webpack | Developer Tools | Add + alternative to vite |
| P1 | babel | Developer Tools | Add |
| P1 | jest | Testing | Add + review |
| P1 | playwright | Testing | Add |
| P1 | vitest | Testing | Add + alternative to jest |
| P1 | tailwindcss | CSS | Add |
| P1 | sass | CSS | Add + alternative |
| P1 | nextjs | Frameworks | Add + collection |
| P1 | express | Frameworks | Add |
| P1 | prisma | ORM | Add + review |
| P2 | kubernetes | DevOps | Add |
| P2 | terraform | DevOps | Add |
| P2 | graphql | APIs | Add |
| P2 | rust | Languages | Add |
| P2 | go | Languages | Add + alternative |
| P2 | zig | Languages | Add |
| P2 | sqlite | Databases | Add |
| P2 | mongodb | Databases | Add + alternative |
| P2 | postman | APIs | Add + review |
| P2 | swagger | APIs | Add + alternative |

## 2. Seed Reviews (Minimum 15)

Create 2-3 seed reviewer accounts. Each writes 5-8 reviews on seeded tools.

| Account | Focus | Reviews |
|---|---|---|
| `alice_reviewer` | Developer tools, testing | 6 reviews (150-300 chars each) |
| `bob_builder` | Frameworks, DevOps | 6 reviews |
| `carol_curator` | Databases, Languages | 5 reviews |

Review content: 2-3 sentences, realistic but positive. Mix of:
- "Great for X because Y"
- "Learning curve is Z"
- "Pairs well with W"

## 3. Seed Collections (Minimum 6)

| Collection | Owner | Tools | Description |
|---|---|---|---|
| "Essential Dev Tools" | `carol_curator` | eslint, prettier, vite, git, typescript | "Tools I install on every project" |
| "Backend Essentials" | `bob_builder` | express, postgresql, redis, docker, prisma | "My go-to backend stack" |
| "Testing Toolbox" | `alice_reviewer` | jest, playwright, vitest | "Testing tools worth your time" |
| "CSS Utilities" | `carol_curator` | tailwindcss, sass | "Making the web beautiful" |
| "API Tooling" | `bob_builder` | postman, swagger, graphql | "Design, test, document" |
| "DevOps Starter" | `carol_curator` | docker, nginx, kubernetes | "From local to production" |

## 4. Seed Curator Shelf

Each seed account adds 3-5 tools to their shelf.

## 5. Seed Alternatives (Minimum 5 pairs)

| Tool A | Tool B | Suggested By |
|---|---|---|
| vite | webpack | `alice_reviewer` |
| jest | vitest | `alice_reviewer` |
| tailwindcss | sass | `bob_builder` |
| mongodb | postgresql | `carol_curator` |
| swagger | graphql | `carol_curator` |

## 6. Seed Followers

- `alice_reviewer` follows `carol_curator`
- `bob_builder` follows `alice_reviewer` and `carol_curator`
- `carol_curator` follows `bob_builder`

## 7. Notification Seeding

After seeding, trigger one notification per type to verify:
- `new_tool` — submit a tool as one seed user, check another sees it
- `new_collection` — create collection
- `collection_updated` — add tool to collection
- `new_review` — write a review
- `new_follower` — follow someone
- `collection_followed` — follow a collection

## 8. Execution

1. Create seed accounts via Supabase Auth UI (email+password, no real emails)
2. Use Supabase Dashboard SQL editor to bulk-insert tools
3. Use the app UI for reviews, collections, shelf, alternatives (sanity check UX)
4. Verify: no "empty state" visible when logged out OR logged in as new user
