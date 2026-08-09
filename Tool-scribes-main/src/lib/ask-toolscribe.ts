import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ToolRecommendation {
  toolId: string;
  name: string;
  reason: string;
  category: string;
  icon: string;
}

export interface ToolContext {
  name: string;
  description: string;
  category: string;
  tags: string[];
  features: string[];
  reviewsSummary: string;
}

export interface AskResponse {
  recommendations?: ToolRecommendation[];
  answer?: string;
  raw?: string;
  error?: string;
}

export async function askToolScribe(query: string, toolContext?: ToolContext): Promise<AskResponse> {
  if (!isSupabaseConfigured) return { recommendations: [], error: 'Supabase not configured' };

  const { data, error } = await supabase.functions.invoke('ask-toolscribe', {
    body: { query, toolContext: toolContext ?? null },
  });

  if (error) return { recommendations: [], error: error.message };
  if (data?.success === false) return { recommendations: [], error: data.message || 'AI service is temporarily unavailable.' };

  return data as AskResponse;
}
