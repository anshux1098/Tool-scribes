import { describe, it, expect, beforeEach } from 'vitest';
import {
  stringToDeterministicUuid,
  readExtensionClips,
  mergeWithExtensionClips,
  isBlockedToolUrl,
  normalizeToolDomain,
} from '@/hooks/useTools';
import { Tool } from '@/lib/types';

describe('Browser Extension Clip Sync Engine', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('blocks internal, localhost, and ToolScribe self domains', () => {
    expect(isBlockedToolUrl('https://localhost')).toBe(true);
    expect(isBlockedToolUrl('http://localhost:8080/')).toBe(true);
    expect(isBlockedToolUrl('https://extensions')).toBe(true);
    expect(isBlockedToolUrl('chrome://extensions')).toBe(true);
    expect(isBlockedToolUrl('https://tool-scribes-beta.vercel.app')).toBe(true);
    expect(isBlockedToolUrl('https://tool-scribes.vercel.app')).toBe(true);

    expect(isBlockedToolUrl('https://mylearn.oracle.com')).toBe(false);
    expect(isBlockedToolUrl('https://www.freecodecamp.org/learn/python-v9/')).toBe(false);
    expect(normalizeToolDomain('https://www.freecodecamp.org/learn/python-v9/')).toBe('freecodecamp.org');
  });

  it('purges blocked domains and duplicate domains when reading extension clips', () => {
    const rawClips = [
      { id: '625c0544-9a1d-4e11-b502-e141fb5de15e', name: 'Extensions', url: 'https://extensions' },
      { id: 'c631023c-889c-4eba-bf2b-4cd70c55828e', name: 'Tool-scribes-beta', url: 'https://tool-scribes-beta.vercel.app' },
      { id: 'dd1025f4-2461-459a-baa4-9fe8494404f1', name: 'Localhost', url: 'https://localhost' },
      { id: 'f174e5dc-fb6f-40cb-ae44-196728ebe411', name: 'Oracle MyLearn', url: 'https://mylearn.oracle.com/ou/home' },
      { id: 'cae4992f-18b9-4508-86bf-07f72d0e1e0a', name: 'Oracle MyLearn', url: 'https://mylearn.oracle.com/ou/home' },
    ];
    window.localStorage.setItem('ts_extension_clips', JSON.stringify(rawClips));

    const clips = readExtensionClips();
    expect(clips).toHaveLength(1);
    expect(clips[0].name).toBe('Oracle MyLearn');
  });

  it('generates a valid RFC-4122 UUID from a URL or domain string', () => {
    const uuid = stringToDeterministicUuid('https://www.instagram.com/');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    // Deterministic check
    expect(stringToDeterministicUuid('https://www.instagram.com/')).toBe(uuid);
  });

  it('reads clipped tools (e.g. Instagram) from localStorage and maps to savedToVault tools', () => {
    const mockClips = [
      {
        id: 'ext-instagram.com',
        name: 'Instagram',
        url: 'https://www.instagram.com/',
        description: 'Instagram — saved via ToolScribe Extension.',
        category: 'util',
        icon: '🔧',
        favicon: 'https://www.google.com/s2/favicons?domain=instagram.com&sz=64',
        price_model: 'free',
        is_open_source: false,
        is_free: true,
        notes: 'Great for creator inspiration',
        tags: ['social', 'media'],
        created_at: '2026-11-05T14:00:00.000Z',
        syncedToCloud: false,
      },
    ];
    window.localStorage.setItem('ts_extension_clips', JSON.stringify(mockClips));

    const clips = readExtensionClips();
    expect(clips).toHaveLength(1);
    expect(clips[0].name).toBe('Instagram');
    expect(clips[0].url).toBe('https://www.instagram.com/');
    expect(clips[0].savedToVault).toBe(true);
    expect(clips[0].category).toBe('util');
    expect(clips[0].priceModel).toBe('free');
    expect(clips[0].notes).toBe('Great for creator inspiration');
    expect(clips[0].tags).toEqual(['social', 'media']);
    expect(clips[0]._uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('merges extension clips into the main tools list and marks existing tools as savedToVault', () => {
    const mockClips = [
      {
        id: 'ext-instagram.com',
        name: 'Instagram',
        url: 'https://www.instagram.com/',
        description: 'Instagram — saved via ToolScribe Extension.',
        category: 'util',
      },
      {
        id: 'ext-linear.app',
        name: 'Linear',
        url: 'https://linear.app',
        description: 'Issue tracking',
        category: 'prod',
        notes: 'Used daily',
        tags: ['pm'],
      },
    ];
    window.localStorage.setItem('ts_extension_clips', JSON.stringify(mockClips));

    const baseTools: (Tool & { _uuid: string })[] = [
      {
        id: 101,
        _uuid: '11111111-2222-4333-8444-555555555555',
        name: 'Linear',
        url: 'https://linear.app/',
        description: 'Streamline issues, projects, and product roadmaps.',
        category: 'prod',
        icon: '⚡',
        favicon: '',
        ogImage: '',
        screenshotUrl: '',
        upvotes: 42,
        priceModel: 'freemium',
        isOpenSource: false,
        requiresLogin: true,
        isFree: true,
        platforms: ['web'],
        signupRequired: true,
        upvotedByMe: false,
        savedToVault: false,
        isFavorite: false,
        addedAt: Date.now() - 10000,
      },
    ];

    const merged = mergeWithExtensionClips(baseTools);
    // Instagram is prepended + Linear is updated in-place (no duplicate Linear)
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe('Instagram');
    expect(merged[0].savedToVault).toBe(true);

    const linear = merged.find(t => t.name === 'Linear')!;
    expect(linear.savedToVault).toBe(true);
    expect(linear.notes).toBe('Used daily');
    expect(linear.tags).toEqual(['pm']);
  });
});
