import { useState } from 'react';
import Navbar from '@/components/Navbar';
import AddToolModal from '@/components/AddToolModal';
import AuthModal from '@/components/AuthModal';
import VaultPage from '@/pages/VaultPage';
import DiscoverPage from '@/pages/DiscoverPage';
import { useTools } from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

type Tab = 'vault' | 'discover';

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const { tools, loading, error, addTool, toggleFavorite, toggleUpvote, saveToVault } = useTools();

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={handleAddTool}
        onAuthClick={() => setAuthOpen(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-tv-text-m" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-[13px] font-mono text-red-600">{error}</p>
        </div>
      ) : activeTab === 'vault' ? (
        <VaultPage tools={tools} onToggleFavorite={toggleFavorite} onAddTool={handleAddTool} />
      ) : (
        <DiscoverPage tools={tools} onUpvote={toggleUpvote} onSave={saveToVault} onAddTool={handleAddTool} />
      )}

      <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTool} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
