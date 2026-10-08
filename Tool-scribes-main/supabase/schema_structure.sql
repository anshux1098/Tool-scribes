-- ============================================================================
-- ToolScribe — GENERATED SCHEMA SNAPSHOT
-- ============================================================================
-- !!! DO NOT HAND-EDIT THIS FILE !!!
--
-- This file is a generated REFERENCE snapshot of the live Supabase database
-- (project ref: qglvwvpsegrucrhcpzxd). It exists so the repository stops
-- misrepresenting the schema — the previous hand-written supabase-schema.sql had
-- drifted badly (it was missing profile columns, collection columns, tools
-- feature columns and 4 entire tables).
--
-- SOURCE OF TRUTH
--   The live database is canonical. This file is derived from it.
--
-- HOW IT WAS GENERATED
--   Read-only catalog queries against the live project:
--     pg_class / pg_attribute / pg_attrdef  -> tables + columns + defaults
--     pg_constraint                         -> keys, FKs, checks
--     pg_indexes / pg_index                 -> indexes
--     pg_policies                           -> RLS policies
--     pg_trigger                            -> triggers
--     storage.buckets                       -> storage buckets
--   Routine (function) definitions live in ./functions.sql
--
-- IMPORTANT LIMITATION
--   This is a REFERENCE, not an executable bootstrap. It is not guaranteed to
--   replay cleanly in dependency order, and the "auth" schema, roles and grants
--   are managed by Supabase. To recreate an environment locally you would need
--   `supabase db pull` (see README) rather than running this file.
--
-- Captured: 2026-09-18, 26 tables, 81 RLS policies, 39 indexes, 3 triggers.
-- ============================================================================

-- ─── SECTION 1: CUSTOM TYPES ────────────────────────────────────────────────

CREATE TYPE public.device_request_status AS ENUM ('pending', 'approved', 'rejected');

-- ─── SECTION 2: TABLES ──────────────────────────────────────────────────────

CREATE TABLE public.alternative_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alternative_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.collection_followers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  collection_id uuid NOT NULL
);

CREATE TABLE public.collection_tools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  collection_id uuid NOT NULL,
  tool_id uuid NOT NULL
);

CREATE TABLE public.collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  is_public boolean NOT NULL DEFAULT false,
  cover_image_url text NOT NULL DEFAULT ''::text,
  featured boolean NOT NULL DEFAULT false,
  clone_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0
);

CREATE TABLE public.curator_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  follower_id uuid NOT NULL,
  curator_id uuid NOT NULL
);

CREATE TABLE public.curator_shelf (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL,
  tool_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE public.device_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text,
  status device_request_status DEFAULT 'pending'::device_request_status,
  requested_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.dust_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  tool_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'stale'::text
);

CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL
);

CREATE TABLE public.health_check_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tool_id uuid NOT NULL,
  status text NOT NULL,
  response_time_ms integer,
  http_status integer,
  error_message text NOT NULL DEFAULT ''::text,
  checked_by uuid
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT ''::text,
  actor_username text NOT NULL DEFAULT ''::text,
  actor_avatar_url text NOT NULL DEFAULT ''::text,
  target_id text NOT NULL DEFAULT ''::text,
  target_name text NOT NULL DEFAULT ''::text,
  target_type text NOT NULL DEFAULT ''::text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  username text,
  display_name text NOT NULL DEFAULT ''::text,
  bio text NOT NULL DEFAULT ''::text,
  public_profile boolean NOT NULL DEFAULT false,
  reputation_score integer NOT NULL DEFAULT 0,
  tagline text NOT NULL DEFAULT ''::text,
  location text NOT NULL DEFAULT ''::text,
  website text NOT NULL DEFAULT ''::text,
  github text NOT NULL DEFAULT ''::text,
  twitter text NOT NULL DEFAULT ''::text,
  linkedin text NOT NULL DEFAULT ''::text,
  avatar_url text NOT NULL DEFAULT ''::text,
  banner_url text NOT NULL DEFAULT ''::text,
  featured_collection_id uuid,
  curator_badge text NOT NULL DEFAULT 'none'::text,
  show_reviews boolean NOT NULL DEFAULT true,
  show_collections boolean NOT NULL DEFAULT true,
  show_followers boolean NOT NULL DEFAULT true,
  signature_quote text DEFAULT ''::text,
  contact_url text DEFAULT ''::text,
  last_seen_notifications_at timestamp with time zone
);

