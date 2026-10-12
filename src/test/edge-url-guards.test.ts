import { describe, it, expect } from 'vitest';

/**
 * The SSRF guard as it runs on the edge function. Mirrors the logic in
 * supabase/functions/generate-ai-profile/index.ts — Deno is not available under
 * vitest, and duplicating the function body into the app bundle would ship dead
 * code, so the cases are pinned here against the same rules.
 */
function isPrivateV6(addr: string): boolean {
  const a = addr.toLowerCase();
  const mapped = a.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    const quad = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return !isValidPublicUrl(`http://${quad}`);
  }
  if (/^(0*:)*:?(0*)?:1$/.test(a) || /^0*$/.test(a.replace(/:/g, ''))) return true;
  if (/^f[cd]/.test(a)) return true;
  if (/^fe[89ab]/.test(a)) return true;
  return false;
}

function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (hostname === 'local' || hostname.endsWith('.local')) return false;

    const v6 = hostname.match(/^\[([0-9a-f:]+)\]$/);
    if (v6) return !isPrivateV6(v6[1]);

    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const a = Number(ipMatch[1]);
      const b = Number(ipMatch[2]);
      const c = Number(ipMatch[3]);
      const d = Number(ipMatch[4]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a >= 224) return false;
      if (a === 100 && b >= 64 && b <= 127) return false;
      if (a === 192 && b === 0 && c === 0) return false;
      if (b > 255 || c > 255 || d > 255) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

describe('isValidPublicUrl — ordinary URLs', () => {
  it('accepts public https URLs', () => {
    expect(isValidPublicUrl('https://example.com')).toBe(true);
    expect(isValidPublicUrl('https://example.com/a/b?c=d#e')).toBe(true);
    expect(isValidPublicUrl('http://93.184.216.34/')).toBe(true);
  });

  it('rejects non-http schemes', () => {
    expect(isValidPublicUrl('file:///etc/passwd')).toBe(false);
    expect(isValidPublicUrl('gopher://example.com')).toBe(false);
    expect(isValidPublicUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidPublicUrl('not a url')).toBe(false);
    expect(isValidPublicUrl('')).toBe(false);
  });
});

describe('isValidPublicUrl — private and reserved IPv4', () => {
  it('blocks the ranges the original guard covered', () => {
    expect(isValidPublicUrl('http://127.0.0.1/')).toBe(false);
    expect(isValidPublicUrl('http://10.0.0.1/')).toBe(false);
    expect(isValidPublicUrl('http://172.16.0.1/')).toBe(false);
    expect(isValidPublicUrl('http://172.31.255.255/')).toBe(false);
    expect(isValidPublicUrl('http://192.168.1.1/')).toBe(false);
    expect(isValidPublicUrl('http://0.0.0.0/')).toBe(false);
    expect(isValidPublicUrl('http://224.0.0.1/')).toBe(false);
  });

  it('blocks the cloud metadata endpoint', () => {
    expect(isValidPublicUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('blocks localhost by name', () => {
    expect(isValidPublicUrl('http://localhost:3000/')).toBe(false);
    expect(isValidPublicUrl('http://api.localhost/')).toBe(false);
    expect(isValidPublicUrl('http://db.local/')).toBe(false);
  });

  // These all passed the original dotted-quad-only check.

  it('blocks CGNAT 100.64.0.0/10', () => {
    expect(isValidPublicUrl('http://100.64.0.1/')).toBe(false);
    expect(isValidPublicUrl('http://100.127.255.255/')).toBe(false);
  });

  it('blocks 192.0.0.0/24', () => {
    expect(isValidPublicUrl('http://192.0.0.170/')).toBe(false);
  });

  it('does not over-block public ranges adjacent to private ones', () => {
    expect(isValidPublicUrl('http://172.15.0.1/')).toBe(true);
    expect(isValidPublicUrl('http://172.32.0.1/')).toBe(true);
    expect(isValidPublicUrl('http://100.63.255.255/')).toBe(true);
    expect(isValidPublicUrl('http://100.128.0.1/')).toBe(true);
    expect(isValidPublicUrl('http://11.0.0.1/')).toBe(true);
    expect(isValidPublicUrl('http://9.255.255.255/')).toBe(true);
  });
});

describe('isValidPublicUrl — IPv6', () => {
  it('blocks loopback and unspecified', () => {
    expect(isValidPublicUrl('http://[::1]/')).toBe(false);
    expect(isValidPublicUrl('http://[::]/')).toBe(false);
  });

  it('blocks unique-local and link-local', () => {
    expect(isValidPublicUrl('http://[fd00::1]/')).toBe(false);
    expect(isValidPublicUrl('http://[fc00::1]/')).toBe(false);
    expect(isValidPublicUrl('http://[fe80::1]/')).toBe(false);
  });

  it('blocks IPv4-mapped metadata endpoints', () => {
    expect(isValidPublicUrl('http://[::ffff:169.254.169.254]/')).toBe(false);
    expect(isValidPublicUrl('http://[::127.0.0.1]/')).toBe(false);
  });

  it('allows a public IPv6 literal', () => {
    expect(isValidPublicUrl('http://[2606:4700:4700::1111]/')).toBe(true);
  });
});

describe('isUuid — guards the service-role ?id=eq. filter', () => {
  it('accepts a well-formed v4 UUID', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
  });

  it('rejects PostgREST filter grammar', () => {
    // Each of these rewrote the `?id=eq.` filter on a service-role request.
    expect(isUuid("x,category.eq.admin")).toBe(false);
    expect(isUuid("x),or(upvotes.gt.0")).toBe(false);
    expect(isUuid("x&select=ai_summary")).toBe(false);
    expect(isUuid("x%2Ccategory")).toBe(false);
    expect(isUuid("' or '1'='1")).toBe(false);
  });

  it('rejects non-strings and near-misses', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('3f2504e0-4f89-41d3-9a0c')).toBe(false);
    // Version nibble must be 1-5; variant nibble must be 8/9/a/b.
    expect(isUuid('3f2504e0-4f89-91d3-9a0c-0305e82c3301')).toBe(false);
    expect(isUuid('3f2504e0-4f89-41d3-ca0c-0305e82c3301')).toBe(false);
  });

  it('rejects an embedded newline used to smuggle a second line', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301\nx')).toBe(false);
  });
});