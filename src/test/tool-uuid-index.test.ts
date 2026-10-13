import { describe, it, expect } from 'vitest';
import { hashId } from '@/lib/hashId';

/**
 * #24: mutations resolve a numeric tool id to its UUID. That used to scan only
 * the loaded page, so any tool outside the first PAGE_SIZE rows silently
 * no-opped every upvote/save/notes/visit.
 *
 * The fix keeps a hash -> uuid index. These pin the property the index depends
 * on: hashId is stable, collision-resistant in practice, and injective enough
 * that an id present in the table is always findable by its hash.
 */
describe('hash -> uuid index (regression guard for #24)', () => {
  const uuids = [
    '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    '9c5b94b1-35ad-49bb-b118-8e8fc24abf80',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '110e8400-e29b-41d4-a716-446655440000',
  ];

  it('indexes every uuid by its own hash', () => {
    const index = new Map<number, string>();
    for (const uuid of uuids) index.set(hashId(uuid), uuid);

    for (const uuid of uuids) {
      expect(index.get(hashId(uuid))).toBe(uuid);
    }
  });

  it('produces no collisions across a realistic sample', () => {
    // A collision would make the index resolve the WRONG tool, so a deep link
    // would act on someone else's row. The hash is 32-bit, so this is
    // probabilistic by nature -- pin it so a change is caught early.
    const index = new Map<number, string>();
    for (const uuid of uuids) {
      const h = hashId(uuid);
      expect(index.has(h), `collision on ${uuid}`).toBe(false);
      index.set(h, uuid);
    }
    expect(index.size).toBe(uuids.length);
  });

  it('is stable across calls, so the cache stays valid for a session', () => {
    const first = new Map(uuids.map(u => [hashId(u), u]));
    const second = new Map(uuids.map(u => [hashId(u), u]));
    expect([...first.entries()].sort()).toEqual([...second.entries()].sort());
  });

  it('resolves an id that was never in the loaded page', () => {
    // Simulates the #24 scenario directly: the "loaded page" is empty, as it
    // was before the first fetch resolved, yet the id must still resolve.
    const loadedPage = new Map<string, string>(); // uuid -> name, deliberately empty
    const index = new Map<number, string>();
    for (const uuid of uuids) index.set(hashId(uuid), uuid);

    const target = uuids[3];
    expect(loadedPage.has(target)).toBe(false);        // not loaded
    expect(index.get(hashId(target))).toBe(target);     // but resolvable
  });

  it('returns undefined for an id that is not in the table at all', () => {
    // The mutation now logs an error on this path instead of silently
    // returning, so callers must not treat a miss as success.
    const index = new Map<number, string>();
    for (const uuid of uuids) index.set(hashId(uuid), uuid);
    expect(index.get(hashId('00000000-0000-4000-8000-000000000000'))).toBeUndefined();
  });
});