# Tool-scribes — Project Context

## Overview
A curator tool discovery platform (React/Vite/TypeScript + Supabase). Users curate collections of tools, write reviews, and follow curators.

## Current State: Profile Completion Sprint
Build passes clean. All profile features implemented.

### Profile Page Features (`src/pages/ProfilePage.tsx`)
- **Hero section**: Avatar, display name, username, tagline, bio, location, social links, signature quote, curator badge, stats (tools/collections/followers/reviews), message button (opens `contact_url`)
- **Shelf**: "Currently Loving" — up to 3 tools displayed in a row at the top of the content area
- **Featured Collection**: Editorial showcase with cover gradient/background-image, tool count, follower count, last-updated date, tool icon strip, "View collection" CTA
- **Collections grid**: Cards with cover image or deterministic gradient, tool icons, follow count, last-updated date
- **Recent Reviews**: Up to 3 cards with tool logo, star rating, best-for, gotcha, relative date
- **Activity Feed**: Visual timeline cards with type-specific icons (plus/bookmark/star), action labels, relative dates
- **Curator Insights (right column)**: Tools curated count, collections count, reviews count, curator badge
- `hashId()` utility for UUID→numeric-ID tool navigation
- Scroll-to-section buttons for stats, collections, reviews

### Profile Editor (`src/components/ProfileSettingsModal.tsx`)
- Display Name, Username, Tagline, Bio, Location, Website
- GitHub, Twitter/X, LinkedIn social links
- Contact URL field (Calendly, email link, etc.)
- Avatar + Banner upload with preview
- Signature quote
- Curator badge selection (6 options + none)
- Featured collection selector (dropdown of user's collections)
- Currently Loving shelf manager (add/remove tools, max 3)
- Visibility toggles: show collections, show reviews, show followers, public profile

### Key Implementation Details
- `contact_url` stored in `profiles.contact_url` — opened in new tab from "Message" button
- `followerCount` queried from `collection_followers` table batch
- Fallback visuals via `src/lib/visuals.ts` (DiceBear avatars, picsum.photos banners)
- Deterministic collection cover gradients (8 dark editorial palettes, hash-based selection)
- Tool navigation uses `hashId()` for numeric-id route; collection nav uses raw UUID
- `rowToProfile` in `useProfile.ts` maps all fields from `ProfileRow`

### Database Schema Changes Applied via Migrations
1. `add_profile_identity_and_shelf` — `signature_quote text`, `curator_shelf` table with RLS
2. `enable_rls_and_policies_tags` — RLS on `tags`, `tool_tags`, `tag_subscriptions`
3. `add_contact_url_to_profiles` — `contact_url text`

Pending schema: `tagline`, `location`, `website`, `github`, `twitter`, `linkedin`, `avatar_url`, `banner_url`, `featured_collection_id`, `curator_badge`, visibility booleans, `cover_image_url` on `collections`.

### Design Tokens (ProfilePage)
- Background: `#F0EDE6`, Cards: `#FFFFFF`, Primary green: `#2D6A4F`
- Text: `#1a1a1a` primary, `#6b6b6b` secondary
- Fonts: Playfair Display (`font-syne`) for headings, Inter (`font-dmsans`) for body

### Routes
- `/profile` → `MyProfilePage` (own profile, old design tokens, Supabase-backed)
- `/u/:username` → `ProfilePage` (public profile, new design tokens, Supabase-backed)

### Database source of truth (IMPORTANT)
The live Supabase database (project `qglvwvpsegrucrhcpzxd`) is the single source
of truth for the schema. The hand-written `supabase-schema.sql` that used to sit
at the repo root was badly stale and has been **removed** — see
`docs/legacy-sql-archive/README.md` for why. Read `supabase/README.md` before
touching the database.

- `supabase/schema_structure.sql` and `supabase/functions.sql` are **generated**
  snapshots — never hand-edit them.
- `supabase/migrations/` contains only migrations genuinely applied to
  production, named with their exact remote version. Adding a file there without
  applying it makes `supabase db push` replay it.
- `supabase/MIGRATION_HISTORY.md` is the authoritative applied-history list.
- Known open schema/security issues are listed in `supabase/README.md`.
