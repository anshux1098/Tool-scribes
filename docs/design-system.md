# ToolScribe Design System

> **Version:** 1.0
> **Last Updated:** 2026-06-10
> **Status:** Active — single source of truth for all UI work.

---

## 1. Design Philosophy

| Attribute | Value |
|---|---|
| **Style breakdown** | 70% Editorial Design · 20% Apple-inspired Minimalism · 10% Soft Brutalism |
| **Design goals** | Premium, Curated, Collectible, Magazine-like |
| **Anti-patterns** | Glassmorphism, Neumorphism, large gradients, generic SaaS dashboards |

Every UI decision should make the user feel like they are browsing a curated magazine, not a SaaS dashboard.

---

## 2. Color Palette

### 2.1 Light Theme (Primary)

| Token | Hex | HSL | CSS Variable | Usage |
|---|---|---|---|---|
| Background | `#F7F4EE` | `40 15% 95%` | `--bg` | Page background |
| Surface | `#FFFDF9` | `40 40% 99%` | `--surface` | Cards, modals, elevated panels |
| Surface 2 | `#F1ECE2` | `40 18% 92%` | `--s2` | Inputs, secondary surfaces, hover states |
| Surface 3 | `#EBE5D9` | `38 16% 88%` | `--s3` | Tertiary surfaces |
| Primary Text | `#111111` | `0 0% 7%` | `--text` | Body and heading text |
| Secondary Text | `#6B7280` | `220 9% 46%` | `--text-s` | Secondary information |
| Muted Text | `#9CA3AF` | `218 11% 65%` | `--text-m` | Placeholder, metadata, captions |
| Accent Green | `#3A6B52` | `152 30% 32%` | `--primary` | Primary actions, brand accent |
| Accent Dark | `#2D5540` | `152 30% 25%` | `--primary-dark` | Hover states for primary |
| Accent Glow | `rgba(58,107,82,0.10)` | — | `--primary-g` | Active states, success backgrounds |
| Border | `#111111` | `0 0% 7%` | `--border` | All borders |
| Border Light | `#3F3F3F` | `0 0% 25%` | `--border-l` | Lighter borders, secondary dividers |

### 2.2 Dark Theme

| Token | Hex (approx) | HSL | CSS Variable |
|---|---|---|---|
| Background | `#1A1815` | `30 7% 10%` | `--bg` |
| Surface | `#26231E` | `30 8% 14%` | `--surface` |
| Surface 2 | `#322E28` | `30 6% 18%` | `--s2` |
| Accent Green | `#5A8B72` | `152 22% 45%` | `--primary` |
| Primary Text | `#EBE5D9` | `38 16% 88%` | `--text` |
| Border | `#3F3F3F` | — | `--border` |

### 2.3 Category Chip Colors

| Category | Text Hex | Background |
|---|---|---|
| AI | `#B45309` | `rgba(180,83,9,0.08)` |
| Dev | `#1D4ED8` | `rgba(29,78,216,0.08)` |
| Design | `#7E22CE` | `rgba(126,34,206,0.08)` |
| Productivity | `#2D6A4F` | `rgba(45,106,79,0.08)` |
| Learning | `#92400E` | `rgba(146,64,14,0.08)` |
| Utilities | `#374151` | `rgba(55,65,81,0.08)` |

Category chips use inline `style` props with `CATEGORY_COLORS` and `CATEGORY_BG` constants from `src/lib/types.ts`.

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Fallback | Tailwind Class | Usage |
|---|---|---|---|---|
| Headings | Playfair Display | Georgia, serif | `font-syne` | All headings, brand text, tool names |
| Body | Inter | system-ui, sans-serif | `font-dmsans` (default body) | Body text, navigation |
| Mono | Geist Mono | monospace | `font-mono` | Labels, tags, metadata, code |

### 3.2 Font Sizing (pixel scale)

All sizes use explicit pixel values via `text-[Npx]`:

| Size | Usage | Font |
|---|---|---|
| `[10px]` | Section labels, stat counts | `font-mono` + `uppercase tracking-widest` |
| `[11px]` | Category badges, meta text, time stamps | `font-mono` |
| `[12px]` | Tag pills, small descriptions | `font-mono` |
| `[13px]` | Buttons, inputs, body text, tool descriptions | body |
| `[14px]` | Larger body text, detail description | body |
| `[15px]` | Detail page summary | body |
| `[16px]` | Card subheadings | — |
| `[17px]` | Collection card names | `font-syne` |
| `[20px]` | Inline rename input | `font-syne` |
| `[28px]` | Tool detail heading | `font-syne` |
| `[32px]` | Empty state heading | `font-syne` |
| `[36px]` | Collection page heading | `font-syne` |
| `[40px]` | Page hero title | `font-syne` |