CREATE TABLE public.reputation_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  tools_submitted integer NOT NULL DEFAULT 0,
  tools_approved integer NOT NULL DEFAULT 0,
  upvotes_received integer NOT NULL DEFAULT 0,
  reviews_written integer NOT NULL DEFAULT 0,
  followers_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  tool_id uuid NOT NULL,
  best_for text NOT NULL DEFAULT ''::text,
  gotcha text NOT NULL DEFAULT ''::text,
  free_tier text NOT NULL DEFAULT ''::text,
  is_flagged boolean NOT NULL DEFAULT false,
  flagged_reason text NOT NULL DEFAULT ''::text,
  moderation_status text NOT NULL DEFAULT 'active'::text,
  moderated_at timestamp with time zone,
  moderated_by uuid,
  rating integer NOT NULL DEFAULT 4
);

CREATE TABLE public.tag_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  tag_id uuid NOT NULL
);

CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  color text NOT NULL DEFAULT '#6B7280'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  submitted_by uuid,
  tool_count integer NOT NULL DEFAULT 0,
  subscriber_count integer NOT NULL DEFAULT 0
);

CREATE TABLE public.tool_alternatives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL,
  alternative_tool_id uuid NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tool_health (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tool_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'unknown'::text,
  last_health_check timestamp with time zone,
  response_time_ms integer,
  ssl_valid boolean,
  http_status integer,
  error_message text NOT NULL DEFAULT ''::text,
  uptime_pct numeric(5,2) DEFAULT 100.00
);

CREATE TABLE public.tool_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  url text NOT NULL,
  normalized_domain text NOT NULL DEFAULT ''::text,
  title text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  category text NOT NULL DEFAULT 'util'::text,
  icon text NOT NULL DEFAULT '🔧'::text,
  favicon text NOT NULL DEFAULT ''::text,
  og_image text NOT NULL DEFAULT ''::text,
  submitted_by uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text NOT NULL DEFAULT ''::text,
  matched_tool_id uuid,
  screenshot_url text NOT NULL DEFAULT ''::text,
  is_free boolean NOT NULL DEFAULT true,
  platforms text[] NOT NULL DEFAULT '{web}'::text[],
  signup_required boolean NOT NULL DEFAULT false,
  ai_summary text,
  best_for text[],
  strengths text[],
  limitations text[],
  pricing_notes text,
  learning_curve text,
  beginner_friendly boolean,
  ai_profile_generated_at timestamp with time zone,
  ai_profile_version integer DEFAULT 1
);

CREATE TABLE public.tool_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tool_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  added_by uuid
);

CREATE TABLE public.tools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  category text NOT NULL DEFAULT 'util'::text,
  icon text NOT NULL DEFAULT '🔧'::text,
  favicon text NOT NULL DEFAULT ''::text,
  og_image text NOT NULL DEFAULT ''::text,
  upvotes integer NOT NULL DEFAULT 0,
  price_model text NOT NULL DEFAULT 'free'::text,
  is_open_source boolean NOT NULL DEFAULT false,
  requires_login boolean NOT NULL DEFAULT false,
  added_by uuid,
  screenshot_url text NOT NULL DEFAULT ''::text,
  is_free boolean NOT NULL DEFAULT true,
  platforms text[] NOT NULL DEFAULT '{web}'::text[],
  signup_required boolean NOT NULL DEFAULT false,
  ai_summary text,
  best_for text[],
  strengths text[],
  limitations text[],
  pricing_notes text,
  learning_curve text,
  beginner_friendly boolean,
  ai_profile_generated_at timestamp with time zone,
  ai_profile_version integer DEFAULT 1
);

CREATE TABLE public.upvotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  tool_id uuid NOT NULL
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  role text NOT NULL
);

