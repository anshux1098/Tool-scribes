import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ToolCategory } from '@/lib/types';

export type UserRole = 'developer' | 'designer' | 'student' | 'indie_hacker' | 'product_builder';

export interface SeedTool {
  name: string;
  url: string;
  description: string;
  category: ToolCategory;
  icon: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  developer: 'Developer',
  designer: 'Designer',
  student: 'Student',
  indie_hacker: 'Indie Hacker',
  product_builder: 'Product Builder',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  developer: 'Builders who code, ship, and maintain software.',
  designer: 'Creators who craft interfaces, visuals, and experiences.',
  student: 'Learners studying CS, design, or building side projects.',
  indie_hacker: 'Solo founders building and launching products quickly.',
  product_builder: 'Product managers and founders shaping roadmaps.',
};

const ROLE_EMOJIS: Record<UserRole, string> = {
  developer: '⚡',
  designer: '🎨',
  student: '📚',
  indie_hacker: '🚀',
  product_builder: '🧩',
};

const SEED_TOOLS: Record<UserRole, SeedTool[]> = {
  developer: [
    { name: 'GitHub', url: 'https://github.com', description: 'Code hosting, version control, and collaboration for developers.', category: 'dev', icon: '🐙' },
    { name: 'VS Code', url: 'https://code.visualstudio.com', description: 'Lightweight, extensible code editor with rich ecosystem.', category: 'dev', icon: '💻' },
    { name: 'Vercel', url: 'https://vercel.com', description: 'Deploy frontend apps instantly with serverless edge functions.', category: 'dev', icon: '▲' },
    { name: 'Supabase', url: 'https://supabase.com', description: 'Open-source Firebase alternative with Postgres, auth, and storage.', category: 'dev', icon: '🔥' },
    { name: 'Linear', url: 'https://linear.app', description: 'Sprint-based issue tracking built for high-performance teams.', category: 'prod', icon: '📋' },
    { name: 'Postman', url: 'https://postman.com', description: 'API development, testing, and documentation platform.', category: 'dev', icon: '📮' },
    { name: 'Sentry', url: 'https://sentry.io', description: 'Real-time error tracking and performance monitoring.', category: 'dev', icon: '⚠️' },
    { name: 'Docker', url: 'https://docker.com', description: 'Container platform to build, ship, and run applications anywhere.', category: 'dev', icon: '🐳' },
  ],
  designer: [
    { name: 'Figma', url: 'https://figma.com', description: 'Collaborative interface design tool with real-time editing.', category: 'design', icon: '🖌️' },
    { name: 'Dribbble', url: 'https://dribbble.com', description: 'Community for designers to share and discover creative work.', category: 'design', icon: '🏀' },
    { name: 'Unsplash', url: 'https://unsplash.com', description: 'High-resolution, royalty-free stock photography.', category: 'design', icon: '📷' },
    { name: 'Coolors', url: 'https://coolors.co', description: 'Fast color palette generator for design projects.', category: 'design', icon: '🎨' },
    { name: 'Fontshare', url: 'https://fontshare.com', description: 'High-quality, free fonts for designers.', category: 'design', icon: '🔤' },
    { name: 'LottieFiles', url: 'https://lottiefiles.com', description: 'Lightweight, scalable animations for web and mobile.', category: 'design', icon: '🎞️' },
    { name: 'Spline', url: 'https://spline.design', description: '3D design tool for the web — no coding required.', category: 'design', icon: '🔮' },
  ],
  student: [
    { name: 'Notion', url: 'https://notion.so', description: 'All-in-one workspace for notes, docs, and project management.', category: 'prod', icon: '📝' },
    { name: 'Obsidian', url: 'https://obsidian.md', description: 'Local-first knowledge base with bidirectional linking.', category: 'learn', icon: '🧠' },
    { name: 'Khan Academy', url: 'https://khanacademy.org', description: 'Free online courses, lessons, and practice in many subjects.', category: 'learn', icon: '📖' },
    { name: 'DeepL', url: 'https://deepl.com', description: 'Accurate AI-powered translation for 30+ languages.', category: 'learn', icon: '🌍' },
    { name: 'Zotero', url: 'https://zotero.org', description: 'Personal research assistant for collecting and organizing sources.', category: 'learn', icon: '📚' },
    { name: 'Grammarly', url: 'https://grammarly.com', description: 'AI writing assistant for clear, mistake-free communication.', category: 'util', icon: '✍️' },
    { name: 'Wolfram Alpha', url: 'https://wolframalpha.com', description: 'Computational knowledge engine for answers and data.', category: 'learn', icon: '🔢' },
    { name: 'Quizlet', url: 'https://quizlet.com', description: 'Flashcard and study tool with AI-powered features.', category: 'learn', icon: '🃏' },
  ],
  indie_hacker: [
    { name: 'Stripe', url: 'https://stripe.com', description: 'Payment processing infrastructure for online businesses.', category: 'prod', icon: '💳' },
    { name: 'Vercel', url: 'https://vercel.com', description: 'Deploy frontend apps instantly with serverless edge functions.', category: 'dev', icon: '▲' },
    { name: 'Cursor', url: 'https://cursor.sh', description: 'AI-first code editor built for rapid prototyping.', category: 'dev', icon: '🤖' },
    { name: 'Supabase', url: 'https://supabase.com', description: 'Open-source Firebase alternative with Postgres, auth, and storage.', category: 'dev', icon: '🔥' },
    { name: 'Linear', url: 'https://linear.app', description: 'Sprint-based issue tracking built for high-performance teams.', category: 'prod', icon: '📋' },
    { name: 'Resend', url: 'https://resend.com', description: 'Email API for developers — send transactional emails easily.', category: 'dev', icon: '📧' },
    { name: 'Plausible', url: 'https://plausible.io', description: 'Simple, privacy-friendly website analytics.', category: 'util', icon: '📊' },
    { name: 'Cal.com', url: 'https://cal.com', description: 'Open-source scheduling infrastructure for your product.', category: 'prod', icon: '📅' },
  ],
  product_builder: [
    { name: 'Linear', url: 'https://linear.app', description: 'Sprint-based issue tracking built for high-performance teams.', category: 'prod', icon: '📋' },
    { name: 'Figma', url: 'https://figma.com', description: 'Collaborative interface design tool with real-time editing.', category: 'design', icon: '🖌️' },
    { name: 'Notion', url: 'https://notion.so', description: 'All-in-one workspace for notes, docs, and project management.', category: 'prod', icon: '📝' },
    { name: 'Product Hunt', url: 'https://producthunt.com', description: 'Discover and launch new products to a passionate community.', category: 'util', icon: '🦊' },
    { name: 'Stripe', url: 'https://stripe.com', description: 'Payment processing infrastructure for online businesses.', category: 'prod', icon: '💳' },
    { name: 'Sentry', url: 'https://sentry.io', description: 'Real-time error tracking and performance monitoring.', category: 'dev', icon: '⚠️' },
    { name: 'Amplitude', url: 'https://amplitude.com', description: 'Product analytics platform for understanding user behavior.', category: 'util', icon: '📈' },
    { name: 'Intercom', url: 'https://intercom.com', description: 'Customer communication platform with messaging and support.', category: 'util', icon: '💬' },
  ],
};

export { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_EMOJIS, SEED_TOOLS };

export async function seedVaultTools(
  userId: string,
  selectedRoles: UserRole[]
): Promise<{ count: number; error?: string }> {
  if (!isSupabaseConfigured) return { count: 0, error: 'Supabase not configured' };
  if (selectedRoles.length === 0) return { count: 0 };

  // Collect unique tools across all selected roles (deduplicate by URL)
  const toolMap = new Map<string, SeedTool>();
  for (const role of selectedRoles) {
    const tools = SEED_TOOLS[role];
    if (!tools) continue;
    for (const t of tools) {
      if (!toolMap.has(t.url)) toolMap.set(t.url, t);
    }
  }

  const seedTools = Array.from(toolMap.values());

  // Step 1: Find which tools already exist in the DB by URL
  const urls = seedTools.map(t => t.url);
  let existingTools;
  try {
    const res = await supabase
      .from('tools')
      .select('id, url')
      .in('url', urls);
    existingTools = res.data;
  } catch (e) { console.error('[seedTools] fetch existing tools failed:', e); return { count: 0, error: 'Failed to check existing tools' }; }

  const existingUrlMap = new Map<string, string>();
  if (existingTools) {
    for (const t of existingTools) {
      existingUrlMap.set(t.url, t.id);
    }
  }

  // Step 2: Insert tools that don't exist yet
  const toolIds: string[] = [];
  const inserts = seedTools
    .filter(t => !existingUrlMap.has(t.url))
    .map(t => ({
      name: t.name,
      url: t.url,
      description: t.description,
      category: t.category,
      icon: t.icon,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(t.url).hostname}&sz=64`,
      og_image: '',
      price_model: 'free' as const,
      is_open_source: false,
      requires_login: false,
      added_by: userId,
      upvotes: 0,
    }));

  if (inserts.length > 0) {
    try {
      const { data: inserted } = await supabase
        .from('tools')
        .insert(inserts)
        .select('id, url');

      if (inserted) {
        for (const t of inserted) {
          toolIds.push(t.id);
          existingUrlMap.set(t.url, t.id);
        }
      }
    } catch (e) { console.error('[seedTools] insert tools failed:', e); return { count: 0, error: 'Failed to insert tools' }; }
  }

  // Collect all tool UUIDs (existing + newly inserted)
  for (const t of seedTools) {
    const uuid = existingUrlMap.get(t.url);
    if (uuid) toolIds.push(uuid);
  }

  // Step 3: Filter out already-saved vault items
  const { data: existingVault } = await supabase
    .from('vault_items')
    .select('tool_id')
    .eq('user_id', userId)
    .in('tool_id', toolIds);

  const existingVaultSet = new Set<string>();
  if (existingVault) {
    for (const v of existingVault) existingVaultSet.add(v.tool_id);
  }

  const newVaultItems = toolIds
    .filter(id => !existingVaultSet.has(id))
    .map(toolId => ({ user_id: userId, tool_id: toolId }));

  // Step 4: Batch insert vault_items
  if (newVaultItems.length > 0) {
    const { error } = await supabase.from('vault_items').insert(newVaultItems);
    if (error) return { count: 0, error: error.message };
  }

  return { count: newVaultItems.length };
}
