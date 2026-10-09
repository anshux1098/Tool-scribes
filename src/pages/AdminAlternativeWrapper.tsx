import { useAuth } from '@/hooks/useAuth';
import AdminAlternativeModeration from '@/components/AdminAlternativeModeration';

export default function AdminAlternativeWrapper() {
  const { isAdmin, isModerator, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[13px] font-mono text-tv-text-m">Loading...</p>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[13px] font-mono text-red-600">Access denied. Admin or moderator privileges required.</p>
      </div>
    );
  }

  return <AdminAlternativeModeration />;
}
