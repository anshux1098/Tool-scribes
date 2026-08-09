import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { navigate('/'); return; }
    const hash = window.location.hash;
    const isRecovery = hash.includes('type=recovery');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return; }
      if (isRecovery) {
        navigate('/reset-password');
      } else {
        setConfirmed(true);
        setTimeout(() => navigate('/'), 2000);
      }
    });
  }, [navigate]);

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