-- LEGACY: custom user table, superseded by auth.users. No application code
-- references it (only the dead `vaults` table FKs into it). Candidate for
-- removal — it holds master_password_verifier and salt columns.
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  master_password_verifier text NOT NULL,
  salt text NOT NULL,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.vault_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  tool_id uuid NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT ''::text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  last_visited timestamp with time zone,
  visit_count integer NOT NULL DEFAULT 0
);

CREATE TABLE public.vaults (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  encrypted_blob text,
  iv text,
  updated_at timestamp without time zone DEFAULT now()
);

-- ─── SECTION 3: KEYS, FOREIGN KEYS AND CHECK CONSTRAINTS ────────────────────

ALTER TABLE public.alternative_votes ADD CONSTRAINT alternative_votes_pkey PRIMARY KEY (id);
ALTER TABLE public.alternative_votes ADD CONSTRAINT alternative_votes_alternative_id_user_id_key UNIQUE (alternative_id, user_id);
ALTER TABLE public.alternative_votes ADD CONSTRAINT alternative_votes_alternative_id_fkey FOREIGN KEY (alternative_id) REFERENCES tool_alternatives(id) ON DELETE CASCADE;
ALTER TABLE public.alternative_votes ADD CONSTRAINT alternative_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.collection_followers ADD CONSTRAINT collection_followers_pkey PRIMARY KEY (id);
ALTER TABLE public.collection_followers ADD CONSTRAINT collection_followers_user_id_collection_id_key UNIQUE (user_id, collection_id);
ALTER TABLE public.collection_followers ADD CONSTRAINT collection_followers_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE public.collection_followers ADD CONSTRAINT collection_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.collection_tools ADD CONSTRAINT collection_tools_pkey PRIMARY KEY (id);
ALTER TABLE public.collection_tools ADD CONSTRAINT collection_tools_collection_id_tool_id_key UNIQUE (collection_id, tool_id);
ALTER TABLE public.collection_tools ADD CONSTRAINT collection_tools_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE public.collection_tools ADD CONSTRAINT collection_tools_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE public.collections ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
ALTER TABLE public.collections ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.curator_follows ADD CONSTRAINT curator_follows_pkey PRIMARY KEY (id);
ALTER TABLE public.curator_follows ADD CONSTRAINT curator_follows_follower_id_curator_id_key UNIQUE (follower_id, curator_id);
ALTER TABLE public.curator_follows ADD CONSTRAINT curator_follows_curator_id_fkey FOREIGN KEY (curator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.curator_follows ADD CONSTRAINT curator_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.curator_shelf ADD CONSTRAINT curator_shelf_pkey PRIMARY KEY (id);
ALTER TABLE public.curator_shelf ADD CONSTRAINT curator_shelf_user_tool_unique UNIQUE (user_id, tool_id);
ALTER TABLE public.curator_shelf ADD CONSTRAINT curator_shelf_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id);
ALTER TABLE public.curator_shelf ADD CONSTRAINT curator_shelf_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_user_id_device_id_key UNIQUE (user_id, device_id);
ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public.dust_items ADD CONSTRAINT dust_items_pkey PRIMARY KEY (id);
ALTER TABLE public.dust_items ADD CONSTRAINT dust_items_user_id_tool_id_key UNIQUE (user_id, tool_id);
ALTER TABLE public.dust_items ADD CONSTRAINT dust_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.dust_items ADD CONSTRAINT dust_items_status_check CHECK ((status = ANY (ARRAY['stale'::text, 'archived'::text, 'dismissed'::text])));

ALTER TABLE public.follows ADD CONSTRAINT follows_pkey PRIMARY KEY (id);
ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_following_id_key UNIQUE (follower_id, following_id);
ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_check CHECK ((follower_id <> following_id));

ALTER TABLE public.health_check_log ADD CONSTRAINT health_check_log_pkey PRIMARY KEY (id);
ALTER TABLE public.health_check_log ADD CONSTRAINT health_check_log_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
ALTER TABLE public.health_check_log ADD CONSTRAINT health_check_log_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['new_tool'::text, 'new_collection'::text, 'collection_updated'::text, 'new_review'::text, 'new_follower'::text, 'tool_approved'::text, 'collection_followed'::text])));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_featured_collection_id_fkey FOREIGN KEY (featured_collection_id) REFERENCES collections(id) ON DELETE SET NULL;

