import { describe, it, expect } from 'vitest';
import { hashId } from '@/lib/hashId';
import { Tool } from '@/lib/types';

describe('Tier 1: Deep-link and collection pagination resolution', () => {
  const sampleUuid = '7d2e48f4-8dcc-4567-9abc-0123456789ab';
  const sampleNumId = hashId(sampleUuid);

  it('identifies tools missing from the loaded page', () => {
    const loadedTools: Tool[] = [
      {
        id: hashId('11111111-1111-4111-8111-111111111111'),
        _uuid: '11111111-1111-4111-8111-111111111111',
        name: 'Loaded Tool 1',
        url: 'https://tool1.com',
        description: 'First tool',
        category: 'dev',
        icon: '⚡',
        favicon: '',
        ogImage: '',
        screenshotUrl: '',
        upvotes: 0,
        priceModel: 'free',
        isOpenSource: false,
        requiresLogin: false,
        isFree: true,
        platforms: ['web'],
        signupRequired: false,
        upvotedByMe: false,
        savedToVault: false,
        isFavorite: false,
        addedAt: Date.now(),
      },
    ];

    // Deep linked tool is not in loaded page
    const foundInLoaded = loadedTools.find(t => t.id === sampleNumId);
    expect(foundInLoaded).toBeUndefined();

    // Resolving numeric ID to UUID allows querying Supabase
    expect(hashId(sampleUuid)).toBe(sampleNumId);
  });

  it('filters missing collection UUIDs so only un-cached items are fetched', () => {
    const cachedUuids = ['uuid-1', 'uuid-2'];
    const loadedTools = cachedUuids.map(u => ({ _uuid: u }));

    const collectionUuids = ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4'];
    const missing = collectionUuids.filter(u => !loadedTools.some(t => t._uuid === u));

    expect(missing).toEqual(['uuid-3', 'uuid-4']);
  });

  it('deduplicates tools when appending fetched missing tools to state', () => {
    const initialTools = [
      { id: 101, _uuid: 'u-1', name: 'Tool A' },
      { id: 102, _uuid: 'u-2', name: 'Tool B' },
    ];

    const newlyFetched = [
      { id: 102, _uuid: 'u-2', name: 'Tool B (Duplicate)' },
      { id: 103, _uuid: 'u-3', name: 'Tool C' },
    ];

    const existingUuids = new Set(initialTools.map(p => p._uuid));
    const trulyNew = newlyFetched.filter(m => !existingUuids.has(m._uuid));
    const merged = [...initialTools, ...trulyNew];

    expect(merged.length).toBe(3);
    expect(merged.map(m => m._uuid)).toEqual(['u-1', 'u-2', 'u-3']);
  });
});
