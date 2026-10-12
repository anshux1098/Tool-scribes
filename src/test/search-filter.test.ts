import { describe, it, expect } from 'vitest';
import { buildTokenizedOrClause, escapeLike, stripFilterGrammar } from '@/lib/search/simple-engine';

/**
 * The `.or()` argument is a comma-separated list of `column.op.value` filters.
 * escapeLike only handles the SQL LIKE grammar (`%` `_` `\`), which is a
 * different language from the PostgREST filter grammar — so before these tests
 * existed, a query containing `,` or `.` injected an extra filter condition.
 */

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves PostgREST grammar untouched, which is why it is not sufficient', () => {
    // Documents the gap this module closes: escapeLike alone does nothing
    // about a comma.
    expect(escapeLike('a,b')).toBe('a,b');
  });
});

describe('stripFilterGrammar', () => {
  it('removes the characters that delimit filters', () => {
    expect(stripFilterGrammar('a,b')).toBe('ab');
    expect(stripFilterGrammar('category.eq.dev')).toBe('categoryeqdev');
    expect(stripFilterGrammar('not.is.null')).toBe('notisnull');
  });

  it('removes parentheses, asterisks and quotes', () => {
    expect(stripFilterGrammar('or(a,b)')).toBe('orab');
    expect(stripFilterGrammar('a*b')).toBe('ab');
    expect(stripFilterGrammar('a"b')).toBe('ab');
  });

  it('keeps ordinary search text intact', () => {
    expect(stripFilterGrammar('figma')).toBe('figma');
    expect(stripFilterGrammar('react query')).toBe('react query');
    expect(stripFilterGrammar('C++ & Rust')).toBe('C++ & Rust');
  });
});

describe('buildTokenizedOrClause', () => {
  it('builds a name and description filter per token', () => {
    expect(buildTokenizedOrClause('figma')).toBe(
      'name.ilike.%figma%,description.ilike.%figma%',
    );
  });

  it('applies the embed prefix to both columns', () => {
    expect(buildTokenizedOrClause('figma', 'tools')).toBe(
      'tools.name.ilike.%figma%,tools.description.ilike.%figma%',
    );
  });

  it('emits one clause pair per token', () => {
    expect(buildTokenizedOrClause('react query')).toBe(
      'name.ilike.%react%,description.ilike.%react%,name.ilike.%query%,description.ilike.%query%',
    );
  });

  it('escapes LIKE wildcards inside a token', () => {
    expect(buildTokenizedOrClause('100%')).toBe(
      'name.ilike.%100\\%%,description.ilike.%100\\%%',
    );
  });

  it('returns empty for an empty query', () => {
    expect(buildTokenizedOrClause('')).toBe('');
    expect(buildTokenizedOrClause('   ')).toBe('');
  });

  // ─── the injection cases ────────────────────────────────────────────────

  it('cannot inject an equality condition via a comma', () => {
    // Before: `x,category.eq.dev` became a second filter `category.eq.dev`.
    const clause = buildTokenizedOrClause('x,category.eq.dev');
    expect(clause).not.toContain(',category.eq');
    // Exactly one pair of clauses, so no extra condition can be smuggled in.
    expect(clause.split(',')).toHaveLength(2);
  });

  it('cannot inject via a dot-qualified operator', () => {
    const clause = buildTokenizedOrClause('x.not.is.null');
    expect(clause.split(',')).toHaveLength(2);
    expect(clause).not.toContain('.not.');
  });

  it('cannot inject a nested or() group', () => {
    const clause = buildTokenizedOrClause('x,or(category.eq.dev)');
    expect(clause).not.toContain('or(');
    expect(clause.split(',')).toHaveLength(2);
  });

  it('cannot close the surrounding filter expression', () => {
    const clause = buildTokenizedOrClause('x),category.eq.dev');
    expect(clause).not.toContain(')');
    expect(clause.split(',')).toHaveLength(2);
  });

  it('drops tokens that are entirely grammar rather than emitting an empty filter', () => {
    // An empty value would produce `name.ilike.%%`, matching everything.
    const clause = buildTokenizedOrClause(',,.,.');
    expect(clause).toBe('');
  });

  it('keeps the safe part of a partly-hostile token', () => {
    expect(buildTokenizedOrClause('figma,or()')).toBe(
      'name.ilike.%figmaor%,description.ilike.%figmaor%',
    );
  });

  it('cannot escape back out of a quoted value', () => {
    const clause = buildTokenizedOrClause('a"b');
    expect(clause).not.toContain('"');
    expect(clause).toBe('name.ilike.%ab%,description.ilike.%ab%');
  });

  it('holds under a mixed injection attempt', () => {
    const clause = buildTokenizedOrClause('design,category.eq.admin,and(user_id.eq.x)');
    const parts = clause.split(',');
    // Every part must still be a name/description ilike on a known column.
    for (const part of parts) {
      expect(part).toMatch(/^(tools\.)?(name|description)\.ilike\.%.*%$/);
    }
  });
});