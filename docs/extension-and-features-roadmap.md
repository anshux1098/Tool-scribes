# Tool-scribes — Browser Extension & New Features Roadmap

## Part 1: Browser Extension Features (Chrome / Arc / Firefox)

### 1. 1-Click "Clip to Vault & Collection" Popup
- **Trigger**: Extension toolbar icon or keyboard shortcut (`Alt+S`).
- **Behavior**: Reads the active tab's live DOM (`document.title`, `window.location.href`, meta description, OG image, favicon) with zero server-side scraping latency.
- **Actions**: Select a Collection (`useCollections`), add personal notes & tags, and save directly to `vault_items` / `tools`.

### 2. Passive "Dust Collector" & Real Usage Tracker
- **Problem Solved**: Currently `useDustCollector.ts` only updates `last_visited_at` when a user clicks "Visit" from inside the Tool-scribes web app.
- **Behavior**: When the user visits a domain matching a tool in their `vault_items`, the extension background worker silently pings `last_visited_at` (debounced once per 24h per tool).
- **Value**: Turns `VaultDustSection` into an accurate, automated SaaS/tool usage tracker that reveals which tools are actually used vs. gathering dust.

### 3. Contextual "ToolScribe Radar" Side-Badge
- **Behavior**: When browsing any known software tool domain or GitHub repo, displays a non-intrusive pill showing:
  - Community star rating + structured reviews (**Best For**, **Gotcha**, **Free Tier**).
  - Top community-voted **Alternatives** (`alternatives.ts`).
  - Curators you follow who feature this tool on their **"Currently Loving"** shelf.
  - Live tool health status (`ToolHealthBadge`).

### 4. Global `Cmd+Shift+K` Vault Launcher & AI Assistant
- **Behavior**: Command palette overlay accessible from any tab or Browser New Tab page.
- **Actions**: Search personal Vault, filter by tags/notes, or query `ask-toolscribe` to jump straight to a saved tool.

---

## Part 2: Web Platform Features

### 1. Side-by-Side "Tool Matrix" Comparison (`/compare`)
- Compare 2–3 tools side-by-side using existing structured review fields (`best_for`, `gotcha`, `free_tier`, `rating`), health status, pricing model, open-source status, and platforms.

### 2. Embeddable "My Stack" Card (for GitHub READMEs & Personal Sites)
- Dynamic SVG or iframe widget showcasing a curator's **"Currently Loving" shelf** or **Featured Collection** from `/u/:username`, driving organic referrals back to Tool-scribes.
