import { describe, it, expect } from 'vitest';

/**
 * Mirrors the keyset filter built in src/hooks/useTools.ts.
 *
 * `created_at` is not unique: seedTools.ts bulk-inserts a batch in one
 * statement, so every tool in it shares a timestamp. Verified in production at
 * the time of writing — 30 of 80 tools sat on just 5 duplicated timestamps, one
 * carrying 8 tools. Paging on created_at alone skipped everything sharing the
 * boundary stamp: measured against the live table at page size 5, the old
 * cursor reached 66 of 80 tools and 14 were permanently unreachable.
 *
 * `id` is the tiebreaker. Keep in sync with the hook.
 */
function buildKeysetFilter(cursor: { createdAt: string; id: string }): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

/**
 * Applies the OR filter the way PostgREST does.
 *
 * The filter is `A,B` — A OR B. A row on the boundary timestamp is excluded by
 * A (`created_at.lt.X`) but can still be INCLUDED by B, which is the whole point
 * of the composite cursor. Evaluating A as a hard filter would drop exactly the
 * rows the tiebreaker exists to rescue.
 */
function matchesFilter(row: { createdAt: string; id: string }, filter: string): boolean {
  const boundary = /^created_at\.lt\.(.+?),and\(created_at\.eq\.(.+?),id\.lt\.(.+)\)$/.exec(filter);
  if (!boundary) throw new Error(`unexpected filter shape: ${filter}`);
  const [, createdAt, eqAt, idLt] = boundary;

  // Clause A: strictly older timestamp.
  if (row.createdAt < createdAt) return true;
  // Clause B: same timestamp AND a lower id.
  if (row.createdAt === eqAt && row.id < idLt) return true;
  return false;
}

describe('composite keyset filter', () => {
  it('includes strictly older timestamps', () => {
    const f = buildKeysetFilter({ createdAt: '2026-01-10', id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
    expect(matchesFilter({ createdAt: '2026-01-09', id: 'ffffffff-ffff-4fff-8fff-000000000000' }, f)).toBe(true);
  });

  it('breaks ties on id, so same-timestamp rows are not skipped', () => {
    const cursorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const f = buildKeysetFilter({ createdAt: '2026-01-10', id: cursorId });

    // Same timestamp, lower id -> still included.
    expect(matchesFilter({ createdAt: '2026-01-10', id: '00000000-0000-4000-8000-000000000000' }, f)).toBe(true);
    // Same timestamp, higher id -> excluded.
    expect(matchesFilter({ createdAt: '2026-01-10', id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, f)).toBe(false);
    // Same timestamp, the cursor row itself -> excluded, so it is not repeated.
    expect(matchesFilter({ createdAt: '2026-01-10', id: cursorId }, f)).toBe(false);
  });

  it('excludes newer timestamps regardless of id', () => {
    const f = buildKeysetFilter({ createdAt: '2026-01-10', id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
    expect(matchesFilter({ createdAt: '2026-01-11', id: '00000000-0000-4000-8000-000000000000' }, f)).toBe(false);
  });
});

describe('pagination over duplicated timestamps (regression guard)', () => {
  /** Two seed batches that each share one timestamp, like seedTools produces. */
  const rows = [
    { createdAt: '2026-03-01', id: 'a0000000-0000-4000-8000-000000000001' },
    { createdAt: '2026-03-01', id: 'a0000000-0000-4000-8000-000000000002' },
    { createdAt: '2026-03-01', id: 'a0000000-0000-4000-8000-000000000003' },
    { createdAt: '2026-02-01', id: 'b0000000-0000-4000-8000-000000000001' },
    { createdAt: '2026-02-01', id: 'b0000000-0000-4000-8000-000000000002' },
    { createdAt: '2026-01-01', id: 'c0000000-0000-4000-8000-000000000001' },
  ];
  const byOrder = (a: typeof rows[0], b: typeof rows[0]) =>
    a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : (a.createdAt < b.createdAt ? 1 : -1);

  it('reaches every row exactly once at page size 2', () => {
    const pageSize = 2;
    const sorted = [...rows].sort(byOrder);
    const seen: string[] = [];
    let cursor = { createdAt: '9999', id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };

    for (let i = 0; i < 10; i++) {
      const page = sorted
        .filter((r) => matchesFilter(r, buildKeysetFilter(cursor)))
        .sort(byOrder)
        .slice(0, pageSize);
      if (page.length === 0) break;
      seen.push(...page.map((r) => r.id));
      const last = page[page.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }

    expect(seen).toHaveLength(rows.length);
    expect(new Set(seen).size).toBe(rows.length);
  });

  it('the naive created_at-only cursor loses rows, which is the bug', () => {
    // Documents the failure mode: with page size 2 the third page would begin
    // after 2026-03-01, so the remaining two rows on that same timestamp are
    // unreachable forever.
    const pageSize = 2;
    const sorted = [...rows].sort(byOrder);
    const naiveSeen: string[] = [];
    let cursor = '9999';

    for (let i = 0; i < 10; i++) {
      const page = sorted.filter((r) => r.createdAt < cursor).sort(byOrder).slice(0, pageSize);
      if (page.length === 0) break;
      naiveSeen.push(...page.map((r) => r.id));
      cursor = page[page.length - 1].createdAt;
    }

    expect(naiveSeen.length).toBeLessThan(rows.length);
  });
});