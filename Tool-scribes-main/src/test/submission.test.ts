import { describe, it, expect } from 'vitest';
import { normalizeDomain, suggestCategory } from '@/lib/submission';

describe('normalizeDomain', () => {
  it('extracts hostname from full URL', () => {
    expect(normalizeDomain('https://www.example.com/page')).toBe('example.com');
  });

  it('strips www prefix', () => {
    expect(normalizeDomain('https://www.google.com')).toBe('google.com');
  });

  it('handles URL without www', () => {
    expect(normalizeDomain('https://github.com')).toBe('github.com');
  });

  it('returns raw string on invalid URL', () => {
    expect(normalizeDomain('not-a-url')).toBe('not-a-url');
  });

  it('extracts hostname excluding port', () => {
    expect(normalizeDomain('https://localhost:3000')).toBe('localhost');
  });
});

describe('suggestCategory', () => {
  it('detects AI tools', () => {
    expect(suggestCategory('ChatGPT Assistant', 'AI-powered chatbot')).toBe('ai');
  });

  it('detects developer tools', () => {
    expect(suggestCategory('VS Code', 'Code editor with git support')).toBe('dev');
  });

  it('defaults to util for unknown', () => {
    expect(suggestCategory('Random App', 'Some random application')).toBe('util');
  });
});