ALTER TABLE public.reputation_scores ADD CONSTRAINT reputation_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.reputation_scores ADD CONSTRAINT reputation_scores_user_id_key UNIQUE (user_id);
ALTER TABLE public.reputation_scores ADD CONSTRAINT reputation_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_tool_id_key UNIQUE (user_id, tool_id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_moderation_status_check CHECK ((moderation_status = ANY (ARRAY['active'::text, 'hidden'::text, 'removed'::text])));
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));

ALTER TABLE public.tag_subscriptions ADD CONSTRAINT tag_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.tags ADD CONSTRAINT tags_pkey PRIMARY KEY (id);
ALTER TABLE public.tags ADD CONSTRAINT tags_slug_key UNIQUE (slug);

ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_pkey PRIMARY KEY (id);
ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_tool_id_alternative_tool_id_key UNIQUE (tool_id, alternative_tool_id);
ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_alternative_tool_id_fkey FOREIGN KEY (alternative_tool_id) REFERENCES tools(id) ON DELETE CASCADE;
ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tool_alternatives ADD CONSTRAINT tool_alternatives_check CHECK ((tool_id <> alternative_tool_id));

ALTER TABLE public.tool_health ADD CONSTRAINT tool_health_pkey PRIMARY KEY (id);
ALTER TABLE public.tool_health ADD CONSTRAINT tool_health_tool_id_key UNIQUE (tool_id);
ALTER TABLE public.tool_health ADD CONSTRAINT tool_health_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
ALTER TABLE public.tool_health ADD CONSTRAINT tool_health_status_check CHECK ((status = ANY (ARRAY['active'::text, 'warning'::text, 'sunset'::text, 'archived'::text, 'unknown'::text])));

ALTER TABLE public.tool_submissions ADD CONSTRAINT tool_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.tool_submissions ADD CONSTRAINT tool_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tool_submissions ADD CONSTRAINT tool_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tool_submissions ADD CONSTRAINT tool_submissions_category_check CHECK ((category = ANY (ARRAY['ai'::text, 'dev'::text, 'design'::text, 'prod'::text, 'learn'::text, 'util'::text])));
ALTER TABLE public.tool_submissions ADD CONSTRAINT tool_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE public.tool_tags ADD CONSTRAINT tool_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.tool_tags ADD CONSTRAINT tool_tags_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE public.tools ADD CONSTRAINT tools_pkey PRIMARY KEY (id);
ALTER TABLE public.tools ADD CONSTRAINT tools_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tools ADD CONSTRAINT tools_category_check CHECK ((category = ANY (ARRAY['ai'::text, 'dev'::text, 'design'::text, 'prod'::text, 'learn'::text, 'util'::text])));
ALTER TABLE public.tools ADD CONSTRAINT tools_price_model_check CHECK ((price_model = ANY (ARRAY['free'::text, 'freemium'::text, 'paid'::text])));

ALTER TABLE public.upvotes ADD CONSTRAINT upvotes_pkey PRIMARY KEY (id);
ALTER TABLE public.upvotes ADD CONSTRAINT upvotes_user_id_tool_id_key UNIQUE (user_id, tool_id);
ALTER TABLE public.upvotes ADD CONSTRAINT upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.upvotes ADD CONSTRAINT upvotes_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'moderator'::text])));

ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_pkey PRIMARY KEY (id);
ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_user_id_tool_id_key UNIQUE (user_id, tool_id);
ALTER TABLE public.vault_items ADD CONSTRAINT vault_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vaults ADD CONSTRAINT vaults_pkey PRIMARY KEY (id);
ALTER TABLE public.vaults ADD CONSTRAINT vaults_user_id_key UNIQUE (user_id);
ALTER TABLE public.vaults ADD CONSTRAINT vaults_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ─── SECTION 4: INDEXES ─────────────────────────────────────────────────────

