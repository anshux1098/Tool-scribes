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
  screenshot_url text not null default '',
  upvotes     int  not null default 0,
  price_model text not null default 'free' check (price_model in ('free','freemium','paid')),
  is_open_source boolean not null default false,
  requires_login boolean not null default false,
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
  visit_count  int not null default 0,
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

-- ─── collections ──────────────────────────────────────────────
-- Named collections for organizing vault tools
create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text not null default '',
  is_public   boolean not null default false
);

alter table collections enable row level security;

create policy "collections: owner all"
  on collections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anyone can read public collections
create policy "collections: public read"
  on collections for select
  using (is_public = true);

-- ─── collection_tools ─────────────────────────────────────────
-- Junction: a tool can belong to many collections, a collection can have many tools
create table if not exists collection_tools (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  collection_id uuid not null references collections(id) on delete cascade,
  tool_id       uuid not null references tools(id) on delete cascade,
  unique (collection_id, tool_id)
);

alter table collection_tools enable row level security;

create policy "collection_tools: owner all"
  on collection_tools for all
  using (
    exists (
      select 1 from collections
      where collections.id = collection_tools.collection_id
        and collections.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from collections
      where collections.id = collection_tools.collection_id
        and collections.user_id = auth.uid()
    )
  );

-- Anyone can read collection_tools for public collections
create policy "collection_tools: public read"
  on collection_tools for select
  using (
    exists (
      select 1 from collections
      where collections.id = collection_tools.collection_id
        and collections.is_public = true
    )
  );

-- ─── collection_followers ─────────────────────────────────────
-- Users can follow public collections to get updates
create table if not exists collection_followers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  unique (user_id, collection_id)
);

alter table collection_followers enable row level security;

-- Users manage their own follows
create policy "cf: owner insert"
  on collection_followers for insert
  with check (user_id = auth.uid());

create policy "cf: owner delete"
  on collection_followers for delete
  using (user_id = auth.uid());

-- Anyone can read follower counts (for public display)
create policy "cf: public read"
  on collection_followers for select
  using (true);

-- ─── get_creator_email function ───────────────────────────────
-- Exposes creator email for public collections (security definer bypasses RLS)
create or replace function get_creator_email(collection_id uuid)
returns text language sql security definer stable as $$
  select email from auth.users
  where id = (select user_id from collections where collections.id = collection_id);
$$;

-- ─── clone_public_collection function ─────────────────────────
-- Clones a public collection into the requesting user's vault
create or replace function clone_public_collection(
  source_collection_id uuid,
  target_user_id uuid
) returns uuid language plpgsql security definer as $$
declare
  new_collection_id uuid;
begin
  -- Verify the source collection is public
  if not exists (select 1 from collections where id = source_collection_id and is_public = true) then
    raise exception 'Collection not found or is not public';
  end if;

  -- Create new collection
  insert into collections (user_id, name, description, is_public)
  select target_user_id, name || ' (copy)', description, false
  from collections
  where id = source_collection_id
  returning id into new_collection_id;

  -- Copy all tools
  insert into collection_tools (collection_id, tool_id)
  select new_collection_id, tool_id
  from collection_tools
  where collection_id = source_collection_id;

  return new_collection_id;
end;
$$;

-- ─── increment_upvote function ───────────────────────────────
-- Atomically increment/decrement tools.upvotes
create or replace function increment_upvote(tool_id uuid, delta int)
returns void language sql security definer as $$
  update tools set upvotes = upvotes + delta where id = tool_id;
$$;

-- ─── dust_items ───────────────────────────────────────────────
-- Tracks stale tools (saved > 30d, visit_count = 0) for rediscovery
create table if not exists dust_items (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool_id    uuid not null references tools(id) on delete cascade,
  status     text not null default 'stale' check (status in ('stale','dismissed')),
  unique(user_id, tool_id)
);

