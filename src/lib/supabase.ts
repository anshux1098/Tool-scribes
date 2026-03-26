import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  upvotes: number;
  added_by: string | null;   // auth.users.id
}

export interface VaultRow {
  id: string;
  user_id: string;
  tool_id: string;
  is_favorite: boolean;
  notes: string;
  tags: string[];
  last_visited: string | null;
  created_at: string;
}

export interface UpvoteRow {
  id: string;
  user_id: string;
  tool_id: string;
  created_at: string;
}