### 3.3 Text Transform Convention

All section labels and group headers:
```
text-[10px] font-mono text-tv-text-m uppercase tracking-widest
```

---

## 4. Spacing

| Scale | Token | Usage |
|---|---|---|
| 4px | `gap-1` | Tight icon/text spacing |
| 6px | `gap-1.5` | Button icon/text, tag spacing |
| 8px | `gap-2` | Element groups |
| 12px | `gap-3` | Section spacing, filter bar |
| 16px | `gap-4` / `p-4` / `px-4` | Card padding, row padding |
| 20px | `p-5` / `px-5` | Collection card padding |
| 24px | `p-6` / `px-6` | **Standard page horizontal padding** |
| 32px | `py-8` | Section vertical spacing |
| 48px | `pt-12` | Large section top spacing |

**Page container:** `max-w-3xl mx-auto` (768px max width) for all content pages.

---

## 5. Card Styles

### 5.1 Collection Cards (Grid)

```
bg-surface border-2 border-tv-border rounded-xl shadow-brutal
hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-hover
transition-all duration-150
```

### 5.2 Tool Cards (Discover)

```
bg-surface border border-tv-border rounded-xl overflow-hidden
hover:border-tv-primary/30 hover:shadow-card
transition-shadow duration-200 cursor-pointer
```

### 5.3 Tool Rows (Vault / Discover list)

```
tool-row flex items-center gap-4 px-4 py-3.5 border-b border-tv-border cursor-pointer group
```

Hover effect (CSS):
```css
.tool-row:hover { background: rgba(58,107,82,0.035); }
```

### 5.4 Modal Panels

```
bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden
```

---

## 6. Shadows

| Name | Light Value | Usage |
|---|---|---|
| `shadow-soft` | `0 0 0 1px rgba(0,0,0,.04), 0 1px 2px -1px rgba(0,0,0,.06), 0 2px 4px rgba(0,0,0,.04)` | Card hover, subtle elevation |
| `shadow-card` | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` | Modal panels |
| `shadow-glow` | `0 4px 16px rgba(58,107,82,0.20)` | Primary button hover |
| `shadow-brutal` | `6px 6px 0 #111111` | Collection cards, brutalist elements |
| `shadow-brutal-hover` | `10px 10px 0 #111111` | Card hover (with translate) |

---

## 7. Borders

| Token | Value | Usage |
|---|---|---|
| Standard | `1px solid hsl(var(--border))` | All component borders |
| Brutalist | `2px solid #111111` | Collection cards, feature cards |
| Focus | `1px solid hsl(var(--primary))` | Input focus state |
| Dashed | `1px dashed hsl(var(--border))` | Add-tag input, drop zones |

**Border radius:**
- `rounded-sm`: 4px
- `rounded-md`: 6px (nav tabs)
- `rounded-lg`: 8px (buttons, inputs, badges)
- `rounded-xl`: 12px (cards, modals, image containers)
- `rounded-2xl`: 16px (main modal panels)

---

## 8. Interactive States

### 8.1 Buttons

**Primary CTA:**
```
bg-tv-primary text-white rounded-lg text-[13px] font-medium
hover:bg-tv-primary-dark disabled:opacity-40
transition-all duration-150
```

**Outlined/Secondary:**
```
px-3 py-1.5 border border-tv-border rounded-lg text-[13px] text-tv-text-s
hover:text-tv-text hover:border-tv-border-l
transition-colors duration-150
```

**Ghost/Icon:**
```
p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text
transition-colors duration-150
```

**Active state (upvote/save toggled):**
```
bg-tv-primary-g border-tv-primary text-tv-primary
```

### 8.2 Inputs

```
w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5
text-[13px] text-tv-text placeholder:text-tv-text-m
focus:outline-none focus:border-tv-primary
transition-all duration-150
```

**Inline compact input:**
```
h-8 px-3 bg-s2 border border-tv-border rounded-lg
text-[13px] text-tv-text placeholder:text-tv-text-m
focus:outline-none focus:border-tv-primary
transition-colors
```

### 8.3 Links

```
text-[13px] text-tv-text-s hover:text-tv-text transition-colors font-mono
```

### 8.4 Row Hover (VaultCard / DiscoverRow)

Framer Motion:
```tsx
whileHover={{ x: 4 }}
transition={{ type: 'spring', stiffness: 400, damping: 30 }}
```

**Hover actions pattern:** Action buttons are hidden until row hover:
```
opacity-0 group-hover:opacity-100 transition-opacity duration-150
```

---

## 9. Animations

### 9.1 Duration

