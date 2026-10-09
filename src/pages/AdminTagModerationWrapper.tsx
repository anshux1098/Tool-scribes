import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import AdminTagModeration from '@/components/AdminTagModeration';
import { useAuth } from '@/hooks/useAuth';

export default function AdminTagModerationWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('discover');
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    navigate('/?add=1');
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={handleAddTool}
        onAuthClick={() => setAuthOpen(true)}
      />
      <AdminTagModeration />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}