import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AddToolModal from '@/components/AddToolModal';
import AuthModal from '@/components/AuthModal';
import SubmitToolModal from '@/components/SubmitToolModal';
import CollectionPage from '@/pages/CollectionPage';
import SearchEverywhere from '@/components/SearchEverywhere';
import { useTools } from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';
import { useCollections } from '@/hooks/useCollections';
import { useSearch } from '@/hooks/useSearch';

export default function CollectionDetailWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { user } = useAuth();
  const search = useSearch();
  const { tools, toggleFavorite } = useTools();
  const { collections, renameCollection, deleteCollection, removeToolFromCollection, togglePublic } = useCollections();

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

  const handleRemoveFromCollection = async (collectionNumId: number, toolUuid: string) => {
    removeToolFromCollection(collectionNumId, toolUuid);
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
      <CollectionPage
        tools={tools}
        collections={collections}
        onRename={renameCollection}
        onDelete={deleteCollection}
        onToggleFavorite={toggleFavorite}
        onRemoveFromCollection={handleRemoveFromCollection}
        onTogglePublic={togglePublic}
      />
      <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={() => {}} />
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