All animations: **150ms–250ms** only. No exceptions.

### 9.2 Entry Animations (Staggered Lists)

All list items use the same Framer Motion pattern:

```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
```

Delay scales:

| Element | Delay Multiplier | Duration |
|---|---|---|
| Skeleton items | `i * 0.05` | `0.3` |
| Tool/Discover rows | `i * 0.03` | `0.25` |
| Collection cards | `i * 0.04` | `0.25` |

### 9.3 Modal Entry

**Main modals (AddTool, Auth):**
```tsx
// Overlay:
initial={{ opacity: 0 }} animate={{ opacity: 1 }}
// Panel:
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
```

**Collection modals (AddToCollection, CreateCollection):**
```tsx
// Panel:
initial={{ opacity: 0, scale: 0.96 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ duration: 0.15 }}
```

### 9.4 Transition Classes

| Class | Usage |
|---|---|
| `transition-all duration-150` | Primary buttons, interactive elements |
| `transition-colors duration-150` | Color-only changes (links, text) |
| `transition-opacity duration-150` | Fade in/out (hover actions) |
| `transition-shadow duration-200` | Card shadows on hover |
| `transition-transform duration-200` | Card lift effects |

---

## 10. Component Patterns

### 10.1 Section Header Pattern

Every page section follows:
```
┌─────────────────────────────────┐
│  text-[10px] font-mono ... LABEL│
│  ─── COUNT                      │
│  font-syne text-[40px] TITLE    │
│  text-[13px] font-mono STATS    │
└─────────────────────────────────┘
```

### 10.2 Navbar

- Height: `h-14` (56px)
- Sticky top, `z-50`
- Semi-transparent background: `bg-bg/90` with `backdropFilter: 'blur(12px)'`
- Border bottom: `border-b border-tv-border`
- Horizontal padding: `px-6`
- Logo on left, tabs center-left, actions right (ml-auto)
- Active tab: `bg-tv-text text-bg`
- Inactive tab: `text-tv-text-s hover:text-tv-text`

### 10.3 Loading State

**Skeleton base:**
```tsx
<Skeleton className="animate-pulse rounded-md bg-muted" />
```

**Card skeleton:** 200px image area + 16px padding content area
**Row skeleton:** Same row layout with animated placeholders

### 10.4 Empty State

Centered column layout:
```
max-w-3xl mx-auto px-6 pt-16 pb-24 flex flex-col items-center text-center
```

### 10.5 Category Filter

Flex-wrap row of chip buttons:
```
px-2.5 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wide border
transition-all duration-150
```
- Inactive: `border-tv-border text-tv-text-s hover:text-tv-text`
- Active: inline style with category colors (or solid dark for "All")

### 10.6 Search Bar

Compact inline input, 32px height:
```
relative flex-shrink-0
input: h-8 pl-8 pr-3 bg-s2 border border-tv-border rounded-lg text-[13px]
icon: absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m
```

---

## 11. Layering & z-index

| Layer | z-index | Elements |
|---|---|---|
| Base | auto | Page content, tool rows |
| Sticky Nav | 50 | Navbar |
| Modals | 100 | AddToolModal |
| Auth Modal | 110 | AuthModal (above tool modals) |
| Toast | Higher | Toasts, sonner |

---

## 12. Responsive Breakpoints

| Breakpoint | Class | Behavior |
|---|---|---|
| Mobile (default) | — | Single column, full-width |
| Tablet | `sm:` (640px) | 2-3 column grids visible |
| Desktop | `md:` (768px) | Category badges visible, side-by-side |
| Wide | `lg:` (1024px) | Full layout |

Standard grid for collections:
```
grid grid-cols-2 sm:grid-cols-3 gap-3
```

---

## 13. Implementation Notes

### 13.1 CSS Variable Architecture

All colors are defined as HSL CSS custom properties in `src/index.css` and accessed via Tailwind's `hsl()` function in `tailwind.config.ts`. This enables dark mode theming by swapping variable values.

**To update the color palette,** change the HSL values in `src/index.css` — no component code needs modification.

### 13.2 Current vs. Target State

The current implementation (`v0.x`) uses softer borders and shadows. The target (`v1.0`) defined above moves toward more distinct brutalist elements (thicker borders, offset shadows). Migrate gradually:

1. **New features** (collections, new pages) → use target values
2. **Existing features** (vault rows, discover cards) → use current CSS variables; update when those sections are touched

### 13.3 Key Constants File

All design constants are centralized in `src/lib/types.ts`:
- `CATEGORY_COLORS` — Category chip text colors
- `CATEGORY_BG` — Category chip background colors
- `CATEGORY_LABELS` — Full category names
- `CATEGORY_SHORT` — Abbreviated names
- `CATEGORY_EMOJIS` — Category emoji icons

