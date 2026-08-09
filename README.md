# ToolScribe

**Discover, curate, review, and share the best software tools — with an AI assistant in your corner.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat)
![React](https://img.shields.io/badge/React%2018-61DAFB?logo=react&logoColor=black&style=flat)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white&style=flat)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?logo=tailwindcss&logoColor=white&style=flat)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white&style=flat)
![Vercel](https://img.shields.io/badge/Deployed%20on%20Vercel-000000?logo=vercel&logoColor=white&style=flat)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## About

ToolScribe is a community-driven tool discovery platform. Instead of one person's list, the catalog is built by its users: anyone can submit a tool, organize it into collections, write structured reviews, tag it, suggest alternatives, and follow the curators whose taste they trust.

It solves the "another blog post listing 50 tools" problem — everything is searchable, votable, reviewable, and alive. Stale tools get flagged by automated health checks, and an AI assistant (Ask ToolScribe) helps you find the right tool for the job.

## Features

- **Discover feed** — trending, rising, newest, and featured tools with category browsing and search
- **Personal Vault** — save tools, mark favorites, add notes, tag saves, and track visits
- **Dust collector** — resurfaces tools you saved long ago so they don't rot in your vault
- **Collections** — public or private; follow collections and clone public ones in one click
- **Structured reviews** — "best for", gotchas, and free-tier notes; reviewed and moderated by admins
- **Community submissions** — submit a URL and get metadata + category auto-suggested, with a duplicate check and an admin approval workflow
- **Ask ToolScribe** (`Ctrl/Cmd+Shift+K`) — natural-language tool recommendations from the live catalog, plus context-aware Q&A on any tool page
- **AI-generated tool profiles** — neutral one-paragraph summaries generated from each tool's live site
- **Tag ecosystem** — community-submitted tags with admin moderation and per-tag subscriptions
- **Alternatives** — community-suggested alternatives with voting, surfaced per tool and in the feed
- **Curator profiles** — hero, bio, socials, "Currently Loving" shelf, featured collection, and activity feed
- **Social** — follow curators, a following feed, and notifications
- **Tool health checks** — live status/uptime badges so dead links are caught early
- **Reputation system** — scores earned from approved submissions, active reviews, and followers
- **Admin panel** — submission review, review/tag/alternative moderation, and a health dashboard
- **Extras** — light/dark theme, keyboard shortcuts, onboarding flow, fully responsive

<!-- add screenshot/gif here -->

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 8 |
| Styling | Tailwind CSS, shadcn/ui (Radix primitives), framer-motion |
| State & data | TanStack Query, React Router, react-hook-form + Zod, next-themes |
| Backend | Supabase (Postgres, Auth, RLS, Storage) |
| Edge functions | Deno — `ask-toolscribe`, `generate-ai-profile` |
| AI | OpenRouter (free models with automatic fallback) + Gemini fallback |
| Testing | Vitest + React Testing Library, Playwright |
| Deployment | Vercel |

## Installation

Requires **Node.js 20.19+ or 22.12+** and a [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/anshux1098/Tool-scribes.git
cd Tool-scribes
npm install
cp .env.example .env
```

Fill in your Supabase credentials in `.env`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Start the dev server (runs on port 8080):

```bash
npm run dev
```

### Database & backend setup

1. In the Supabase dashboard → SQL Editor, run [`supabase-schema.sql`](./supabase-schema.sql).
2. Apply any newer migrations in [`supabase/migrations/`](./supabase/migrations/) in order.
3. Make your first admin (required before moderation works):
   ```sql
   insert into public.user_roles (user_id, role)
   values ('REPLACE_WITH_AUTH_USER_UUID', 'admin');
   ```
4. Deploy the edge functions with their secrets:
   ```bash
   npx supabase functions deploy ask-toolscribe --project-ref YOUR_REF --no-verify-jwt
   npx supabase functions deploy generate-ai-profile --project-ref YOUR_REF --no-verify-jwt
   npx supabase secrets set OPENROUTER_API_KEY=your_key GEMINI_API_KEY=your_key
   ```

## Usage

Run the app and browse the discover feed, save tools to your vault, and build collections. Everything is driven by the Supabase client in [`src/lib/supabase.ts`](./src/lib/supabase.ts).

Invoke the AI assistant programmatically:

```ts
import { askToolScribe } from "@/lib/ask-toolscribe";

const res = await askToolScribe("A free, self-hosted alternative to Notion");
console.log(res.recommendations); // [{ toolId, name, reason, category, icon }, ...]
```

Scripts:

```bash
npm run dev          # dev server on :8080
npm run build        # production build
npm run preview      # preview the production build
npm run lint         # ESLint
npm test             # run Vitest unit tests
```

## Project Structure

```
src/
├── pages/          # Route-level pages (Discover, Vault, ToolDetail, Profile, Admin…)
├── components/     # Feature components + shadcn/ui primitives
├── hooks/          # useAuth, useTools, useCollections, useReviews, useProfile…
├── lib/            # Supabase client, search, recommendations, submission, health…
│   └── search/     # Client-side search engine
└── test/           # Vitest unit tests
supabase/
├── functions/      # Deno edge functions (ask-toolscribe, generate-ai-profile)
└── migrations/     # Incremental schema migrations
scripts/            # Deploy helper scripts
docs/               # Internal design & launch reports
supabase-schema.sql # Full database schema (RLS policies, functions, triggers)
```

## Status

In active development. Core features are built and the production build passes clean; some polish items (accessibility, pagination, role-management UI) remain. See the internal reports in [`docs/`](./docs/) for details.

## Contributing

Contributions are welcome. Open an issue to discuss changes, then submit a PR:

1. Fork the repo and create a feature branch.
2. Run `npm run lint` and `npm test` before pushing.
3. Keep PRs focused and describe what/why in the description.

## License

Released under the [MIT License](LICENSE).

## Author

**Anshuman Singh** — [@anshux1098](https://github.com/anshux1098)