alter table dust_items enable row level security;
create policy "dust: owner all" on dust_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── tool_health ────────────────────────────────────────────
-- Stores health check results for each tool (separate table to avoid altering tools)
create table if not exists tool_health (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  tool_id           uuid not null,
  status            text not null default 'unknown'
                    check (status in ('active','warning','sunset','archived','unknown')),
  last_health_check timestamptz,
  response_time_ms  int,
  ssl_valid         boolean,
  http_status       int,
  error_message     text not null default '',
  uptime_pct        numeric(5,2) default 100.00,
  unique(tool_id)
);

alter table tool_health enable row level security;
create policy "th: public read" on tool_health for select using (true);
create policy "th: admin all" on tool_health for all using (is_admin()) with check (is_admin());

-- ─── health_check_log ───────────────────────────────────────
-- Audit trail for every health check
create table if not exists health_check_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  tool_id           uuid not null,
  status            text not null,
  response_time_ms  int,
  http_status       int,
  error_message     text not null default '',
  checked_by        uuid references auth.users(id) on delete set null
);

alter table health_check_log enable row level security;
create policy "hcl: public read" on health_check_log for select using (true);
create policy "hcl: admin all" on health_check_log for all using (is_admin()) with check (is_admin());

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists tools_category_idx on tools(category);
create index if not exists tools_upvotes_idx  on tools(upvotes desc);
create index if not exists vault_user_idx     on vault_items(user_id);
create index if not exists upvotes_tool_idx     on upvotes(tool_id);
create index if not exists collections_user_idx on collections(user_id);
create index if not exists ct_collection_idx    on collection_tools(collection_id);
create index if not exists ct_tool_idx          on collection_tools(tool_id);
create index if not exists cf_user_idx          on collection_followers(user_id);
create index if not exists cf_collection_idx    on collection_followers(collection_id);
create index if not exists dust_user_idx        on dust_items(user_id);
create index if not exists th_tool_idx           on tool_health(tool_id);
create index if not exists th_status_idx         on tool_health(status);
create index if not exists hcl_tool_idx          on health_check_log(tool_id);
create index if not exists hcl_created_idx       on health_check_log(created_at desc);

-- ─── user_roles ─────────────────────────────────────────────────
-- Admin/Moderator roles (must be inserted manually via SQL)
-- To create the first admin, run in Supabase SQL Editor:
--   insert into public.user_roles (user_id, role)
--   values ('REPLACE_WITH_AUTH_USER_UUID', 'admin');
-- There is NO automatic bootstrap — the first admin must be created manually.
-- Once the first admin exists, they can assign additional admins/moderators.
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','moderator')),
  unique (user_id, role)
);

alter table user_roles enable row level security;

-- Only the user themselves can see their own roles
create policy "user_roles: owner read"
  on user_roles for select
  using (user_id = auth.uid());

-- ─── is_admin function ─────────────────────────────────────────
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ─── tool_submissions ──────────────────────────────────────────
-- Community submissions go through review before being added to tools
create table if not exists tool_submissions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected')),
  url               text not null,
  normalized_domain text not null default '',
  title             text not null default '',
  description       text not null default '',
  category          text not null default 'util'
                      check (category in ('ai','dev','design','prod','learn','util')),
  icon              text not null default '🔧',
  favicon           text not null default '',
  og_image          text not null default '',
  screenshot_url    text not null default '',
  submitted_by      uuid references auth.users(id) on delete set null,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text not null default '',
  matched_tool_id   uuid
);

alter table tool_submissions enable row level security;

-- Anyone authenticated can insert a submission
create policy "submissions: auth insert"
  on tool_submissions for insert
  with check (auth.uid() is not null);

-- Users can see their own submissions
create policy "submissions: owner read"
  on tool_submissions for select
  using (submitted_by = auth.uid());

-- Admins can see/update all submissions
create policy "submissions: admin select"
  on tool_submissions for select
  using (is_moderator());

create policy "submissions: admin update"
  on tool_submissions for update
  using (is_moderator())
  with check (is_moderator());

-- ─── Indexes for submissions ───────────────────────────────────
create index if not exists submissions_status_idx     on tool_submissions(status);
create index if not exists submissions_submitted_idx  on tool_submissions(submitted_by);
create index if not exists submissions_domain_idx     on tool_submissions(normalized_domain);