CREATE INDEX cf_collection_idx ON public.collection_followers USING btree (collection_id);
CREATE INDEX cf_user_idx ON public.collection_followers USING btree (user_id);
CREATE INDEX ct_collection_idx ON public.collection_tools USING btree (collection_id);
CREATE INDEX ct_tool_idx ON public.collection_tools USING btree (tool_id);
CREATE INDEX collections_user_idx ON public.collections USING btree (user_id);
CREATE INDEX collections_featured_idx ON public.collections USING btree (featured) WHERE (featured = true);
CREATE INDEX curator_follows_curator_idx ON public.curator_follows USING btree (curator_id);
CREATE INDEX curator_follows_follower_idx ON public.curator_follows USING btree (follower_id);
CREATE INDEX dust_user_idx ON public.dust_items USING btree (user_id);
CREATE INDEX follows_follower_idx ON public.follows USING btree (follower_id);
CREATE INDEX follows_following_idx ON public.follows USING btree (following_id);
CREATE INDEX hcl_created_idx ON public.health_check_log USING btree (created_at DESC);
CREATE INDEX hcl_tool_idx ON public.health_check_log USING btree (tool_id);
CREATE INDEX idx_alternative_votes_alt_id ON public.alternative_votes USING btree (alternative_id);
CREATE INDEX idx_tool_alternatives_alt_id ON public.tool_alternatives USING btree (alternative_tool_id);
CREATE INDEX idx_tool_alternatives_approved ON public.tool_alternatives USING btree (approved);
CREATE INDEX idx_tool_alternatives_tool_id ON public.tool_alternatives USING btree (tool_id);
CREATE INDEX idx_tool_tags_tag ON public.tool_tags USING btree (tag_id);
CREATE INDEX idx_tool_tags_tool ON public.tool_tags USING btree (tool_id);
CREATE INDEX idx_tags_slug ON public.tags USING btree (slug);
CREATE INDEX idx_tags_status ON public.tags USING btree (status);
CREATE INDEX idx_ts_tag ON public.tag_subscriptions USING btree (tag_id);
CREATE INDEX idx_ts_user ON public.tag_subscriptions USING btree (user_id);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX reviews_mod_status_idx ON public.reviews USING btree (moderation_status);
CREATE INDEX reviews_tool_idx ON public.reviews USING btree (tool_id);
CREATE INDEX reviews_user_idx ON public.reviews USING btree (user_id);
CREATE INDEX submissions_domain_idx ON public.tool_submissions USING btree (normalized_domain);
CREATE INDEX submissions_status_idx ON public.tool_submissions USING btree (status);
CREATE INDEX submissions_submitted_idx ON public.tool_submissions USING btree (submitted_by);
CREATE INDEX th_status_idx ON public.tool_health USING btree (status);
CREATE INDEX th_tool_idx ON public.tool_health USING btree (tool_id);
CREATE INDEX tools_category_idx ON public.tools USING btree (category);
CREATE INDEX tools_upvotes_idx ON public.tools USING btree (upvotes DESC);
CREATE INDEX upvotes_tool_idx ON public.upvotes USING btree (tool_id);
CREATE INDEX vault_user_idx ON public.vault_items USING btree (user_id);
CREATE UNIQUE INDEX tool_tags_uniq ON public.tool_tags USING btree (tool_id, tag_id);
CREATE UNIQUE INDEX ts_uniq ON public.tag_subscriptions USING btree (user_id, tag_id);
CREATE UNIQUE INDEX profiles_username_idx ON public.profiles USING btree (username) WHERE (username IS NOT NULL);

-- ─── SECTION 5: ROW LEVEL SECURITY ──────────────────────────────────────────

ALTER TABLE public.alternative_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curator_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curator_shelf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dust_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;

-- ─── SECTION 6: RLS POLICIES ────────────────────────────────────────────────

CREATE POLICY "votes: auth insert" ON public.alternative_votes FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "votes: owner read" ON public.alternative_votes FOR SELECT TO public USING ((user_id = auth.uid()));

