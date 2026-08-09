import { useState, useEffect, lazy, Suspense } from 'react';
import { SEO } from '@/components/SEO';
import Navbar from '@/components/Navbar';
import { useTools } from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';
import { useCollections } from '@/hooks/useCollections';
import { useSearch } from '@/hooks/useSearch';

/* Lazy-loaded heavy components */
const AddToolModal = lazy(() => import('@/components/AddToolModal'));
const AuthModal = lazy(() => import('@/components/AuthModal'));
const CreateCollectionModal = lazy(() => import('@/components/CreateCollectionModal'));
const SubmitToolModal = lazy(() => import('@/components/SubmitToolModal'));
const OnboardingModal = lazy(() => import('@/components/OnboardingModal'));
const SearchEverywhere = lazy(() => import('@/components/SearchEverywhere'));
const AskToolScribeModal = lazy(() => import('@/components/AskToolScribeModal'));

/* Eager pages (lightweight - just render immediately) */
import VaultPage from '@/pages/VaultPage';
import DiscoverPage from '@/pages/DiscoverPage';

const ModalFallback = () => null;

type Tabs = 'vault' | 'discover';

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tabs>('discover');
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { user } = useAuth();
  const { tools, loading, error, addTool, toggleFavorite, toggleUpvote, saveToVault, removeFromVault, refetch } = useTools();
  const { collections, loading: colsLoading, createCollection, deleteCollection, renameCollection } = useCollections();
  const search = useSearch();

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setModalOpen(true);
  };

  useEffect(() => {
    if (user && !loading && tools.length > 0) {
      const vaultTools = tools.filter(t => t.savedToVault);
      if (vaultTools.length === 0) {
        let onboarded = false;
        try { onboarded = localStorage.getItem('ts_onboarded') === 'true'; } catch {}
        if (!onboarded) setOnboardingOpen(true);
      }
    }
  }, [user, loading, tools]);

  const handleOnboardingComplete = () => {
    setOnboardingOpen(false);
    refetch();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setAskOpen(prev => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <SEO path="/" />
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={handleAddTool}
        onAuthClick={() => setAuthOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
        onAskClick={() => setAskOpen(true)}
        onSubmitTool={() => setSubmitOpen(true)}
        onCreateCollection={() => setCollectionModalOpen(true)}
      />

      {error ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-[13px] font-mono text-red-600">{error}</p>
        </div>
      ) : activeTab === 'vault' ? (
        <VaultPage
          tools={tools}
          onToggleFavorite={toggleFavorite}
          onRemoveFromVault={removeFromVault}
          onSaveToVault={saveToVault}
          onAddTool={handleAddTool}
          loading={loading}
          collections={collections}
          collectionsLoading={colsLoading}
          onCreateCollection={() => setCollectionModalOpen(true)}
        />
      ) : (
        <DiscoverPage tools={tools} onUpvote={toggleUpvote} onSave={saveToVault} onAddTool={handleAddTool} loading={loading} />
      )}

      <Suspense fallback={<ModalFallback />}>
        {modalOpen && <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTool} />}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {authOpen && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {collectionModalOpen && (
          <CreateCollectionModal
            open={collectionModalOpen}
            onClose={() => setCollectionModalOpen(false)}
            onCreate={(name, desc) => createCollection(name, desc)}
          />
        )}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {searchOpen && (
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
        )}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {askOpen && <AskToolScribeModal open={askOpen} onClose={() => setAskOpen(false)} />}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {submitOpen && <SubmitToolModal open={submitOpen} onClose={() => setSubmitOpen(false)} />}
      </Suspense>
      <Suspense fallback={<ModalFallback />}>
        {onboardingOpen && (
          <OnboardingModal
            open={onboardingOpen}
            onClose={() => setOnboardingOpen(false)}
            onComplete={handleOnboardingComplete}
          />
        )}
      </Suspense>
    </div>
  );
}
