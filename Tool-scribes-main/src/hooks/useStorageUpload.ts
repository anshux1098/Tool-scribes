import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type BucketName = 'avatars' | 'banners' | 'collection-covers';

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
      const ext = file.name.split('.').pop();
      const filePath = path || `${userId}/${crypto.randomUUID()}.${ext}`;
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
