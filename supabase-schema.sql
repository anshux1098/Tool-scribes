-- ============================================================
-- ToolScribe — Supabase Schema
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── tools ──────────────────────────────────────────────────
-- Shared pool of all tools (Discover feed)
create table if not exists tools (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  url         text not null,
  description text not null default '',
  category    text not null check (category in ('ai','dev','design','prod','learn','util')),
  icon        text not null default '🔧',
  favicon     text not null default '',
  og_image    text not null default '',
  upvotes     int  not null default 0,
  added_by    uuid references auth.users(id) on delete set null
);

alter table tools enable row level security;

-- Anyone can read tools
create policy "tools: public read"
  on tools for select using (true);

-- Authenticated users can insert
create policy "tools: auth insert"
  on tools for insert
  with check (auth.uid() is not null);

-- Only the creator can update/delete their own tool
create policy "tools: owner update"
  on tools for update
  using (added_by = auth.uid());

create policy "tools: owner delete"
  on tools for delete
  using (added_by = auth.uid());

-- ─── vault_items ────────────────────────────────────────────
-- Per-user saved tools with personal metadata
create table if not exists vault_items (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tool_id      uuid not null references tools(id) on delete cascade,
  is_favorite  boolean not null default false,
  notes        text not null default '',
  tags         text[] not null default '{}',
  last_visited timestamptz,
  unique (user_id, tool_id)
);

alter table vault_items enable row level security;

-- Users can only see/edit their own vault
create policy "vault: owner all"
  on vault_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── upvotes ────────────────────────────────────────────────
-- One row per user per tool
create table if not exists upvotes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool_id    uuid not null references tools(id) on delete cascade,
  unique (user_id, tool_id)
);

alter table upvotes enable row level security;

create policy "upvotes: owner all"
  on upvotes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Public can read upvotes (needed to count them)
create policy "upvotes: public read"
  on upvotes for select using (true);

-- ─── increment_upvote function ───────────────────────────────
-- Atomically increment/decrement tools.upvotes
create or replace function increment_upvote(tool_id uuid, delta int)
returns void language sql security definer as $$
  update tools set upvotes = upvotes + delta where id = tool_id;
$$;

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists tools_category_idx on tools(category);
create index if not exists tools_upvotes_idx  on tools(upvotes desc);
create index if not exists vault_user_idx     on vault_items(user_id);
create index if not exists upvotes_tool_idx   on upvotes(tool_id);
