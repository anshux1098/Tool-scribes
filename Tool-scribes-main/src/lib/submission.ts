import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ToolCategory } from '@/lib/types';
import { fetchMetadata } from '@/lib/fetchMetadata';
import { generateAiProfile, saveAiProfileToSubmission } from '@/lib/generate-ai-profile';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ToolSubmission {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SubmissionStatus;
  url: string;
  normalizedDomain: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: string;
  favicon: string;
  ogImage: string;
  screenshotUrl: string;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string;
  matchedToolId: string | null;
  submitterEmail?: string;
  aiSummary?: string;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  tool?: { id: string; name: string; url: string };
}

export function normalizeDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().trim();
  }
}

export async function checkDuplicate(url: string): Promise<DuplicateResult> {
  if (!isSupabaseConfigured) return { isDuplicate: false };
  try {
    const domain = normalizeDomain(url);
    const { data: tools } = await supabase
      .from('tools')
      .select('id, name, url')
      .limit(50);

    if (!tools) return { isDuplicate: false };

    for (const tool of tools) {
      const toolDomain = normalizeDomain(tool.url);
      if (toolDomain === domain) {
        return { isDuplicate: true, tool: { id: tool.id, name: tool.name, url: tool.url } };
      }
    }

    // Also check pending submissions with the same domain
    const { data: pending } = await supabase
      .from('tool_submissions')
      .select('id, title, url')
      .eq('normalized_domain', domain)
      .eq('status', 'pending')
      .limit(1);

    if (pending && pending.length > 0) {
      return {
        isDuplicate: true,
        tool: { id: pending[0].id, name: pending[0].title || 'Pending submission', url: pending[0].url },
      };
    }

    return { isDuplicate: false };
  } catch (e) { console.error('[submission] checkDuplicate failed:', e); return { isDuplicate: false }; }
}

const KEYWORD_CATEGORY_MAP: [RegExp, ToolCategory][] = [
  [/machine learning|artificial intelligence|llm|gpt|chatbot|neural|ai|openai|langchain|vector/, 'ai'],
  [/github|git|code|api|sdk|framework|cli|terminal|ide|compiler|debug|deploy|host|server|docker|kubernetes/, 'dev'],
  [/design|figma|sketch|ui|ux|mockup|prototype|wireframe|color|font|typography|canva|illustrator|photoshop/, 'design'],
  [/productivity|calendar|project|task|todo|note|organize|workflow|automation|sheet|doc|spreadsheet/, 'prod'],
  [/course|learn|tutorial|education|study|academy|school|university|lesson|class|training|skill/, 'learn'],
];

export function suggestCategory(title: string, description: string): ToolCategory {
  const text = `${title} ${description}`.toLowerCase();
  for (const [pattern, cat] of KEYWORD_CATEGORY_MAP) {
    if (pattern.test(text)) return cat;
  }
  return 'util';
}

export interface FetchedMetadata {
  title: string;
  description: string;
  favicon: string;
  ogImage: string;
  suggestedCategory: ToolCategory;
}

export async function fetchAndSuggest(url: string): Promise<FetchedMetadata | null> {
  const meta = await fetchMetadata(url);
  if (!meta) return null;
  return {
    title: meta.name,
    description: meta.description,
    favicon: meta.favicon,
    ogImage: meta.ogImage,
    suggestedCategory: suggestCategory(meta.name, meta.description),
  };
}

export async function submitTool(data: {
  url: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: string;
  favicon: string;
  ogImage: string;
  isFree?: boolean;
  platforms?: string[];
  signupRequired?: boolean;
  screenshotUrl?: string;
}): Promise<{ error?: string; screenshotUrl?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const domain = normalizeDomain(data.url);
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user?.id;

  const { data: inserted, error } = await supabase.from('tool_submissions').insert({
    url: data.url,
    normalized_domain: domain,
    title: data.title,
    description: data.description,
    category: data.category,
    icon: data.icon,
    favicon: data.favicon,
    og_image: data.ogImage,
    screenshot_url: data.screenshotUrl ?? '',
    is_free: data.isFree ?? true,
    platforms: data.platforms ?? ['web'],
    signup_required: data.signupRequired ?? false,
    submitted_by: userId ?? null,
    status: 'pending',
  }).select('id').single();

  if (error) return { error: error.message };

  // Fire-and-forget AI profile generation
  generateAiProfile(data.title, data.url, data.description).then(result => {
    if (result.summary && inserted?.id) {
      saveAiProfileToSubmission(inserted.id as string, result.summary);
    }
  });

  return { screenshotUrl: data.screenshotUrl };
}

const PAGE_SIZE = 50;

export async function fetchSubmissions(status?: SubmissionStatus, cursor?: string): Promise<{ data: ToolSubmission[]; nextCursor: string | null }> {
  if (!isSupabaseConfigured) return { data: [], nextCursor: null };

  const { data, error } = await supabase.rpc('get_submissions_for_review');
  if (error || !data) return { data: [], nextCursor: null };

  let rows = data as Record<string, unknown>[];
  if (status) {
    rows = rows.filter(r => r.status === status);
  }

  rows.sort((a, b) => ((b.created_at as string) ?? '').localeCompare((a.created_at as string) ?? ''));

  if (cursor) {
    rows = rows.filter(r => (r.created_at as string) < cursor);
  }

  const page = rows.slice(0, PAGE_SIZE);
  const nextCursor = page.length === PAGE_SIZE ? (page[page.length - 1].created_at as string) : null;
  return { data: page.map(mapRow), nextCursor };
}

function mapRow(row: Record<string, unknown>): ToolSubmission {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    status: row.status as SubmissionStatus,
    url: row.url as string,
    normalizedDomain: row.normalized_domain as string,
    title: row.title as string,
    description: row.description as string,
    category: (row.category as ToolCategory) || 'util',
    icon: row.icon as string,
    favicon: row.favicon as string,
    ogImage: row.og_image as string,
    screenshotUrl: row.screenshot_url as string,
    submittedBy: row.submitted_by as string | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewedAt: row.reviewed_at as string | null,
    rejectionReason: row.rejection_reason as string,
    matchedToolId: row.matched_tool_id as string | null,
    submitterEmail: row.submitter_email as string | undefined,
    aiSummary: row.ai_summary as string | undefined,
  };
}

export async function approveSubmission(submissionId: string): Promise<{ error?: string; toolId?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('approve_submission', { submission_id: submissionId });
  if (error) return { error: error.message };
  return { toolId: data as string };
}

export async function rejectSubmission(
  submissionId: string,
  reason: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { error } = await supabase.rpc('reject_submission', { submission_id: submissionId, reason });
  if (error) return { error: error.message };
  return {};
}