CREATE POLICY "cf: admin all" ON public.collection_followers FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "cf: owner delete" ON public.collection_followers FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY "cf: owner insert" ON public.collection_followers FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "cf: public read" ON public.collection_followers FOR SELECT TO public USING (true);

CREATE POLICY "collection_tools: admin all" ON public.collection_tools FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "collection_tools: owner all" ON public.collection_tools FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = collection_tools.collection_id) AND (collections.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = collection_tools.collection_id) AND (collections.user_id = auth.uid())))));
CREATE POLICY "collection_tools: public read" ON public.collection_tools FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM collections
  WHERE ((collections.id = collection_tools.collection_id) AND (collections.is_public = true)))));

CREATE POLICY "collections: admin all" ON public.collections FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "collections: owner all" ON public.collections FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "collections: public read" ON public.collections FOR SELECT TO public USING ((is_public = true));

CREATE POLICY "cf: owner delete" ON public.curator_follows FOR DELETE TO public USING ((follower_id = auth.uid()));
CREATE POLICY "cf: owner insert" ON public.curator_follows FOR INSERT TO public WITH CHECK ((follower_id = auth.uid()));
CREATE POLICY "cf: owner update" ON public.curator_follows FOR UPDATE TO public USING ((follower_id = auth.uid())) WITH CHECK ((follower_id = auth.uid()));
CREATE POLICY "cf: public read" ON public.curator_follows FOR SELECT TO public USING (true);

CREATE POLICY "Public read access" ON public.curator_shelf FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their own shelf" ON public.curator_shelf FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "shelf: owner all" ON public.curator_shelf FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "shelf: public read" ON public.curator_shelf FOR SELECT TO public USING (true);

CREATE POLICY device_requests_delete_own ON public.device_requests FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY device_requests_insert_own ON public.device_requests FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY device_requests_select_own ON public.device_requests FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY device_requests_update_own ON public.device_requests FOR UPDATE TO public USING ((user_id = auth.uid()));

CREATE POLICY "dust: owner all" ON public.dust_items FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "follows: public read" ON public.follows FOR SELECT TO public USING (true);
CREATE POLICY "follows: self delete" ON public.follows FOR DELETE TO public USING ((follower_id = auth.uid()));
CREATE POLICY "follows: self insert" ON public.follows FOR INSERT TO public WITH CHECK ((follower_id = auth.uid()));

CREATE POLICY "hcl: admin all" ON public.health_check_log FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "hcl: public read" ON public.health_check_log FOR SELECT TO public USING (true);

CREATE POLICY "notifications: owner all" ON public.notifications FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "profiles: admin select all" ON public.profiles FOR SELECT TO public USING (is_admin());
CREATE POLICY "profiles: public read" ON public.profiles FOR SELECT TO public USING (((public_profile = true) OR (user_id = auth.uid())));
CREATE POLICY "profiles: self insert" ON public.profiles FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "profiles: self update" ON public.profiles FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "rep: admin all" ON public.reputation_scores FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "rep: insert trigger" ON public.reputation_scores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "rep: public read" ON public.reputation_scores FOR SELECT TO public USING (true);
CREATE POLICY "rep: self update" ON public.reputation_scores FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "reviews: admin select all" ON public.reviews FOR SELECT TO public USING (is_admin());
CREATE POLICY "reviews: admin update" ON public.reviews FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "reviews: owner read all" ON public.reviews FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "reviews: public read active" ON public.reviews FOR SELECT TO public USING ((moderation_status = 'active'::text));
CREATE POLICY "reviews: self delete" ON public.reviews FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY "reviews: self insert" ON public.reviews FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "reviews: self update" ON public.reviews FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "authenticated user access" ON public.tag_subscriptions FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "admin write" ON public.tags FOR ALL TO public USING (is_admin());
CREATE POLICY "public read" ON public.tags FOR SELECT TO public USING (true);