-- ─── profiles ───────────────────────────────────────────────
-- One profile per auth user, created on signup via trigger
create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade unique,
  username        text unique,
  display_name    text not null default '',
  bio             text not null default '',
  public_profile  boolean not null default false,
  reputation_score int not null default 0
);

alter table profiles enable row level security;
create policy "profiles: public read" on profiles for select using (public_profile = true OR user_id = auth.uid());
create policy "profiles: self insert" on profiles for insert with check (user_id = auth.uid());
create policy "profiles: self update" on profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── follows ─────────────────────────────────────────────────
create table if not exists follows (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  follower_id   uuid not null references auth.users(id) on delete cascade,
  following_id  uuid not null references auth.users(id) on delete cascade,
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;
create policy "follows: self insert" on follows for insert with check (follower_id = auth.uid());
create policy "follows: self delete" on follows for delete using (follower_id = auth.uid());
create policy "follows: public read" on follows for select using (true);

-- ─── Auto-create profile on signup ─────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure handle_new_user();

-- ─── Indexes for profiles & follows ──────────────────────────
create unique index if not exists profiles_username_idx on profiles(username) where username is not null;
create index if not exists follows_follower_idx on follows(follower_id);
create index if not exists follows_following_idx on follows(following_id);

-- ─── reviews ────────────────────────────────────────────────
-- One structured review per user per tool
create table if not exists reviews (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tool_id           uuid not null,
  best_for          text not null default '',
  gotcha            text not null default '',
  free_tier         text not null default '',
  is_flagged        boolean not null default false,
  flagged_reason    text not null default '',
  moderation_status text not null default 'active'
                    check (moderation_status in ('active','hidden','removed')),
  moderated_at      timestamptz,
  moderated_by      uuid references auth.users(id) on delete set null,
  unique (user_id, tool_id)
);

alter table reviews enable row level security;
create policy "reviews: public read active" on reviews for select using (moderation_status = 'active');
create policy "reviews: owner read all" on reviews for select using (user_id = auth.uid());
create policy "reviews: self insert" on reviews for insert with check (user_id = auth.uid());
create policy "reviews: self update" on reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: self delete" on reviews for delete using (user_id = auth.uid());
create policy "reviews: admin select all" on reviews for select using (is_admin());
create policy "reviews: admin update" on reviews for update using (is_admin()) with check (is_admin());

create index if not exists reviews_tool_idx        on reviews(tool_id);
create index if not exists reviews_user_idx        on reviews(user_id);
create index if not exists reviews_mod_status_idx  on reviews(moderation_status);

-- ─── calculate_reputation ─────────────────────────────────
-- Scoring: approved_submissions * 10 + active_reviews * 5 + followers * 1
create or replace function calculate_reputation(target_user_id uuid)
returns int language plpgsql security definer as $$
declare
  approved_subs int; active_reviews int; follower_count int; total int;
begin
  select count(*)::int into approved_subs from tool_submissions where submitted_by = target_user_id and status = 'approved';
  select count(*)::int into active_reviews from reviews where user_id = target_user_id and moderation_status = 'active';
  select count(*)::int into follower_count from follows where following_id = target_user_id;
  total := approved_subs * 10 + active_reviews * 5 + follower_count * 1;
  update profiles set reputation_score = total, updated_at = now() where user_id = target_user_id;
  return total;
end;
$$;

-- ─── tags ────────────────────────────────────────────────────
-- Community tag ecosystem: admin-approved tags, tool-tag mapping, user subscriptions

create table if not exists tags (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text not null,
  slug              text not null unique,
  description       text not null default '',
  color             text not null default '#6B7280',
  status            text not null default 'pending',
  submitted_by      uuid references auth.users(id) on delete set null,
  moderated_by      uuid references auth.users(id) on delete set null,
  moderated_at      timestamptz,
  tool_count        int not null default 0,
  subscriber_count  int not null default 0,
  constraint tags_status_check check (status in ('pending','approved','rejected'))
);

create index if not exists idx_tags_slug   on tags(slug);
create index if not exists idx_tags_status on tags(status);

alter table tags enable row level security;

-- Tags: visible to all if approved; admins see all
create policy "tags: select approved for all"       on tags for select using (status = 'approved' or is_admin());
create policy "tags: insert authenticated"          on tags for insert with check (auth.role() = 'authenticated');
create policy "tags: admin update"                  on tags for update using (is_admin()) with check (is_admin());

create table if not exists tool_tags (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tool_id    uuid not null,
  tag_id     uuid not null references tags(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  unique (tool_id, tag_id)
);

create index if not exists idx_tool_tags_tool on tool_tags(tool_id);
create index if not exists idx_tool_tags_tag  on tool_tags(tag_id);

alter table tool_tags enable row level security;

create policy "tool_tags: select all"       on tool_tags for select using (true);
create policy "tool_tags: admin insert"     on tool_tags for insert with check (is_admin());
create policy "tool_tags: admin delete"     on tool_tags for delete using (is_admin());

create table if not exists tag_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  unique (user_id, tag_id)
);

create index if not exists idx_ts_user on tag_subscriptions(user_id);
create index if not exists idx_ts_tag  on tag_subscriptions(tag_id);

alter table tag_subscriptions enable row level security;

create policy "ts: user manage own" on tag_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ts: admin select all" on tag_subscriptions for select using (is_admin());

-- ─── is_moderator function ──────────────────────────────────────
create or replace function is_moderator()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('admin', 'moderator')
  );
