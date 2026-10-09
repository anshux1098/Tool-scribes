import { describe, it, expect } from 'vitest';
import { cn, hashId } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('hashId', () => {
  it('generates unique values', () => {
    const a = hashId();
    const b = hashId();
    expect(a).not.toBe(b);
  });

  it('returns a string', () => {
    expect(typeof hashId()).toBe('string');
  });

  it('starts with ts_ prefix', () => {
    expect(hashId()).toMatch(/^ts_/);
  });
});
