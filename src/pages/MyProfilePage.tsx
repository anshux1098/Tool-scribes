import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

/**
 * Route handler for `/profile`.
 * Seamlessly redirects authenticated users to their canonical `/u/:username` editorial profile,
 * or to `/settings` if they haven't set a username yet.
 */
export default function MyProfilePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useCurrentProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (profile?.username) {
      navigate(`/u/${profile.username}`, { replace: true });
    } else if (profile) {
      navigate('/settings', { replace: true });
    }
  }, [user, profile, authLoading, profileLoading, navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <SEO title="My Profile" description="Your personal profile on Tool Scribe." path="/profile" type="profile" />
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-tv-primary" />
        <span className="text-[13px] text-tv-text-m font-mono">Loading profile...</span>
      </div>
    </div>
  );
}
