import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface GenerateAiProfileResult {
  summary?: string;
  error?: string;
  cached?: boolean;
  version?: number;
}

export async function generateAiProfile(
  name: string,
  url: string,
  description: string,
  toolId?: string,
  forceRegenerate?: boolean,
): Promise<GenerateAiProfileResult> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  console.log(`[AI PROFILE] ${forceRegenerate ? 'regenerating' : 'requesting'} profile for tool ${toolId ?? '(new submission)'}`);

  const { data, error } = await supabase.functions.invoke('generate-ai-profile', {
    body: { name, url, description, toolId, forceRegenerate: forceRegenerate ?? false },
  });

  if (error) return { error: error.message };
  if (data?.success === false) return { error: data.message || 'AI service is temporarily unavailable.' };

  if (data?.cached) {
    console.log('[AI PROFILE] using cache');
    return { summary: data.profile as string, cached: true, version: data.version };
  }

  console.log('[AI PROFILE] generating new profile');
  return { summary: data?.profile as string, cached: false };
}

export async function saveAiProfile(toolUuid: string, summary: string, currentVersion = 0): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('tools')
    .update({
      ai_summary: summary,
      ai_profile_generated_at: new Date().toISOString(),
      ai_profile_version: currentVersion + 1,
    })
    .eq('id', toolUuid);

  if (error) return { error: error.message };
  console.log('[AI PROFILE] saved profile');
  return {};
}

export async function saveAiProfileToSubmission(submissionUuid: string, summary: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('tool_submissions')
    .update({
      ai_summary: summary,
      ai_profile_generated_at: new Date().toISOString(),
      ai_profile_version: 1,
    })
    .eq('id', submissionUuid);

  if (error) return { error: error.message };
  return {};
}