---

## 14. Page Blueprints

### 14.1 Vault Page (Personal bookshelf)

```
┌─────────────────────────────────────────────┐
│  YOUR COLLECTION                            │
│  The stack.                                 │
│  12 tools · 3 favorites · last added 2d ago │
├─────────────────────────────────────────────┤
│  COLLECTIONS — 3                [+ New]     │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Card 1 │ │ Card 2 │ │ Card 3 │          │
│  └────────┘ └────────┘ └────────┘          │
├─────────────────────────────────────────────┤
│  [🔍 Search...] [All] [AI] [Dev] [Design]  │
├─────────────────────────────────────────────┤
│  FAVORITES — 2                              │
│  ┌─────────────────────────────────────────┐│
│  │ Row layout (favicon + name + actions)   ││
│  └─────────────────────────────────────────┘│
│  ALL TOOLS — 10                             │
│  ┌─────────────────────────────────────────┐│
│  │ Row layout ...                          ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 14.2 Discover Page (Tool exploration)

```
┌─────────────────────────────────────────────┐
│  DISCOVER TOOLS.                            │
│  45 tools                                   │
├─────────────────────────────────────────────┤
│  [🔍 Search...] [All] [AI] [Dev] ...       │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │ Row: [Upvote] [favicon] Name · desc ... ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ Row: ...                                ││
│  └─────────────────────────────────────────┘│
│  ...                                        │
└─────────────────────────────────────────────┘
```

### 14.3 Tool Detail Page (Tool workspace)

```
┌─────────────────────────────────────────────┐
│  ← Back            [Copy URL] [Visit]       │
├─────────────────────────────────────────────┤
│  ┌──┐                                       │
│  │🖼│ Name [CATEGORY]              [★]     │
│  └──┘ domain · Added 2d ago · Visited 1h ago│
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │ Screenshot / OG image                   ││
│  └─────────────────────────────────────────┘│
│  Summary/description text                   │
├─────────────────────────────────────────────┤
│  TAGS                                       │
│  [tag1 ×] [tag2 ×] [+ add tag]             │
├─────────────────────────────────────────────┤
│  SAVED IN                     [Add to Col]  │
│  [📁 Collection A] [📁 Collection B]       │
├─────────────────────────────────────────────┤
│  NOTES                                      │
│  ┌─────────────────────────────────────────┐│
│  │ Textarea...                             ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  ASK ABOUT [TOOL NAME]                      │
│  ┌─────────────────────────────────────────┐│
│  │ Chat messages...                        ││
│  ├─────────────────────────────────────────┤│
│  │ [Input...                        [Send] ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 14.4 Collection Page (Collection detail)

```
┌─────────────────────────────────────────────┐
│  ← Back                         [✏️] [🗑]  │
├─────────────────────────────────────────────┤
│  Collection Name                             │
│  Description text if provided                │
│  5 tools · updated 2d ago                   │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │ Row: [favicon] Name [CAT]     [★] [↗] ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ Row: ...                                ││
│  └─────────────────────────────────────────┘│
│  ...                                        │
└─────────────────────────────────────────────┘
```

---

## 15. Shadow Audit: Current vs Target

| Shadow | Current (v0.x) | Target (v1.0) | Notes |
|---|---|---|---|
| `shadow-soft` | Subtle multi-layer | Keep as-is | OK for subtle elevation |
| `shadow-card` | Minimal shadow | Keep as-is | OK for modals |
| `shadow-glow` | Green glow | Keep as-is | OK for primary hover |
| `shadow-brutal` | **Missing** | `6px 6px 0 #111` | Add for collection cards |
| `shadow-brutal-hover` | **Missing** | `10px 10px 0 #111` | Add for card hover |

---

## 16. Quick Reference: Common Class Strings

**Page container:** `max-w-3xl mx-auto`
**Page section separator:** `border-b border-tv-border`
**Section label:** `text-[10px] font-mono text-tv-text-m uppercase tracking-widest`
**Page heading (hero):** `font-syne text-[40px] text-tv-text leading-tight`
**Page heading (detail):** `font-syne text-[28px] text-tv-text leading-tight`
**Brand emphasis:** `not-italic text-tv-primary`
**Stat/meta text:** `text-[13px] text-tv-text-s font-mono`
**Stat separator:** `text-tv-border` (middot `·`)
**Input base:** `bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-all duration-150`
**Primary button:** `bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors`
**Category badge:** `px-2 py-0.5 rounded text-[11px] font-mono font-medium flex-shrink-0` (inline style for color/bg)
