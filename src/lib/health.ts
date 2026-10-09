import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type HealthStatus = 'active' | 'warning' | 'sunset' | 'archived' | 'unknown';

export interface ToolHealth {
  toolId: number;
  status: HealthStatus;
  lastHealthCheck: number | null;
  responseTimeMs: number | null;
  httpStatus: number | null;
  errorMessage: string;
  uptimePct: number;
  sslValid: boolean | null;
}

export interface HealthCheckLog {
  id: string;
  createdAt: string;
  toolId: string;
  status: string;
  responseTimeMs: number | null;
  httpStatus: number | null;
  errorMessage: string;
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  active: 'Active',
  warning: 'Warning',
  sunset: 'Sunset',
  archived: 'Archived',
  unknown: 'Unknown',
};

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  active: '#166534',
  warning: '#B45309',
  sunset: '#6B7280',
  archived: '#991B1B',
  unknown: '#9CA3AF',
};

export const HEALTH_BG: Record<HealthStatus, string> = {
  active: 'rgba(22,101,52,0.08)',
  warning: 'rgba(180,83,9,0.08)',
  sunset: 'rgba(107,114,128,0.08)',
  archived: 'rgba(153,27,27,0.08)',
  unknown: 'rgba(156,163,175,0.08)',
};

export async function checkToolHealth(url: string): Promise<{
  status: HealthStatus;
  responseTimeMs: number;
  httpStatus: number | null;
  errorMessage: string;
}> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const elapsed = Math.round(performance.now() - start);

    if (response.status >= 301 && response.status <= 308) {
      return { status: 'warning', responseTimeMs: elapsed, httpStatus: response.status, errorMessage: `Permanent redirect (${response.status})` };
    }

    if (response.status >= 400 && response.status < 500) {
      return { status: 'warning', responseTimeMs: elapsed, httpStatus: response.status, errorMessage: `Client error (${response.status})` };
    }

    if (response.status >= 500) {
      return { status: 'warning', responseTimeMs: elapsed, httpStatus: response.status, errorMessage: `Server error (${response.status})` };
    }

    if (elapsed > 5000) {
      return { status: 'warning', responseTimeMs: elapsed, httpStatus: response.status, errorMessage: 'Slow response time' };
    }

    return { status: 'active', responseTimeMs: elapsed, httpStatus: response.status, errorMessage: '' };
  } catch (e) {
    const elapsed = Math.round(performance.now() - start);
    const msg = e instanceof Error ? (e.name === 'AbortError' ? 'Request timed out' : e.message) : 'Unknown error';
    return { status: 'warning', responseTimeMs: elapsed, httpStatus: null, errorMessage: msg };
  }
}

export async function fetchToolHealth(toolUuid: string): Promise<ToolHealth | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('tool_health')
      .select('*')
      .eq('tool_id', toolUuid)
      .single();
    if (!data) return null;
    return {
      toolId: 0,
      status: (data.status as HealthStatus) || 'unknown',
      lastHealthCheck: data.last_health_check ? new Date(data.last_health_check as string).getTime() : null,
      responseTimeMs: (data.response_time_ms as number) ?? null,
      httpStatus: (data.http_status as number) ?? null,
      errorMessage: (data.error_message as string) || '',
      uptimePct: (data.uptime_pct as number) ?? 100,
      sslValid: (data.ssl_valid as boolean) ?? null,
    };
  } catch (e) { console.error('[health] fetchToolHealth failed:', e); return null; }
}

export async function runHealthCheck(toolUuid: string, url: string): Promise<ToolHealth> {
  const result = await checkToolHealth(url);
  const now = new Date().toISOString();

  // Determine status: 2 consecutive failures could mean sunset/down
  // For simplicity, use the check result + previous status
  let status = result.status;
  if (result.httpStatus && result.httpStatus >= 500) {
    status = 'warning';
  }

  try {
    // Upsert health record
    const { data: existing } = await supabase
      .from('tool_health')
      .select('status, uptime_pct')
      .eq('tool_id', toolUuid)
      .single();

    let uptimePct = 100;
    if (existing) {
      uptimePct = ((existing.uptime_pct as number) * 0.9) + (result.status === 'active' ? 10 : 0);
      uptimePct = Math.min(100, Math.max(0, Math.round(uptimePct * 100) / 100));
    }

    await supabase.from('tool_health').upsert({
      tool_id: toolUuid,
      status,
      last_health_check: now,
      response_time_ms: result.responseTimeMs,
      http_status: result.httpStatus,
      error_message: result.errorMessage,
      uptime_pct: uptimePct,
      ssl_valid: result.httpStatus === 200 || result.httpStatus === 301 || result.httpStatus === 302,
    }, { onConflict: 'tool_id' });

    // Log the check
    await supabase.from('health_check_log').insert({
      tool_id: toolUuid,
      status,
      response_time_ms: result.responseTimeMs,
      http_status: result.httpStatus,
      error_message: result.errorMessage,
    });

    return {
      toolId: 0,
      status,
      lastHealthCheck: Date.now(),
      responseTimeMs: result.responseTimeMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
      uptimePct,
      sslValid: result.httpStatus === 200,
    };
  } catch (e) { console.error('[health] runHealthCheck failed:', e); return {
    toolId: 0, status: 'warning', lastHealthCheck: Date.now(),
    responseTimeMs: result.responseTimeMs, httpStatus: result.httpStatus,
    errorMessage: 'Health check DB error', uptimePct: 100, sslValid: null,
  }; }
}

export async function fetchAllToolHealth(): Promise<Map<string, ToolHealth>> {
  if (!isSupabaseConfigured) return new Map();
  try {
    const { data } = await supabase.from('tool_health').select('*');
    const map = new Map<string, ToolHealth>();
    if (data) {
      for (const row of data) {
        map.set(row.tool_id as string, {
          toolId: 0,
          status: (row.status as HealthStatus) || 'unknown',
          lastHealthCheck: row.last_health_check ? new Date(row.last_health_check as string).getTime() : null,
          responseTimeMs: (row.response_time_ms as number) ?? null,
          httpStatus: (row.http_status as number) ?? null,
          errorMessage: (row.error_message as string) || '',
          uptimePct: (row.uptime_pct as number) ?? 100,
          sslValid: (row.ssl_valid as boolean) ?? null,
        });
      }
    }
    return map;
  } catch (e) { console.error('[health] fetchAllToolHealth failed:', e); return new Map(); }
}

export async function setToolHealthStatus(toolUuid: string, status: HealthStatus): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('tool_health').upsert({
      tool_id: toolUuid,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tool_id' });
  } catch (e) { console.error('[health] setToolHealthStatus failed:', e); }
}

export async function fetchHealthCheckLogs(toolUuid: string, limit = 20): Promise<HealthCheckLog[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from('health_check_log')
      .select('*')
      .eq('tool_id', toolUuid)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!data) return [];
    return data.map(row => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      toolId: row.tool_id as string,
      status: row.status as string,
      responseTimeMs: (row.response_time_ms as number) ?? null,
      httpStatus: (row.http_status as number) ?? null,
      errorMessage: (row.error_message as string) || '',
    }));
  } catch (e) { console.error('[health] fetchHealthCheckLogs failed:', e); return []; }
}