$$;

-- ─── Missing RLS: curator_follows update ─────────────────
drop policy if exists "cf: owner update" on curator_follows;
create policy "cf: owner update" on curator_follows for update using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- ─── Missing RLS: reputation_scores ─────────────────────
alter table if exists reputation_scores enable row level security;
drop policy if exists "rep: public read" on reputation_scores;
create policy "rep: public read" on reputation_scores for select using (true);
drop policy if exists "rep: self update" on reputation_scores;
create policy "rep: self update" on reputation_scores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "rep: admin all" on reputation_scores;
create policy "rep: admin all" on reputation_scores for all using (is_admin()) with check (is_admin());
drop policy if exists "rep: insert trigger" on reputation_scores;
create policy "rep: insert trigger" on reputation_scores for insert with check (true);

-- ─── Missing RLS: profiles admin select ─────────────────
drop policy if exists "profiles: admin select all" on profiles;
create policy "profiles: admin select all" on profiles for select using (is_admin());

-- ─── Missing RLS: user_roles admin manage ───────────────
drop policy if exists "user_roles: admin all" on user_roles;
create policy "user_roles: admin all" on user_roles for all using (is_admin()) with check (is_admin());

-- ─── Missing RLS: tools/admin ───────────────────────────
drop policy if exists "tools: admin all" on tools;
create policy "tools: admin all" on tools for all using (is_admin()) with check (is_admin());

-- ─── get_submitter_email ────────────────────────────────
create or replace function get_submitter_email(submission_id uuid)
returns text language sql security definer stable as $$
  select email from auth.users
  where id = (select submitted_by from tool_submissions where tool_submissions.id = submission_id);
$$;

-- ─── get_submissions_for_review ─────────────────────────
create or replace function get_submissions_for_review()
returns table(
  id uuid, created_at timestamptz, updated_at timestamptz, status text,
  url text, normalized_domain text, title text, description text,
  category text, icon text, favicon text, og_image text,
  screenshot_url text,
  submitted_by uuid, reviewed_by uuid, reviewed_at timestamptz,
  rejection_reason text, matched_tool_id uuid,
  submitter_email text
) language plpgsql security definer as $$
begin
  if not exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin', 'moderator')) then
    raise exception 'Not authorized';
  end if;
  return query
    select
      s.id, s.created_at, s.updated_at, s.status,
      s.url, s.normalized_domain, s.title, s.description,
      s.category, s.icon, s.favicon, s.og_image,
      s.screenshot_url,
      s.submitted_by, s.reviewed_by, s.reviewed_at,
      s.rejection_reason, s.matched_tool_id,
      u.email::text
    from tool_submissions s
    left join auth.users u on u.id = s.submitted_by
    order by s.created_at desc;
end;
$$;
