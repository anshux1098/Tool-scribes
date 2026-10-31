import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) { navigate('/'); return; }

    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : '');
    const searchParams = new URLSearchParams(search);

    const errorParam = hashParams.get('error_description')
      || searchParams.get('error_description')
      || hashParams.get('error')
      || searchParams.get('error');

    if (errorParam) {
      const decoded = decodeURIComponent(errorParam.replace(/\+/g, ' '));
      setErrorMessage(decoded);
      toast.error('Authentication Error', { description: decoded });
      return;
    }

    const isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setErrorMessage(error.message);
        toast.error('Authentication Error', { description: error.message });
        return;
      }
      if (!session) {
        navigate('/');
        return;
      }
      if (isRecovery) {
        navigate('/reset-password');
      } else {
        setConfirmed(true);
        setTimeout(() => navigate('/'), 2000);
      }
    }).catch((e) => {
      console.error('[AuthCallbackPage] session error:', e);
      setErrorMessage('Failed to verify session.');
    });
  }, [navigate]);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={32} className="mx-auto text-red-600 mb-3" />
          <p className="text-[14px] text-tv-text font-mono font-medium">Authentication Failed</p>
          <p className="text-[12px] text-tv-text-s font-mono mt-1 mb-4 leading-relaxed">{errorMessage}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-mono hover:bg-tv-primary-dark transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Check size={32} className="mx-auto text-tv-primary mb-3" />
          <p className="text-[14px] text-tv-text font-mono">Email confirmed.</p>
          <p className="text-[12px] text-tv-text-s font-mono mt-1">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-tv-text-m" />
    </div>
  );
}
