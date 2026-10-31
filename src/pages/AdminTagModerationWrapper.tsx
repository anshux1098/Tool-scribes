import { useState } from 'react';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import SubmitToolModal from '@/components/SubmitToolModal';
import AdminTagModeration from '@/components/AdminTagModeration';
import { useAuth } from '@/hooks/useAuth';

export default function AdminTagModerationWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('discover');
  const [authOpen, setAuthOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { user } = useAuth();

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setSubmitOpen(true);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={handleAddTool}
        onSubmitTool={() => setSubmitOpen(true)}
        onAuthClick={() => setAuthOpen(true)}
      />
      <AdminTagModeration />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SubmitToolModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}
