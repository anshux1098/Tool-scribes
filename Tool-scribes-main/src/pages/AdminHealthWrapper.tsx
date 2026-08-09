import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AddToolModal from '@/components/AddToolModal';
import AuthModal from '@/components/AuthModal';
import SubmitToolModal from '@/components/SubmitToolModal';
import SearchEverywhere from '@/components/SearchEverywhere';
import AdminHealthPage from '@/components/AdminHealthPage';
import { useAuth } from '@/hooks/useAuth';
import { useTools } from '@/hooks/useTools';
import { useSearch } from '@/hooks/useSearch';

export default function AdminHealthWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { user } = useAuth();
  const { addTool } = useTools();
  const search = useSearch();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
        onSearchClick={() => setSearchOpen(true)}
        onSubmitTool={() => setSubmitOpen(true)}
      />
      <AdminHealthPage />
      <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTool} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SubmitToolModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
      <SearchEverywhere
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={search.query}
        onQueryChange={search.setQuery}
        results={search.results}
        loading={search.loading}
        hasQuery={search.hasQuery}
        category={search.filters.category}
        onCategoryChange={search.updateCategory}
      />
    </div>
  );
}
