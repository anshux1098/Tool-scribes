import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

describe('Tier 2: Global AuthContext and error resilience', () => {
  it('returns default auth state when called outside AuthProvider without throwing', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeDefined();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isModerator).toBe(false);
  });

  it('correctly extracts and decodes auth error description from URL hash fragment', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    const params = new URLSearchParams(hash.slice(1));
    const errorDescription = params.get('error_description');

    expect(errorDescription).toBe('Email link is invalid or has expired');
  });

  it('correctly extracts and decodes percent-encoded error description from URL query string', () => {
    const search = '?error=access_denied&error_description=Invalid%20token%20signature';
    const params = new URLSearchParams(search);
    const errorDescription = decodeURIComponent(params.get('error_description') || '');

    expect(errorDescription).toBe('Invalid token signature');
  });
});
