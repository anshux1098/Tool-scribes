import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type BucketName = 'avatars' | 'banners' | 'collection-covers';

/** These buckets are PUBLIC and are rendered inside <img> on profile pages. */
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * A caller-supplied storage path must live under the caller's own prefix.
 *
 * These buckets are public and `upsert: true`, so a path containing `../`
 * resolved to ANY other key in the bucket — one user could overwrite another
 * user's avatar or banner by passing `<their-uuid>/avatar.png`. `remove()` had
 * the same problem.
 *
 * Enforced here rather than in a Storage RLS policy because Supabase storage
 * object policies cannot express "the first path segment must equal auth.uid()"
 * without a custom policy per bucket. Defence in depth: the DB grants are
 * scoped by the deploy-time bucket policies, and this stops the traversal
 * before the request is made.
 */
function isSafePath(path: string, userId: string): boolean {
  // No traversal, no absolute paths, no backslashes (Windows-normalised).
  if (path.includes('..') || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/')) return false;
  // Explicit scan rather than /[\x00-\x1f]/ -- eslint's no-control-regex.
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  const segments = path.split('/');
  if (segments.some((s) => s.length === 0)) return false;
  // Must be owned by the caller.
  return segments[0] === userId;
}

/** Strip anything that could escape or confuse the object key. */
function safeExtension(fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  return /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : 'bin';
}

export function useStorageUpload(bucket: BucketName) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, path?: string): Promise<string | null> => {
    if (!isSupabaseConfigured) { setError('Supabase not configured'); return null; }
    setUploading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { setError('Not authenticated'); return null; }

      // The bucket is public, so an HTML or SVG upload would be served from the
      // CDN with its own content type — stored XSS on a first-party origin.
      if (!ALLOWED_MIME.has(file.type)) {
        setError(`Unsupported file type: ${file.type || 'unknown'}`);
        return null;
      }

      const filePath = path ?? `${userId}/${crypto.randomUUID()}.${safeExtension(file.name)}`;
      if (!isSafePath(filePath, userId)) {
        setError('Invalid upload path');
        return null;
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, [bucket]);

  const remove = useCallback(async (path: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      // Without this check a caller could delete any object in the bucket.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || !isSafePath(path, userId)) {
        console.error('[Storage] refused to remove a path outside the caller prefix:', path);
        return false;
      }
      const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
      if (removeError) throw removeError;
      return true;
    } catch (e) {
      console.error('[Storage] remove failed:', e);
      return false;
    }
  }, [bucket]);

  const getPublicUrl = useCallback((path: string): string => {
    if (!isSupabaseConfigured) return '';
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }, [bucket]);

  return { upload, remove, getPublicUrl, uploading, error };
}