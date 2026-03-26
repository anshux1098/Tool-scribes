import { useState } from 'react';
import Navbar from '@/components/Navbar';
import AddToolModal from '@/components/AddToolModal';
import AuthModal from '@/components/AuthModal';
import ToolDetailPage from '@/pages/ToolDetailPage';
import { useTools } from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';

export default function ToolDetailWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const { tools, addTool, toggleUpvote, saveToVault, toggleFavorite, updateNotes, addTag, removeTag, recordVisit } = useTools();

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
      <ToolDetailPage
        tools={tools}
        onUpvote={toggleUpvote}
        onSave={saveToVault}
        onToggleFavorite={toggleFavorite}
        onUpdateNotes={updateNotes}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onRecordVisit={recordVisit}
      />
      <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTool} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
