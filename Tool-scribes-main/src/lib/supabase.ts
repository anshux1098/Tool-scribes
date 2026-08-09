import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabaseInitError = !SUPABASE_URL
  ? 'Missing environment variable: VITE_SUPABASE_URL'
  : !SUPABASE_PUBLISHABLE_KEY
    ? 'Missing environment variable: VITE_SUPABASE_PUBLISHABLE_KEY'
    : null;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!)
  : (undefined as unknown as ReturnType<typeof createClient>);

export function getSupabase(): ReturnType<typeof createClient> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }
  return supabase;
}

// ─── DB row types (snake_case from Postgres) ────────────────────────────────

export interface ToolRow {
  id: string;
  created_at: string;
  name: string;
  url: string;
  description: string;
  category: string;
  icon: string;
  favicon: string;
  og_image: string;
  screenshot_url: string;
  upvotes: number;
  price_model: string;
  is_open_source: boolean;
  requires_login: boolean;
  added_by: string | null;   // auth.users.id
  ai_summary?: string;
  ai_profile_generated_at?: string;
  ai_profile_version?: number;
  is_free?: boolean;
  platforms?: string[];
  signup_required?: boolean;
}

export interface VaultRow {
  id: string;
  user_id: string;
  tool_id: string;
  is_favorite: boolean;
  notes: string;
  tags: string[];
  last_visited: string | null;
  visit_count: number;
  created_at: string;
}

export interface UpvoteRow {
  id: string;
  user_id: string;
  tool_id: string;
  created_at: string;
}

export interface CollectionRow {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  cover_image_url: string;
  featured: boolean;
  clone_count: number;
  view_count: number;
}

export interface CollectionToolRow {
  id: string;
  created_at: string;
  collection_id: string;
  tool_id: string;
}

export interface CollectionFollowerRow {
  id: string;
  created_at: string;
  user_id: string;
  collection_id: string;
}

export interface ProfileRow {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  username: string | null;
  display_name: string;
  tagline: string;
  bio: string;
  location: string;
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  avatar_url: string;
  banner_url: string;
  public_profile: boolean;
  featured_collection_id: string | null;
  curator_badge: string;
  show_reviews: boolean;
  show_collections: boolean;
  show_followers: boolean;
  reputation_score: number;
  signature_quote: string;
  contact_url: string;
}

export interface FollowRow {
  id: string;
  created_at: string;
  follower_id: string;
  following_id: string;
}

export interface ReviewRow {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  tool_id: string;
  best_for: string;
  gotcha: string;
  free_tier: string;
  rating: number;
  is_flagged: boolean;
  flagged_reason: string;
  moderation_status: string;
  moderated_at: string | null;
  moderated_by: string | null;
}
