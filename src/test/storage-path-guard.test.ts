import { describe, it, expect } from 'vitest';

/**
 * Mirrors the guard in src/hooks/useStorageUpload.ts.
 *
 * The buckets are public and `upsert: true`, so a caller-supplied path with
 * `../` resolved to any other key in the bucket -- one user could overwrite
 * another user's avatar or banner. Duplicated here because the hook itself is
 * a React component wrapper and not directly unit-testable; keep in sync.
 */
function isSafePath(path: string, userId: string): boolean {
  if (path.includes('..') || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/')) return false;
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  const segments = path.split('/');
  if (segments.some((s) => s.length === 0)) return false;
  return segments[0] === userId;
}

function safeExtension(fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  return /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : 'bin';
}

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';

describe('isSafePath', () => {
  it('accepts the caller\'s own prefix', () => {
    expect(isSafePath(`${ME}/avatar.png`, ME)).toBe(true);
    expect(isSafePath(`${ME}/a/b/c/deep.png`, ME)).toBe(true);
    expect(isSafePath(`${ME}/${ME}.png`, ME)).toBe(true);
  });

  // ─── the actual vulnerability ────────────────────────────────────────────

  it('rejects traversal into another user\'s objects', () => {
    expect(isSafePath(`${THEM}/avatar.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}/../${THEM}/avatar.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}/../../${THEM}/avatar.png`, ME)).toBe(false);
    expect(isSafePath(`../${THEM}/avatar.png`, ME)).toBe(false);
  });

  it('rejects absolute paths', () => {
    expect(isSafePath(`/${ME}/avatar.png`, ME)).toBe(false);
    expect(isSafePath('/etc/passwd', ME)).toBe(false);
  });

  it('rejects backslash separators that could normalise on the server', () => {
    expect(isSafePath(`${ME}\\..\\${THEM}\\avatar.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}\\avatar.png`, ME)).toBe(false);
  });

  it('rejects empty segments and trailing slashes', () => {
    expect(isSafePath(`${ME}//avatar.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}/avatar.png/`, ME)).toBe(false);
    expect(isSafePath(`${ME}/`, ME)).toBe(false);
  });

  it('rejects control characters, including an embedded newline', () => {
    expect(isSafePath(`${ME}/a\nb.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}/a\u0007b.png`, ME)).toBe(false);
    expect(isSafePath(`${ME}/a\u007f.png`, ME)).toBe(false);
  });

  it('rejects a bare filename with no owner prefix', () => {
    expect(isSafePath('avatar.png', ME)).toBe(false);
    expect(isSafePath('', ME)).toBe(false);
  });

  it('does not let a prefix merely START with the user id', () => {
    // `${ME}x/...` is a different key space, not the caller's.
    expect(isSafePath(`${ME}x/avatar.png`, ME)).toBe(false);
  });
});

describe('safeExtension', () => {
  it('keeps a normal extension and lowercases it', () => {
    expect(safeExtension('photo.PNG')).toBe('png');
    expect(safeExtension('a.b.jpeg')).toBe('jpeg');
  });

  it('falls back to a harmless extension for odd input', () => {
    expect(safeExtension('noextension')).toBe('bin');
    expect(safeExtension('trailing.')).toBe('bin');
    expect(safeExtension('x.verylongextension')).toBe('bin');
    expect(safeExtension('x.pn g')).toBe('bin');
    // A traversal attempt must not survive into the object key.
    expect(safeExtension('x/../../etc/passwd')).not.toContain('/');
  });
});