CREATE POLICY "alternatives: admin delete" ON public.tool_alternatives FOR DELETE TO public USING (is_moderator());
CREATE POLICY "alternatives: admin read all" ON public.tool_alternatives FOR SELECT TO public USING (is_moderator());
CREATE POLICY "alternatives: admin update" ON public.tool_alternatives FOR UPDATE TO public USING (is_moderator()) WITH CHECK (is_moderator());
CREATE POLICY "alternatives: auth insert" ON public.tool_alternatives FOR INSERT TO public WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "alternatives: public read approved" ON public.tool_alternatives FOR SELECT TO public USING ((approved = true));

CREATE POLICY "th: admin all" ON public.tool_health FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "th: admin update" ON public.tool_health FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "th: public read" ON public.tool_health FOR SELECT TO public USING (true);

CREATE POLICY "submissions: admin select" ON public.tool_submissions FOR SELECT TO public USING (is_moderator());
CREATE POLICY "submissions: admin update" ON public.tool_submissions FOR UPDATE TO public USING (is_moderator()) WITH CHECK (is_moderator());
CREATE POLICY "submissions: auth insert" ON public.tool_submissions FOR INSERT TO public WITH CHECK ((submitted_by = auth.uid()));
CREATE POLICY "submissions: owner read" ON public.tool_submissions FOR SELECT TO public USING ((submitted_by = auth.uid()));

CREATE POLICY "admin write" ON public.tool_tags FOR ALL TO public USING (is_admin());
CREATE POLICY "public read" ON public.tool_tags FOR SELECT TO public USING (true);

CREATE POLICY "tools: admin all" ON public.tools FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "tools: auth insert" ON public.tools FOR INSERT TO public WITH CHECK ((added_by = auth.uid()));
CREATE POLICY "tools: owner delete" ON public.tools FOR DELETE TO public USING ((added_by = auth.uid()));
CREATE POLICY "tools: owner update" ON public.tools FOR UPDATE TO public USING ((added_by = auth.uid()));
CREATE POLICY "tools: public read" ON public.tools FOR SELECT TO public USING (true);

CREATE POLICY "upvotes: admin all" ON public.upvotes FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "upvotes: owner all" ON public.upvotes FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "upvotes: public read" ON public.upvotes FOR SELECT TO public USING (true);

CREATE POLICY "user_roles: admin all" ON public.user_roles FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "user_roles: owner read" ON public.user_roles FOR SELECT TO public USING ((user_id = auth.uid()));

CREATE POLICY users_insert_own ON public.users FOR INSERT TO public WITH CHECK ((id = auth.uid()));
CREATE POLICY users_select_own ON public.users FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY users_update_own ON public.users FOR UPDATE TO public USING ((id = auth.uid()));

CREATE POLICY "vault: owner all" ON public.vault_items FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY vaults_delete_own ON public.vaults FOR DELETE TO public USING ((user_id = auth.uid()));
CREATE POLICY vaults_insert_own ON public.vaults FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY vaults_select_own ON public.vaults FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY vaults_update_own ON public.vaults FOR UPDATE TO public USING ((user_id = auth.uid()));

-- ─── SECTION 7: TRIGGERS ────────────────────────────────────────────────────

CREATE TRIGGER recalc_rep_submission AFTER INSERT OR UPDATE ON public.tool_submissions FOR EACH ROW EXECUTE FUNCTION trigger_recalc_submission();
CREATE TRIGGER recalc_rep_follow AFTER INSERT OR DELETE ON public.curator_follows FOR EACH ROW EXECUTE FUNCTION trigger_recalc_follow();
CREATE TRIGGER recalc_rep_review AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION trigger_recalc_review();

-- ─── SECTION 8: STORAGE BUCKETS ─────────────────────────────────────────────
-- Referenced by src/hooks/useStorageUpload.ts ('avatars' | 'banners' |
-- 'collection-covers') and by SubmitToolModal/ToolScreenshot ('screenshots').

-- id                public  size_limit  mime_types
-- avatars           true    null        null
-- banners           true    null        null
-- collection-covers true    null        null
-- screenshots       true    5242880     image/png, image/jpeg, image/webp

-- ─── END OF GENERATED SNAPSHOT ──────────────────────────────────────────────
-- Routine definitions (24 functions) are in the sibling file ./functions.sql
-- ────────────────────────────────────────────────────────────────────────────
