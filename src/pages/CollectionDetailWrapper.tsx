import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCollections } from '@/hooks/useCollections';
import { supabase } from '@/lib/supabase';
import { hashId } from '@/lib/hashId';

/**
 * Route forwarder for legacy `/collections/:id`.
 * Resolves numeric collection IDs or legacy links and redirects to canonical `/c/:uuid`.
 */
export default function CollectionDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { collections, loading: collectionsLoading } = useCollections();

  useEffect(() => {
    if (!id) {
      navigate('/collections', { replace: true });
      return;
    }

    // Direct UUID match
    if (id.includes('-') && id.length >= 32) {
      navigate(`/c/${id}`, { replace: true });
      return;
    }

    const numId = Number(id);
    const found = collections.find(c => c.id === numId);
    if (found?._uuid) {
      navigate(`/c/${found._uuid}`, { replace: true });
      return;
    }

    if (!collectionsLoading) {
      (async () => {
        try {
          const { data } = await supabase.from('collections').select('id');
          const match = (data ?? []).find(r => hashId(r.id) === numId);
          if (match?.id) {
            navigate(`/c/${match.id}`, { replace: true });
          } else {
            navigate('/collections', { replace: true });
          }
        } catch {
          navigate('/collections', { replace: true });
        }
      })();
    }
  }, [id, collections, collectionsLoading, navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-tv-primary" />
        <span className="text-[13px] text-tv-text-m font-mono">Loading collection...</span>
      </div>
    </div>
  );
}
